"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useGameState, type GameState } from "./useGameState";
import type { PitchResult } from "@/components/game/PitchCounter";

// ---- Types ----

export interface InningScore {
  inning: number;
  inning_half: string;
  runs: number;
}

interface InputHolder {
  profileId: string;
  displayName: string;
}

export interface RecentAtBat {
  id: string;
  inning: number;
  inning_half: string;
  playerName: string;
  result: string;
  rbi: number;
  pitches: string[];
}

export interface UseRealtimeGameReturn extends GameState {
  inningScores: InningScore[];
  inputHolder: InputHolder | null;
  recentAtBats: RecentAtBat[];
  currentPitchLog: PitchResult[];
  reload: () => Promise<void>;
}

// ---- Hook ----

export function useRealtimeGame(gameId: string): UseRealtimeGameReturn {
  const gameState = useGameState(gameId);
  const supabase = createClient();

  const [inningScores, setInningScores] = useState<InningScore[]>([]);
  const [inputHolder, setInputHolder] = useState<InputHolder | null>(null);
  const [recentAtBats, setRecentAtBats] = useState<RecentAtBat[]>([]);
  const [currentPitchLog, setCurrentPitchLog] = useState<PitchResult[]>([]);

  // ---- Fetch supplementary data ----
  const fetchSupplementary = useCallback(async () => {
    // Fetch all three in parallel
    const [scoresResult, sessionResult, atBatsResult] = await Promise.all([
      supabase
        .from("v_scoreboard")
        .select("inning, inning_half, runs")
        .eq("game_id", gameId)
        .order("inning"),
      supabase
        .from("game_input_sessions")
        .select("profile_id, current_pitch_log")
        .eq("game_id", gameId)
        .maybeSingle(),
      supabase
        .from("at_bats")
        .select("id, inning, inning_half, result, rbi, lineups(player_name), pitches(pitch_number, result)")
        .eq("game_id", gameId)
        .not("result", "is", null)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    // Process scores
    setInningScores(
      (scoresResult.data ?? []).map((s) => ({
        inning: s.inning as number,
        inning_half: s.inning_half as string,
        runs: Number(s.runs),
      }))
    );

    // Process session holder (profile fetch depends on session result)
    const session = sessionResult.data;
    if (session) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", session.profile_id)
        .single();

      setInputHolder({
        profileId: session.profile_id,
        displayName: profile?.display_name ?? "不明",
      });
      setCurrentPitchLog(
        Array.isArray(session.current_pitch_log)
          ? (session.current_pitch_log as PitchResult[])
          : []
      );
    } else {
      setInputHolder(null);
      setCurrentPitchLog([]);
    }

    // Process recent at-bats
    setRecentAtBats(
      (atBatsResult.data ?? []).map((ab) => {
        const pitchRows = ab.pitches as { pitch_number: number; result: string }[] | null;
        const sortedPitches = (pitchRows ?? [])
          .sort((a, b) => a.pitch_number - b.pitch_number)
          .map((p) => p.result);
        return {
          id: ab.id,
          inning: ab.inning,
          inning_half: ab.inning_half,
          playerName:
            (ab.lineups as { player_name: string | null } | null)?.player_name ?? "—",
          result: ab.result!,
          rbi: ab.rbi,
          pitches: sortedPitches,
        };
      })
    );
  }, [gameId, supabase]);

  // Combined reload
  const reload = useCallback(async () => {
    await Promise.all([gameState.reload(), fetchSupplementary()]);
  }, [gameState, fetchSupplementary]);

  // ---- Initial load of supplementary data ----
  // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching on mount
  useEffect(() => { fetchSupplementary(); }, [fetchSupplementary]);

  // ---- Realtime subscriptions ----
  useEffect(() => {
    const channel = supabase
      .channel(`spectate-${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "at_bats",
          filter: `game_id=eq.${gameId}`,
        },
        () => {
          gameState.reload();
          fetchSupplementary();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "games",
          filter: `id=eq.${gameId}`,
        },
        () => {
          gameState.reload();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_input_sessions",
          filter: `game_id=eq.${gameId}`,
        },
        () => {
          fetchSupplementary();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, supabase, gameState, fetchSupplementary]);

  return {
    ...gameState,
    inningScores,
    inputHolder,
    recentAtBats,
    currentPitchLog,
    reload,
  };
}
