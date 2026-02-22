"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// ---- Types ----

interface Profile {
  id: string;
  display_name: string;
}

interface GameInputRequest {
  id: string;
  game_id: string;
  requester_id: string;
  status: string;
  created_at: string;
  requester_name?: string;
}

export interface UseGameSessionReturn {
  /** Whether the current user holds the input session */
  isMySession: boolean;
  /** Profile of the current session holder */
  currentHolder: Profile | null;
  /** Request input control */
  requestSession: () => Promise<void>;
  /** Release input control */
  releaseSession: () => Promise<void>;
  /** Pending request received (for current holder) */
  pendingRequest: (GameInputRequest & { requester_name: string }) | null;
  /** Pending request sent by current user */
  myPendingRequest: { id: string; created_at: string } | null;
  /** Whether the user's latest request was rejected */
  wasRejected: boolean;
  /** Approve a pending request */
  approveRequest: (requestId: string) => Promise<void>;
  /** Reject a pending request */
  rejectRequest: (requestId: string) => Promise<void>;
  /** Loading state */
  loading: boolean;
}

const HEARTBEAT_INTERVAL_MS = 5 * 1000; // 5 seconds
const AUTO_APPROVE_TIMEOUT_MS = 60 * 1000; // 60 seconds

export function useGameSession(gameId: string, userId: string | null): UseGameSessionReturn {
  const supabase = createClient();

  const [isMySession, setIsMySession] = useState(false);
  const [currentHolder, setCurrentHolder] = useState<Profile | null>(null);
  const [pendingRequest, setPendingRequest] = useState<(GameInputRequest & { requester_name: string }) | null>(null);
  const [myPendingRequest, setMyPendingRequest] = useState<{ id: string; created_at: string } | null>(null);
  const [wasRejected, setWasRejected] = useState(false);
  const [loading, setLoading] = useState(true);

  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoApproveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // ---- Fetch session state ----
  const fetchSession = useCallback(async () => {
    if (!userId) return;

    const { data: session } = await supabase
      .from("game_input_sessions")
      .select("id, game_id, profile_id, last_active_at")
      .eq("game_id", gameId)
      .maybeSingle();

    if (!session) {
      // No session exists — create one for this user
      const { data: newSession } = await supabase
        .from("game_input_sessions")
        .insert({ game_id: gameId, profile_id: userId })
        .select("id")
        .single();

      if (newSession) {
        sessionIdRef.current = newSession.id;
        setIsMySession(true);
        setCurrentHolder({ id: userId, display_name: "" });
        setPendingRequest(null);
        setMyPendingRequest(null);
        setWasRejected(false);
      }
      setLoading(false);
      return;
    }

    sessionIdRef.current = session.id;

    if (session.profile_id === userId) {
      // My session
      setIsMySession(true);
      setCurrentHolder({ id: userId, display_name: "" });
      setMyPendingRequest(null);
      setWasRejected(false);

      // Check for pending requests addressed to me (from other users)
      const { data: requests } = await supabase
        .from("game_input_requests")
        .select("id, game_id, requester_id, status, created_at")
        .eq("game_id", gameId)
        .eq("status", "pending")
        .neq("requester_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (requests && requests.length > 0) {
        const req = requests[0];
        // Fetch requester name
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", req.requester_id)
          .single();

        setPendingRequest({
          ...req,
          requester_name: profile?.display_name ?? "不明",
        });
      } else {
        setPendingRequest(null);
      }
    } else {
      // Someone else's session
      setIsMySession(false);

      // Fetch holder profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("id", session.profile_id)
        .single();

      setCurrentHolder(profile ?? { id: session.profile_id, display_name: "不明" });
      setPendingRequest(null);

      // Check if current user has a pending or recently rejected request
      const { data: myReqs } = await supabase
        .from("game_input_requests")
        .select("id, created_at, status")
        .eq("game_id", gameId)
        .eq("requester_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (myReqs && myReqs.length > 0) {
        const latest = myReqs[0];
        if (latest.status === "pending") {
          setMyPendingRequest({ id: latest.id, created_at: latest.created_at });
          setWasRejected(false);
        } else if (latest.status === "rejected") {
          setMyPendingRequest(null);
          setWasRejected(true);
        } else {
          setMyPendingRequest(null);
          setWasRejected(false);
        }
      } else {
        setMyPendingRequest(null);
        setWasRejected(false);
      }
    }

    setLoading(false);
  }, [gameId, userId, supabase]);

  // ---- Request session ----
  const requestSession = useCallback(async () => {
    if (!userId) return;

    await supabase
      .from("game_input_requests")
      .insert({
        game_id: gameId,
        requester_id: userId,
        status: "pending",
      });
  }, [gameId, userId, supabase]);

  // ---- Release session ----
  const releaseSession = useCallback(async () => {
    if (!userId) return;

    await supabase
      .from("game_input_sessions")
      .delete()
      .eq("game_id", gameId)
      .eq("profile_id", userId);

    setIsMySession(false);
    setCurrentHolder(null);
    sessionIdRef.current = null;
  }, [gameId, userId, supabase]);

  // ---- Approve request ----
  const approveRequest = useCallback(async (requestId: string) => {
    if (!userId) return;

    // Update request status
    await supabase
      .from("game_input_requests")
      .update({ status: "approved" })
      .eq("id", requestId);

    // Get requester id
    const { data: req } = await supabase
      .from("game_input_requests")
      .select("requester_id")
      .eq("id", requestId)
      .single();

    if (req) {
      // Transfer session: update profile_id and reset last_active_at
      await supabase
        .from("game_input_sessions")
        .update({
          profile_id: req.requester_id,
          last_active_at: new Date().toISOString(),
        })
        .eq("game_id", gameId);
    }

    setPendingRequest(null);
    setIsMySession(false);
  }, [gameId, userId, supabase]);

  // ---- Reject request ----
  const rejectRequest = useCallback(async (requestId: string) => {
    await supabase
      .from("game_input_requests")
      .update({ status: "rejected" })
      .eq("id", requestId);

    setPendingRequest(null);
  }, [supabase]);

  // ---- Heartbeat ----
  useEffect(() => {
    if (!isMySession || !userId) return;

    heartbeatRef.current = setInterval(async () => {
      await supabase
        .from("game_input_sessions")
        .update({ last_active_at: new Date().toISOString() })
        .eq("game_id", gameId)
        .eq("profile_id", userId);
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [isMySession, gameId, userId, supabase]);

  // ---- Auto-approve timeout (holder side) ----
  useEffect(() => {
    if (!isMySession) {
      if (autoApproveRef.current) {
        clearInterval(autoApproveRef.current);
        autoApproveRef.current = null;
      }
      return;
    }

    autoApproveRef.current = setInterval(async () => {
      const { data: requests } = await supabase
        .from("game_input_requests")
        .select("id, created_at, requester_id")
        .eq("game_id", gameId)
        .eq("status", "pending");

      if (!requests) return;

      for (const req of requests) {
        const elapsed = Date.now() - new Date(req.created_at).getTime();
        if (elapsed >= AUTO_APPROVE_TIMEOUT_MS) {
          // Auto-approve: update request and transfer session
          await supabase
            .from("game_input_requests")
            .update({ status: "approved" })
            .eq("id", req.id);

          await supabase
            .from("game_input_sessions")
            .update({
              profile_id: req.requester_id,
              last_active_at: new Date().toISOString(),
            })
            .eq("game_id", gameId);

          setPendingRequest(null);
          setIsMySession(false);
        }
      }
    }, 5000);

    return () => {
      if (autoApproveRef.current) {
        clearInterval(autoApproveRef.current);
        autoApproveRef.current = null;
      }
    };
  }, [isMySession, gameId, supabase]);

  // ---- Auto-approve from requester side ----
  useEffect(() => {
    if (!myPendingRequest || isMySession || !userId) return;

    const timer = setInterval(async () => {
      const elapsed = Date.now() - new Date(myPendingRequest.created_at).getTime();
      if (elapsed >= AUTO_APPROVE_TIMEOUT_MS) {
        // Auto-approve: update request and transfer session
        await supabase
          .from("game_input_requests")
          .update({ status: "approved" })
          .eq("id", myPendingRequest.id);

        await supabase
          .from("game_input_sessions")
          .update({
            profile_id: userId,
            last_active_at: new Date().toISOString(),
          })
          .eq("game_id", gameId);

        setMyPendingRequest(null);
        // Realtime will trigger fetchSession to update state
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [myPendingRequest, isMySession, gameId, userId, supabase]);

  // ---- Realtime subscription ----
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`game-session-${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_input_sessions",
          filter: `game_id=eq.${gameId}`,
        },
        () => {
          fetchSession();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_input_requests",
          filter: `game_id=eq.${gameId}`,
        },
        () => {
          fetchSession();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, userId, supabase, fetchSession]);

  // ---- Initial fetch ----
  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // ---- Cleanup on unmount: release session ----
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!userId) return;
      // Use navigator.sendBeacon for reliability on tab close
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/game_input_sessions?game_id=eq.${gameId}&profile_id=eq.${userId}`;
      const headers = {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${document.cookie.match(/sb-[^=]+-auth-token=([^;]+)/)?.[1] ?? ""}`,
      };
      // sendBeacon doesn't support DELETE, so we use fetch with keepalive
      fetch(url, {
        method: "DELETE",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        keepalive: true,
      }).catch(() => {});
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Also attempt cleanup on React unmount
      if (userId) {
        supabase
          .from("game_input_sessions")
          .delete()
          .eq("game_id", gameId)
          .eq("profile_id", userId)
          .then(() => {});
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, userId]);

  return {
    isMySession,
    currentHolder,
    requestSession,
    releaseSession,
    pendingRequest,
    myPendingRequest,
    wasRejected,
    approveRequest,
    rejectRequest,
    loading,
  };
}
