"use client";

import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useGameState, type BaseRunners } from "@/hooks/useGameState";
import { useGameSession } from "@/hooks/useGameSession";
import { recordAtBatAction, changePitcherAction, finishGameAction, recordStealAction, substitutePlayerAction, changePositionAction, undoLastAtBatAction, recordRunnerAdvanceAction } from "@/app/(main)/games/actions";
import { GameActionButtons } from "@/components/game/GameActionButtons";
import { LineupTable, type LineupRow } from "@/components/game/LineupTable";
import { FieldRunnerDisplay } from "@/components/field/FieldRunnerDisplay";
import { RunnerDestinationDiamond } from "@/components/field/RunnerDestinationDiamond";
import { AtBatInput } from "@/components/game/AtBatInput";
import { countFromLog, type PitchResult } from "@/components/game/PitchCounter";
import { InputLockBanner } from "@/components/game/InputLockBanner";
import { SessionRequestModal } from "@/components/game/SessionRequestModal";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Check, ChevronDown, ClipboardEdit, Loader2, RefreshCw, Undo2 } from "lucide-react";
import type { RunnerDest, RunnerRow } from "./types";

// ---- Default runner destinations per result ----

function getDefaultDestinations(
  result: string,
  runners: BaseRunners
): RunnerRow[] {
  const rows: RunnerRow[] = [];

  // 3rd base runner
  if (runners.third) {
    let dest: RunnerDest = "stay";
    if (["1B", "2B", "3B", "HR", "SH", "SF"].includes(result)) dest = "scored";
    // BB/IBB/HBP: forced if 1st AND 2nd are occupied
    else if (["BB", "IBB", "HBP"].includes(result) && runners.first && runners.second)
      dest = "scored";
    rows.push({
      lineupId: runners.third.id,
      playerName: runners.third.player_name ?? "—",
      fromBase: "3rd",
      destination: dest,
    });
  }

  // 2nd base runner
  if (runners.second) {
    let dest: RunnerDest = "stay";
    if (["2B", "3B", "HR"].includes(result)) dest = "scored";
    else if (result === "1B") dest = "3rd";
    else if (result === "SH") dest = "3rd";
    else if (result === "DP") dest = "stay";
    // BB/IBB/HBP: forced if 1st is occupied
    else if (["BB", "IBB", "HBP"].includes(result) && runners.first) dest = "3rd";
    rows.push({
      lineupId: runners.second.id,
      playerName: runners.second.player_name ?? "—",
      fromBase: "2nd",
      destination: dest,
    });
  }

  // 1st base runner
  if (runners.first) {
    let dest: RunnerDest = "stay";
    if (["3B", "HR"].includes(result)) dest = "scored";
    else if (result === "2B") dest = "3rd";
    else if (result === "1B") dest = "2nd";
    else if (result === "SH") dest = "2nd";
    else if (result === "DP") dest = "out";
    else if (["BB", "IBB", "HBP"].includes(result)) dest = "2nd";
    rows.push({
      lineupId: runners.first.id,
      playerName: runners.first.player_name ?? "—",
      fromBase: "1st",
      destination: dest,
    });
  }

  return rows;
}

function getDefaultBatterDest(result: string): RunnerDest {
  if (result === "HR") return "scored";
  if (result === "3B") return "3rd";
  if (result === "2B") return "2nd";
  if (["1B", "BB", "IBB", "HBP", "E", "FC"].includes(result)) return "1st";
  // Out results: K, KK, GO, FO, LO, DP, SF, SH
  return "out";
}

function isRunnerForced(
  fromBase: "1st" | "2nd" | "3rd",
  result: string,
  runners: BaseRunners
): boolean {
  // HR: all runners forced
  if (result === "HR") return true;

  // Batter goes to 1st: BB/IBB/HBP/1B/E/FC
  if (["BB", "IBB", "HBP", "1B", "E", "FC"].includes(result)) {
    if (fromBase === "1st") return true;
    if (fromBase === "2nd") return !!runners.first;
    if (fromBase === "3rd") return !!runners.first && !!runners.second;
  }

  // Batter goes to 2nd: 2B
  if (result === "2B") {
    if (fromBase === "2nd") return true;
    if (fromBase === "3rd") return !!runners.second;
    // 1st base runner is not forced by a double
  }

  // Batter goes to 3rd: 3B
  if (result === "3B") {
    if (fromBase === "3rd") return true;
    // 1st/2nd base runners are not forced by a triple
  }

  // Out results (K/KK/GO/FO/LO/DP/SF/SH): batter doesn't occupy a base
  return false;
}

function computeRbi(
  result: string,
  batterDest: RunnerDest,
  runnerRows: RunnerRow[]
): number {
  // RBI = number of runners who scored, excluding errors
  // For simplicity: count scored runners + batter if scored
  const runnerScored = runnerRows.filter((r) => r.destination === "scored").length;
  const batterScored = batterDest === "scored" ? 1 : 0;
  const total = runnerScored + batterScored;

  // No RBI on errors, wild pitch, etc. — but since we're simplifying,
  // we trust the user can manually adjust
  // No RBI on DP
  if (result === "DP") return 0;

  return total;
}

// ---- Destination options (filtered by runner position) ----

function getDestOptionsForBase(
  fromBase: "batter" | "1st" | "2nd" | "3rd",
  opts?: { forceAdvance?: boolean }
): { value: RunnerDest; label: string }[] {
  const forceAdvance = opts?.forceAdvance ?? false;

  let options: { value: RunnerDest; label: string }[];
  switch (fromBase) {
    case "3rd":
      options = [
        { value: "stay", label: "そのまま" },
        { value: "scored", label: "得点" },
        { value: "out", label: "OUT" },
      ];
      break;
    case "2nd":
      options = [
        { value: "stay", label: "そのまま" },
        { value: "3rd", label: "→3塁" },
        { value: "scored", label: "得点" },
        { value: "out", label: "OUT" },
      ];
      break;
    case "1st":
      options = [
        { value: "stay", label: "そのまま" },
        { value: "2nd", label: "→2塁" },
        { value: "3rd", label: "→3塁" },
        { value: "scored", label: "得点" },
        { value: "out", label: "OUT" },
      ];
      break;
    case "batter":
      options = [
        { value: "1st", label: "→1塁" },
        { value: "2nd", label: "→2塁" },
        { value: "3rd", label: "→3塁" },
        { value: "scored", label: "得点" },
        { value: "out", label: "OUT" },
      ];
      break;
  }

  if (forceAdvance) {
    options = options.filter((o) => o.value !== "stay");
  }

  return options;
}

// ---- Main page ----

export default function GameInputPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.id as string;

  // Auth: get current user id
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
    });
  }, []);

  const gameState = useGameState(gameId);
  const session = useGameSession(gameId, userId);

  // Confirm dialog state
  const [pendingResult, setPendingResult] = useState<{
    code: string;
    label: string;
  } | null>(null);

  // Runner dialog state
  const [runnerDialogOpen, setRunnerDialogOpen] = useState(false);
  const [runnerRows, setRunnerRows] = useState<RunnerRow[]>([]);
  const [batterDest, setBatterDest] = useState<RunnerDest>("1st");
  const [saving] = useState(false);

  // Change of innings dialog
  const [showInningChange, setShowInningChange] = useState(false);
  const [nextInningInfo, setNextInningInfo] = useState<{
    inning: number;
    half: "top" | "bottom";
  } | null>(null);

  // Pitcher change dialog
  const [showPitcherChange, setShowPitcherChange] = useState(false);
  const [selectedPitcherLineupId, setSelectedPitcherLineupId] = useState("");

  // Finish game dialog
  const [showFinishGame, setShowFinishGame] = useState(false);
  const [showInPlayDialog, setShowInPlayDialog] = useState(false);

  // Steal dialog state
  const [showStealDialog, setShowStealDialog] = useState(false);
  const [stealLineupId, setStealLineupId] = useState("");
  const [stealSaving] = useState(false);

  // Substitution dialog state
  const [showSubDialog, setShowSubDialog] = useState(false);
  const [subType, setSubType] = useState<"pinch_hitter" | "pinch_runner">("pinch_hitter");
  const [subTargetLineupId, setSubTargetLineupId] = useState(""); // runner lineup_id for pinch runner
  const [subNewPlayerId, setSubNewPlayerId] = useState<string | null>(null);
  const [subNewPlayerName, setSubNewPlayerName] = useState("");
  const [subNewPosition, setSubNewPosition] = useState("");
  const [subSaving] = useState(false);

  // Position change dialog state
  const [showPosChangeDialog, setShowPosChangeDialog] = useState(false);
  const [posChanges, setPosChanges] = useState<Record<string, string>>({}); // lineupId → position
  const [posSubstitutions, setPosSubstitutions] = useState<Record<string, {
    newPlayerId: string | null;
    newPlayerName: string;
  }>>({}); // lineupId → substitute player info
  const [posSubManualInput, setPosSubManualInput] = useState<Set<string>>(new Set()); // lineupIds using manual text input
  const [posChangeSaving] = useState(false);

  // Auto-save banner state
  const [autoSaveBanner, setAutoSaveBanner] = useState<{
    playerName: string;
    resultLabel: string;
  } | null>(null);

  // Track last result code between confirm and save
  const lastResultCode = useRef("");
  // Guard to prevent double-submit during background action
  const pendingActionRef = useRef(false);
  const [finishing, setFinishing] = useState(false);

  // Undo state
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  const [undoing] = useState(false);

  // WP/PB/BK dialog state
  const [showAdvanceDialog, setShowAdvanceDialog] = useState(false);
  const [advanceEventType, setAdvanceEventType] = useState<"wild_pitch" | "passed_ball" | "balk">("wild_pitch");
  const [advanceSelections, setAdvanceSelections] = useState<Record<string, string>>({}); // lineupId → toBase
  const [advanceSaving] = useState(false);

  // Pitch count state
  const [pitchLog, setPitchLog] = useState<PitchResult[]>([]);

  // Sync pitch log to DB for realtime spectate display
  const syncPitchLogToDb = useCallback(
    async (log: PitchResult[]) => {
      const supabase = createClient();
      await supabase
        .from("game_input_sessions")
        .update({ current_pitch_log: log })
        .eq("game_id", gameId);
    },
    [gameId]
  );

  // Error state
  const [actionError, setActionError] = useState<string | null>(null);

  // Compute current batter
  const battingTeamSide = gameState.currentHalf === "top" ? "visitor" : "home";
  const fieldingTeamSide = gameState.currentHalf === "top" ? "home" : "visitor";

  // Get batting lineup for current side — latest entry per batting_order (for substitutions)
  const battingLineup = useMemo(() => {
    if (!gameState.game) return [];
    const side = battingTeamSide;
    let lineups = gameState.lineups.filter((l) => l.team_side === side);

    if (gameState.game.use_dh) {
      // In DH games, there may be duplicate batting_orders (DH + pitcher)
      // Only include batting lineup (not position=投 for DH)
      const dhOrders = new Set(
        lineups.filter((l) => l.position === "DH").map((l) => l.batting_order)
      );
      lineups = lineups.filter(
        (l) => !(l.position === "投" && dhOrders.has(l.batting_order))
      );
    }

    // Keep only the latest entry per batting_order (highest inning_from)
    // Use >= so that later-inserted entries with the same inning_from win
    const latestByOrder = new Map<number, typeof lineups[number]>();
    for (const l of lineups) {
      const existing = latestByOrder.get(l.batting_order);
      if (!existing || l.inning_from >= existing.inning_from) {
        latestByOrder.set(l.batting_order, l);
      }
    }
    return Array.from(latestByOrder.values()).sort((a, b) => a.batting_order - b.batting_order);
  }, [gameState.lineups, gameState.game, battingTeamSide]);

  const currentBatter = battingLineup.find(
    (l) => l.batting_order === gameState.currentBatterOrder
  );

  // Auto-computed RBI from current runner/batter destinations
  const computedRbi = computeRbi(lastResultCode.current, batterDest, runnerRows);

  // Fielding team lineup — latest entry per batting_order
  const fieldingLineup = useMemo(() => {
    const lineups = gameState.lineups.filter((l) => l.team_side === fieldingTeamSide);
    const latestByOrder = new Map<number, typeof lineups[number]>();
    for (const l of lineups) {
      const existing = latestByOrder.get(l.batting_order);
      if (!existing || l.inning_from >= existing.inning_from) {
        latestByOrder.set(l.batting_order, l);
      }
    }
    return Array.from(latestByOrder.values()).sort((a, b) => a.batting_order - b.batting_order);
  }, [gameState.lineups, fieldingTeamSide]);

  // Determine own team side
  const ownTeamSide = gameState.game?.is_home ? "home" : "visitor";

  // Available players for substitution (own team, not yet in lineup)
  // Skip for free mode (no registered players)
  const [availablePlayers, setAvailablePlayers] = useState<{ id: string; name: string; number: string | null; position: string | null }[]>([]);
  useEffect(() => {
    if (!gameState.game) return;
    if (gameState.game.is_free_mode || !gameState.game.team_id) return;
    const fetchPlayers = async () => {
      const supabase = createClient();
      const { data: players } = await supabase
        .from("players")
        .select("id, name, number, position")
        .eq("team_id", gameState.game!.team_id!)
        .eq("is_active", true)
        .order("number");
      if (!players) return;
      // Exclude players already in lineup (by player_id)
      const usedPlayerIds = new Set(
        gameState.lineups.filter((l) => l.player_id).map((l) => l.player_id)
      );
      setAvailablePlayers(players.filter((p) => !usedPlayerIds.has(p.id)));
    };
    fetchPlayers();
  }, [gameState.game, gameState.lineups]);

  // Compute highlight code from pitch count
  const pitchCounts = useMemo(() => countFromLog(pitchLog), [pitchLog]);
  const highlightCode = useMemo(() => {
    if (pitchCounts.balls >= 4) return "BB";
    if (pitchCounts.strikes >= 3) {
      const lastPitch = pitchLog[pitchLog.length - 1];
      return lastPitch === "looking" ? "KK" : "K";
    }
    return null;
  }, [pitchCounts, pitchLog]);

  // Auto-dismiss banner after 5 seconds
  useEffect(() => {
    if (!autoSaveBanner) return;
    const timer = setTimeout(() => setAutoSaveBanner(null), 5000);
    return () => clearTimeout(timer);
  }, [autoSaveBanner]);

  // ---- Auto-save (no runners, deterministic result) ----

  const autoSaveAtBat = useCallback(
    (code: string, label: string, bDest: RunnerDest) => {
      if (!currentBatter || !gameState.game) return;
      if (pendingActionRef.current) return;

      setActionError(null);

      const baseRunnersBefore: { base: string; lineupId: string }[] = [];

      const destinations: { lineupId: string; event: "scored" | "out"; toBase: undefined }[] = [];
      if (bDest === "scored" || bDest === "out") {
        destinations.push({ lineupId: currentBatter.id, event: bDest, toBase: undefined });
      }

      const runnersAfter: { base: string; lineupId: string }[] = [];
      if (["1st", "2nd", "3rd"].includes(bDest)) {
        runnersAfter.push({ base: bDest, lineupId: currentBatter.id });
      }

      const rbi = computeRbi(code, bDest, []);

      // Optimistic UI update
      setAutoSaveBanner({
        playerName: currentBatter.player_name ?? "—",
        resultLabel: label,
      });
      setPendingResult(null);
      setPitchLog([]);
      syncPitchLogToDb([]);

      const outsFromResult = countOutsFromResult(code, bDest, []);
      const totalOuts = gameState.currentOuts + outsFromResult;

      if (totalOuts >= 3) {
        let nextHalf: "top" | "bottom";
        let nextInning: number;
        if (gameState.currentHalf === "top") {
          nextHalf = "bottom";
          nextInning = gameState.currentInning;
        } else {
          nextHalf = "top";
          nextInning = gameState.currentInning + 1;
        }
        setNextInningInfo({ inning: nextInning, half: nextHalf });
        setShowInningChange(true);
      } else {
        // Compute optimistic state
        const optimisticRunners: BaseRunners = { first: null, second: null, third: null };
        if (bDest === "1st") optimisticRunners.first = currentBatter;
        else if (bDest === "2nd") optimisticRunners.second = currentBatter;
        else if (bDest === "3rd") optimisticRunners.third = currentBatter;

        const scoreDelta = bDest === "scored" ? 1 : 0;
        const scoreKey = gameState.currentHalf === "top" ? "visitor" : "home";
        const otherKey = scoreKey === "home" ? "visitor" : "home";

        gameState.optimisticUpdate({
          currentOuts: gameState.currentOuts + outsFromResult,
          currentBatterOrder: (gameState.currentBatterOrder % 9) + 1,
          baseRunners: optimisticRunners,
          score: {
            [scoreKey]: gameState.score[scoreKey] + scoreDelta,
            [otherKey]: gameState.score[otherKey],
          } as { home: number; visitor: number },
        });
      }

      // Fire-and-forget server action
      pendingActionRef.current = true;
      void recordAtBatAction({
        gameId,
        inning: gameState.currentInning,
        inningHalf: gameState.currentHalf,
        battingOrder: gameState.currentBatterOrder,
        lineupId: currentBatter.id,
        result: code,
        rbi,
        pitchCount: pitchLog.length,
        pitches: pitchLog,
        baseRunnersBefore,
        runnerDestinations: destinations,
        runnersAfter,
      }).then(result => {
        pendingActionRef.current = false;
        if (result.error) setActionError(result.error);
        return gameState.reload(true);
      }).catch(() => {
        pendingActionRef.current = false;
        setActionError("通信エラーが発生しました");
      });
    },
    [currentBatter, gameState, gameId, pitchLog, syncPitchLogToDb]
  );

  // ---- Process result: auto-save or open runner dialog ----

  const processResult = useCallback(
    (code: string, label: string) => {
      if (!currentBatter) return;

      lastResultCode.current = code;
      const defaults = getDefaultDestinations(code, gameState.baseRunners);
      const bDest = getDefaultBatterDest(code);

      // No runners → auto-save (skip runner dialog)
      if (defaults.length === 0) {
        autoSaveAtBat(code, label, bDest);
        return;
      }

      // Has runners → open runner dialog directly (no confirm step)
      setPendingResult({ code, label }); // keep for display in dialog header
      setRunnerRows(defaults);
      setBatterDest(bDest);
      setRunnerDialogOpen(true);
    },
    [currentBatter, gameState.baseRunners, autoSaveAtBat]
  );

  // ---- Handlers ----

  const handlePitch = useCallback((result: PitchResult) => {
    const newLog = [...pitchLog, result];
    setPitchLog(newLog);
    syncPitchLogToDb(newLog);

    // Auto-result: check if count is full after this pitch
    const counts = countFromLog(newLog);
    if (counts.balls >= 4) {
      setActionError(null);
      processResult("BB", "四球");
    } else if (counts.strikes >= 3) {
      setActionError(null);
      if (result === "looking") {
        processResult("KK", "三振(見)");
      } else {
        processResult("K", "三振(空)");
      }
    }
  }, [pitchLog, syncPitchLogToDb, processResult]);

  const handleUndoPitch = useCallback(() => {
    setPitchLog((prev) => {
      const newLog = prev.slice(0, -1);
      syncPitchLogToDb(newLog);
      return newLog;
    });
  }, [syncPitchLogToDb]);

  const handleResultSelect = useCallback(
    (code: string, label: string) => {
      setShowInPlayDialog(false);
      setActionError(null);
      processResult(code, label);
    },
    [processResult]
  );

  const handleRunnerDestChange = useCallback(
    (lineupId: string, dest: RunnerDest) => {
      setRunnerRows((prev) =>
        prev.map((r) =>
          r.lineupId === lineupId ? { ...r, destination: dest } : r
        )
      );
    },
    []
  );

  const handleBatterDestChange = useCallback(
    (dest: RunnerDest) => {
      setBatterDest(dest);
    },
    []
  );

  const handleSaveAtBat = useCallback(() => {
    if (!currentBatter || !gameState.game) return;
    if (pendingActionRef.current) return;

    setActionError(null);

    // Build base_runners snapshot
    const baseRunnersBefore: { base: string; lineupId: string }[] = [];
    if (gameState.baseRunners.first)
      baseRunnersBefore.push({ base: "1st", lineupId: gameState.baseRunners.first.id });
    if (gameState.baseRunners.second)
      baseRunnersBefore.push({ base: "2nd", lineupId: gameState.baseRunners.second.id });
    if (gameState.baseRunners.third)
      baseRunnersBefore.push({ base: "3rd", lineupId: gameState.baseRunners.third.id });

    // Build runner events (scored/out for runner_events table)
    const destinations: { lineupId: string; event: "scored" | "out"; toBase: undefined }[] = [];
    for (const r of runnerRows) {
      if (r.destination === "scored" || r.destination === "out") {
        destinations.push({ lineupId: r.lineupId, event: r.destination, toBase: undefined });
      }
    }
    if (batterDest === "scored" || batterDest === "out") {
      destinations.push({ lineupId: currentBatter.id, event: batterDest, toBase: undefined });
    }

    // Build runners_after: who is on which base after this at-bat
    const runnersAfter: { base: string; lineupId: string }[] = [];
    for (const r of runnerRows) {
      if (r.destination === "stay") {
        runnersAfter.push({ base: r.fromBase, lineupId: r.lineupId });
      } else if (["1st", "2nd", "3rd"].includes(r.destination)) {
        runnersAfter.push({ base: r.destination, lineupId: r.lineupId });
      }
    }
    if (["1st", "2nd", "3rd"].includes(batterDest)) {
      runnersAfter.push({ base: batterDest, lineupId: currentBatter.id });
    }

    const resultCode = lastResultCode.current;

    // Close dialog immediately (optimistic)
    setRunnerDialogOpen(false);
    setPendingResult(null);
    setPitchLog([]);
    syncPitchLogToDb([]);

    // Compute optimistic state
    const outsFromResult = countOutsFromResult(resultCode, batterDest, runnerRows);
    const totalOuts = gameState.currentOuts + outsFromResult;

    if (totalOuts >= 3) {
      let nextHalf: "top" | "bottom";
      let nextInning: number;
      if (gameState.currentHalf === "top") {
        nextHalf = "bottom";
        nextInning = gameState.currentInning;
      } else {
        nextHalf = "top";
        nextInning = gameState.currentInning + 1;
      }
      setNextInningInfo({ inning: nextInning, half: nextHalf });
      setShowInningChange(true);
    } else {
      // Build optimistic runners from runnersAfter
      const findLineup = (lineupId: string) =>
        gameState.lineups.find((l) => l.id === lineupId) ?? null;
      const optimisticRunners: BaseRunners = { first: null, second: null, third: null };
      for (const ra of runnersAfter) {
        const player = findLineup(ra.lineupId);
        if (ra.base === "1st") optimisticRunners.first = player;
        else if (ra.base === "2nd") optimisticRunners.second = player;
        else if (ra.base === "3rd") optimisticRunners.third = player;
      }

      const scoredCount = runnerRows.filter((r) => r.destination === "scored").length
        + (batterDest === "scored" ? 1 : 0);
      const scoreKey = gameState.currentHalf === "top" ? "visitor" : "home";
      const otherKey = scoreKey === "home" ? "visitor" : "home";

      gameState.optimisticUpdate({
        currentOuts: gameState.currentOuts + outsFromResult,
        currentBatterOrder: (gameState.currentBatterOrder % 9) + 1,
        baseRunners: optimisticRunners,
        score: {
          [scoreKey]: gameState.score[scoreKey] + scoredCount,
          [otherKey]: gameState.score[otherKey],
        } as { home: number; visitor: number },
      });
    }

    // Fire-and-forget server action
    pendingActionRef.current = true;
    void recordAtBatAction({
      gameId,
      inning: gameState.currentInning,
      inningHalf: gameState.currentHalf,
      battingOrder: gameState.currentBatterOrder,
      lineupId: currentBatter.id,
      result: resultCode,
      rbi: computedRbi,
      pitchCount: pitchLog.length,
      pitches: pitchLog,
      baseRunnersBefore,
      runnerDestinations: destinations,
      runnersAfter,
    }).then(result => {
      pendingActionRef.current = false;
      if (result.error) setActionError(result.error);
      return gameState.reload(true);
    }).catch(() => {
      pendingActionRef.current = false;
      setActionError("通信エラーが発生しました");
    });
  }, [
    currentBatter,
    gameState,
    gameId,
    runnerRows,
    batterDest,
    computedRbi,
    pitchLog,
    syncPitchLogToDb,
  ]);

  const handleInningChangeConfirm = useCallback(async () => {
    setShowInningChange(false);
    setNextInningInfo(null);
    await gameState.reload(true);
  }, [gameState]);

  const handlePitcherChangeConfirm = useCallback(() => {
    if (!selectedPitcherLineupId || !gameState.game) return;
    if (pendingActionRef.current) return;

    setShowPitcherChange(false);
    setSelectedPitcherLineupId("");

    pendingActionRef.current = true;
    void changePitcherAction({
      gameId,
      currentInning: gameState.currentInning,
      newPitcherLineupId: selectedPitcherLineupId,
      fieldingTeamSide,
    }).then(result => {
      pendingActionRef.current = false;
      if (result.error) setActionError(result.error);
      return gameState.reload(true);
    }).catch(() => {
      pendingActionRef.current = false;
      setActionError("通信エラーが発生しました");
    });
  }, [selectedPitcherLineupId, gameState, gameId, fieldingTeamSide]);

  const handleFinishGame = useCallback(async () => {
    setFinishing(true);
    const result = await finishGameAction(gameId);
    setFinishing(false);

    if (result.error) {
      setActionError(result.error);
      return;
    }

    router.push(`/games/${gameId}`);
  }, [gameId, router]);

  // ---- Undo handler ----

  const handleUndo = useCallback(() => {
    if (pendingActionRef.current) return;

    setActionError(null);
    setShowUndoConfirm(false);
    setPitchLog([]);
    syncPitchLogToDb([]);

    pendingActionRef.current = true;
    void undoLastAtBatAction(gameId).then(result => {
      pendingActionRef.current = false;
      if (result.error) setActionError(result.error);
      return gameState.reload(true);
    }).catch(() => {
      pendingActionRef.current = false;
      setActionError("通信エラーが発生しました");
    });
  }, [gameId, gameState, syncPitchLogToDb]);

  // ---- WP/PB/BK handler ----

  const advanceRunnerOptions = useMemo(() => {
    const options: { lineupId: string; playerName: string; fromBase: "1st" | "2nd" | "3rd"; defaultToBase: string }[] = [];
    if (gameState.baseRunners.first) {
      options.push({
        lineupId: gameState.baseRunners.first.id,
        playerName: gameState.baseRunners.first.player_name ?? "—",
        fromBase: "1st",
        defaultToBase: "2nd",
      });
    }
    if (gameState.baseRunners.second) {
      options.push({
        lineupId: gameState.baseRunners.second.id,
        playerName: gameState.baseRunners.second.player_name ?? "—",
        fromBase: "2nd",
        defaultToBase: "3rd",
      });
    }
    if (gameState.baseRunners.third) {
      options.push({
        lineupId: gameState.baseRunners.third.id,
        playerName: gameState.baseRunners.third.player_name ?? "—",
        fromBase: "3rd",
        defaultToBase: "home",
      });
    }
    return options;
  }, [gameState.baseRunners]);

  const handleRunnerAdvance = useCallback(() => {
    if (pendingActionRef.current) return;

    const advances = Object.entries(advanceSelections)
      .filter(([, toBase]) => toBase !== "stay")
      .map(([lineupId, toBase]) => {
        const runner = advanceRunnerOptions.find((r) => r.lineupId === lineupId);
        return {
          lineupId,
          fromBase: runner!.fromBase,
          toBase: toBase as "2nd" | "3rd" | "home",
        };
      });

    if (advances.length === 0) {
      setActionError("進塁する走者を選択してください");
      return;
    }

    setActionError(null);
    setShowAdvanceDialog(false);
    setAdvanceSelections({});

    pendingActionRef.current = true;
    void recordRunnerAdvanceAction({
      gameId,
      eventType: advanceEventType,
      advances,
    }).then(result => {
      pendingActionRef.current = false;
      if (result.error) setActionError(result.error);
      return gameState.reload(true);
    }).catch(() => {
      pendingActionRef.current = false;
      setActionError("通信エラーが発生しました");
    });
  }, [advanceSelections, advanceRunnerOptions, gameId, advanceEventType, gameState]);

  // Build runner options for steal dialog (only runners whose next base is empty)
  const stealRunnerOptions = useMemo(() => {
    const options: { lineupId: string; playerName: string; fromBase: "1st" | "2nd" | "3rd" }[] = [];
    // 1st → 2nd: only if 2nd is empty
    if (gameState.baseRunners.first && !gameState.baseRunners.second) {
      options.push({
        lineupId: gameState.baseRunners.first.id,
        playerName: gameState.baseRunners.first.player_name ?? "—",
        fromBase: "1st",
      });
    }
    // 2nd → 3rd: only if 3rd is empty
    if (gameState.baseRunners.second && !gameState.baseRunners.third) {
      options.push({
        lineupId: gameState.baseRunners.second.id,
        playerName: gameState.baseRunners.second.player_name ?? "—",
        fromBase: "2nd",
      });
    }
    // 3rd → home: always possible
    if (gameState.baseRunners.third) {
      options.push({
        lineupId: gameState.baseRunners.third.id,
        playerName: gameState.baseRunners.third.player_name ?? "—",
        fromBase: "3rd",
      });
    }
    return options;
  }, [gameState.baseRunners]);

  const handleSteal = useCallback((eventType: "stolen_base" | "caught_stealing") => {
    if (pendingActionRef.current) return;

    const runner = stealRunnerOptions.find((r) => r.lineupId === stealLineupId);
    if (!runner) return;

    setActionError(null);
    setShowStealDialog(false);
    setStealLineupId("");

    pendingActionRef.current = true;
    void recordStealAction({
      gameId,
      lineupId: runner.lineupId,
      eventType,
      fromBase: runner.fromBase,
    }).then(result => {
      pendingActionRef.current = false;
      if (result.error) setActionError(result.error);
      return gameState.reload(true);
    }).catch(() => {
      pendingActionRef.current = false;
      setActionError("通信エラーが発生しました");
    });
  }, [stealLineupId, stealRunnerOptions, gameId, gameState]);

  // ---- Substitution handler ----

  const handleSubstitution = useCallback(() => {
    if (!gameState.game || !subNewPlayerName.trim()) return;
    if (pendingActionRef.current) return;

    setActionError(null);

    // Determine target batting order and team side
    let targetBattingOrder: number;
    let targetTeamSide: "home" | "visitor";

    if (subType === "pinch_hitter") {
      if (!currentBatter) return;
      targetBattingOrder = currentBatter.batting_order;
      targetTeamSide = battingTeamSide as "home" | "visitor";
    } else {
      // pinch runner: find the runner's batting order
      const runner = gameState.lineups.find((l) => l.id === subTargetLineupId);
      if (!runner) return;
      targetBattingOrder = runner.batting_order;
      targetTeamSide = runner.team_side as "home" | "visitor";
    }

    setShowSubDialog(false);
    setSubNewPlayerId(null);
    setSubNewPlayerName("");
    setSubNewPosition("");
    setSubTargetLineupId("");

    pendingActionRef.current = true;
    void substitutePlayerAction({
      gameId,
      battingOrder: targetBattingOrder,
      teamSide: targetTeamSide,
      newPlayerId: subNewPlayerId,
      newPlayerName: subNewPlayerName.trim(),
      newPosition: subNewPosition || currentBatter?.position || "",
      currentInning: gameState.currentInning,
      type: subType,
      replacedLineupId: subType === "pinch_runner" ? subTargetLineupId : undefined,
    }).then(result => {
      pendingActionRef.current = false;
      if (result.error) setActionError(result.error);
      return gameState.reload(true);
    }).catch(() => {
      pendingActionRef.current = false;
      setActionError("通信エラーが発生しました");
    });
  }, [gameState, gameId, subType, subNewPlayerId, subNewPlayerName, subNewPosition, subTargetLineupId, currentBatter, battingTeamSide]);

  // ---- Position change handler ----

  const handlePositionChange = useCallback(() => {
    if (!gameState.game) return;
    if (pendingActionRef.current) return;

    const subEntries = Object.entries(posSubstitutions).filter(
      ([, sub]) => sub.newPlayerName.trim()
    );

    const posOnlyChanges = Object.entries(posChanges)
      .filter(([lineupId, newPos]) => {
        if (posSubstitutions[lineupId]) return false; // handled as substitution
        const lineup = fieldingLineup.find((l) => l.id === lineupId);
        return lineup && lineup.position !== newPos;
      })
      .map(([lineupId, newPosition]) => ({ lineupId, newPosition }));

    if (subEntries.length === 0 && posOnlyChanges.length === 0) {
      setShowPosChangeDialog(false);
      return;
    }

    setActionError(null);
    setShowPosChangeDialog(false);
    setPosChanges({});
    setPosSubstitutions({});

    pendingActionRef.current = true;

    const runPosChange = async () => {
      // 1. Process substitutions first
      for (const [lineupId, sub] of subEntries) {
        const lineup = fieldingLineup.find((l) => l.id === lineupId);
        if (!lineup) continue;

        const result = await substitutePlayerAction({
          gameId,
          battingOrder: lineup.batting_order,
          teamSide: fieldingTeamSide as "home" | "visitor",
          newPlayerId: sub.newPlayerId,
          newPlayerName: sub.newPlayerName.trim(),
          newPosition: posChanges[lineupId] ?? lineup.position ?? "",
          currentInning: gameState.currentInning,
          type: "pinch_hitter",
        });

        if (result.error) {
          pendingActionRef.current = false;
          setActionError(result.error);
          return;
        }
      }

      // 2. Process position-only changes
      if (posOnlyChanges.length > 0) {
        const result = await changePositionAction({
          gameId,
          changes: posOnlyChanges,
        });

        if (result.error) {
          pendingActionRef.current = false;
          setActionError(result.error);
          return;
        }
      }

      pendingActionRef.current = false;
      await gameState.reload(true);
    };

    void runPosChange().catch(() => {
      pendingActionRef.current = false;
      setActionError("通信エラーが発生しました");
    });
  }, [gameState, gameId, posChanges, posSubstitutions, fieldingLineup, fieldingTeamSide]);

  // ---- Loading / error states ----

  if (gameState.loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (gameState.error || !gameState.game) {
    return (
      <div className="space-y-4 text-center py-16">
        <p className="text-destructive">{gameState.error ?? "試合データが見つかりません"}</p>
        <Button variant="outline" onClick={() => router.push(`/games/${gameId}`)}>
          試合詳細に戻る
        </Button>
      </div>
    );
  }

  if (gameState.game.status !== "in_progress" && gameState.game.status !== "scheduled") {
    return (
      <div className="space-y-4 text-center py-16">
        <p className="text-muted-foreground">この試合は記録入力中ではありません</p>
        <Button variant="outline" onClick={() => router.push(`/games/${gameId}`)}>
          試合詳細に戻る
        </Button>
      </div>
    );
  }

  // ---- SCHEDULED view: show lineup + action buttons ----
  if (gameState.game.status === "scheduled") {
    const myTeamSide = gameState.game.is_home ? "home" : "visitor";
    const lineupRows: LineupRow[] = gameState.lineups
      .filter((l) => l.team_side === myTeamSide)
      .map((l) => ({
        id: l.id,
        batting_order: l.batting_order,
        team_side: l.team_side,
        player_name: l.player_name,
        position: l.position,
        inning_from: l.inning_from,
      }));
    const hasLineup = lineupRows.length > 0;

    return (
      <div className="space-y-4 pb-8">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            トップへ戻る
          </button>
        </div>

        <h1 className="text-xl font-bold">
          {gameState.myTeamName} vs {gameState.game.opponent_name}
        </h1>

        {hasLineup && (
          <LineupTable title={gameState.myTeamName} lineup={lineupRows} dhPitcher={null} />
        )}
        {!hasLineup && (
          <p className="text-muted-foreground text-center py-8">
            オーダーが未登録です
          </p>
        )}

        <div className="space-y-3">
          <Link href={`/games/${gameId}/lineup`}>
            <Button
              size="lg"
              variant="outline"
              className="w-full min-h-16 text-lg"
            >
              <ClipboardEdit className="mr-2 h-5 w-5" />
              オーダーを編集する
            </Button>
          </Link>
          <GameActionButtons gameId={gameId} hasLineup={hasLineup} onStarted={() => gameState.reload()} />
        </div>
      </div>
    );
  }

  // Session loading
  if (session.loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Session released (e.g. force release by admin) — no session exists
  if (!session.isMySession && !session.currentHolder && !session.loading) {
    return (
      <div className="space-y-4 pb-8">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push(`/games/${gameId}`)}
            className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            試合詳細
          </button>
        </div>
        <div className="text-center space-y-4 py-8">
          <p className="text-muted-foreground">入力セッションが解除されました</p>
          <Button onClick={() => router.refresh()}>
            再接続する
          </Button>
        </div>
      </div>
    );
  }

  // Locked by another user
  if (!session.isMySession && session.currentHolder) {
    return (
      <div className="space-y-4 pb-8">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push(`/games/${gameId}`)}
            className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            試合詳細
          </button>
        </div>
        <InputLockBanner
          holderName={session.currentHolder.display_name}
          hasPendingRequest={!!session.myPendingRequest}
          wasRejected={session.wasRejected}
          onRequestSession={session.requestSession}
        />
      </div>
    );
  }

  const positionLabel = currentBatter?.position ?? "";
  const numberPrefix = currentBatter?.player_number ? `#${currentBatter.player_number} ` : "";
  const batterOrderLabel = currentBatter
    ? `${gameState.currentBatterOrder}番・${positionLabel}`
    : "";
  const batterName = currentBatter
    ? `${numberPrefix}${currentBatter.player_name ?? "—"}`
    : "—";

  const halfLabel = gameState.currentHalf === "top" ? "表" : "裏";
  const myScore = gameState.game.is_home ? gameState.score.home : gameState.score.visitor;
  const opponentScore = gameState.game.is_home ? gameState.score.visitor : gameState.score.home;
  const { balls, strikes } = pitchCounts;
  const countFull = balls >= 4 || strikes >= 3;
  const hasRunners = !!(gameState.baseRunners.first || gameState.baseRunners.second || gameState.baseRunners.third);

  return (
    <div className="flex flex-col gap-3 pb-4">
      {/* Session request modal (shown to current holder) */}
      {session.pendingRequest && (
        <SessionRequestModal
          requesterName={session.pendingRequest.requester_name}
          requestId={session.pendingRequest.id}
          requestCreatedAt={session.pendingRequest.created_at}
          onApprove={session.approveRequest}
          onReject={session.rejectRequest}
        />
      )}

      {/* ── Compact info bar ── */}
      <div className="flex items-center justify-between bg-muted rounded-lg px-3 py-2">
        <div className="flex items-center gap-2 font-bold">
          <span className="text-sm">{gameState.myTeamName}</span>
          <span className="text-xl tabular-nums">{myScore} - {opponentScore}</span>
          <span className="text-sm">{gameState.game.opponent_name}</span>
        </div>
        <span className="text-sm font-medium">{gameState.currentInning}回{halfLabel}</span>
      </div>

      {/* ── Auto-save banner ── */}
      {autoSaveBanner && (
        <div className="flex items-center justify-between bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
          <span className="text-sm font-medium text-green-800 dark:text-green-200 flex items-center gap-1">
            <Check className="h-4 w-4" />
            {autoSaveBanner.playerName} → {autoSaveBanner.resultLabel} を記録
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="text-green-800 dark:text-green-200 hover:text-green-900 dark:hover:text-green-100"
            onClick={() => {
              setAutoSaveBanner(null);
              handleUndo();
            }}
          >
            取消
          </Button>
        </div>
      )}

      {/* ── Diamond + BSO count ── */}
      <div className="flex items-start gap-2 sm:gap-4 px-1">
        {/* Diamond */}
        <div className="shrink-0">
          <FieldRunnerDisplay baseRunners={gameState.baseRunners} className="w-20 h-20 sm:w-24 sm:h-24" />
        </div>

        {/* BSO count (vertical) */}
        <div className="flex-1 space-y-1.5 pt-1">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold w-5">B</span>
            <div className="flex gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-6 h-6 rounded-full ${
                    i < balls ? "bg-green-500" : "bg-muted border border-border"
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold w-5">S</span>
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`w-6 h-6 rounded-full ${
                    i < strikes ? "bg-yellow-500" : "bg-muted border border-border"
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold w-5">O</span>
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`w-6 h-6 rounded-full ${
                    i < gameState.currentOuts ? "bg-red-500" : "bg-muted border border-border"
                  }`}
                />
              ))}
            </div>
            <Badge variant="outline" className="ml-auto tabular-nums">{pitchLog.length}球</Badge>
          </div>
        </div>
      </div>

      {/* ── Current batter (full width) ── */}
      <div className="flex items-baseline gap-2 px-1">
        {batterOrderLabel && (
          <span className="text-sm text-muted-foreground shrink-0">{batterOrderLabel}</span>
        )}
        <span className="text-base font-bold truncate">{batterName}</span>
      </div>

      {/* ── Runner action trigger ── */}
      <Button
        variant="outline"
        size="default"
        className="w-full"
        disabled={!hasRunners}
        onClick={() => {
          // Open a runner operations menu via steal dialog by default
          setShowStealDialog(true);
          setStealLineupId("");
          setActionError(null);
        }}
      >
        盗塁 / 進塁 / アウト
      </Button>

      {/* ── Pitch buttons (row 1) ── */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          size="lg"
          variant="outline"
          className="min-h-14 text-base"
          disabled={saving || countFull}
          onClick={() => handlePitch("ball")}
        >
          ボール
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="min-h-14 text-base"
          disabled={saving || countFull}
          onClick={() => handlePitch("looking")}
        >
          見逃し
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="min-h-14 text-base"
          disabled={saving || countFull}
          onClick={() => handlePitch("swinging")}
        >
          空振り
        </Button>
      </div>

      {/* ── Pitch buttons (row 2): Foul + In Play ── */}
      <div className="grid grid-cols-5 gap-2">
        <Button
          size="lg"
          variant="outline"
          className="col-span-2 min-h-14 text-base"
          disabled={saving || countFull}
          onClick={() => handlePitch("foul")}
        >
          ファウル
        </Button>
        <Button
          size="lg"
          variant="default"
          className="col-span-3 min-h-14 text-base font-bold"
          disabled={saving}
          onClick={() => setShowInPlayDialog(true)}
        >
          ★ インプレイ
        </Button>
      </div>

      {/* ── Utility row ── */}
      <div className="grid grid-cols-4 gap-2 border-t pt-3">
        <Button
          variant="outline"
          size="default"
          className="text-sm"
          disabled={pitchLog.length === 0}
          onClick={handleUndoPitch}
        >
          <Undo2 className="mr-1 h-4 w-4" />
          戻す
        </Button>
        <Button
          variant="outline"
          size="default"
          className="text-sm"
          onClick={() => {
            setSubType("pinch_hitter");
            setSubNewPlayerId(null);
            setSubNewPlayerName("");
            setSubNewPosition(currentBatter?.position ?? "");
            setSubTargetLineupId("");
            setShowSubDialog(true);
            setActionError(null);
          }}
        >
          選手交代
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="default" className="text-sm">
              その他
              <ChevronDown className="ml-1 h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            <DropdownMenuItem
              disabled={advanceRunnerOptions.length === 0}
              onClick={() => {
                setAdvanceEventType("wild_pitch");
                const init: Record<string, string> = {};
                for (const r of advanceRunnerOptions) {
                  init[r.lineupId] = r.defaultToBase;
                }
                setAdvanceSelections(init);
                setShowAdvanceDialog(true);
                setActionError(null);
              }}
            >
              WP / PB / BK
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                const init: Record<string, string> = {};
                for (const l of fieldingLineup) {
                  init[l.id] = l.position ?? "";
                }
                setPosChanges(init);
                setPosSubstitutions({});
                setPosSubManualInput(new Set());
                setShowPosChangeDialog(true);
                setActionError(null);
              }}
            >
              守備変更
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setShowPitcherChange(true);
                setActionError(null);
              }}
            >
              投手交代
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setShowUndoConfirm(true);
                setActionError(null);
              }}
            >
              打席取消
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-muted-foreground"
              onClick={() => {
                setShowFinishGame(true);
                setActionError(null);
              }}
            >
              試合終了
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push(`/games/${gameId}`)}
            >
              ← 試合詳細
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="outline"
          size="default"
          className="text-sm"
          onClick={() => gameState.reload()}
        >
          <RefreshCw className="mr-1 h-4 w-4" />
          更新
        </Button>
      </div>

      {actionError && (
        <p className="text-destructive text-sm text-center">{actionError}</p>
      )}

      {/* ── In Play dialog (AtBatInput) ── */}
      <Dialog open={showInPlayDialog} onOpenChange={setShowInPlayDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>打席結果を選択</DialogTitle>
          </DialogHeader>
          <AtBatInput onSelect={handleResultSelect} disabled={saving} highlightCode={highlightCode} />
        </DialogContent>
      </Dialog>

      {/* ---- Runner / scoring dialog (also serves as confirmation) ---- */}
      <Dialog
        open={runnerDialogOpen}
        onOpenChange={(open) => {
          setRunnerDialogOpen(open);
          if (!open) setPendingResult(null);
        }}
      >
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>走者・得点入力</DialogTitle>
          </DialogHeader>

          {/* Result display */}
          {pendingResult && (
            <div className="bg-muted rounded-lg px-3 py-2 text-sm">
              <span className="text-muted-foreground">打席結果: </span>
              <span className="font-bold">{pendingResult.label}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Diamond runner destination UI */}
            <RunnerDestinationDiamond
              runnerRows={runnerRows}
              batter={{
                lineupId: currentBatter?.id ?? "",
                playerName: currentBatter?.player_name ?? "—",
                destination: batterDest,
              }}
              getDestOptions={(fromBase) =>
                getDestOptionsForBase(fromBase, {
                  forceAdvance:
                    fromBase !== "batter" &&
                    isRunnerForced(fromBase as "1st" | "2nd" | "3rd", lastResultCode.current, gameState.baseRunners),
                }).map((o) => o.value)
              }
              onRunnerDestChange={handleRunnerDestChange}
              onBatterDestChange={handleBatterDestChange}
              className="w-full max-w-[320px] mx-auto"
            />

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-full bg-blue-600" /> 走者
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-full bg-amber-600" /> 打者
              </span>
              <span>タップで選択→移動先をタップ</span>
            </div>

          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRunnerDialogOpen(false);
                setPendingResult(null);
              }}
            >
              キャンセル
            </Button>
            <Button onClick={handleSaveAtBat} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              確定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Inning change dialog ---- */}
      <AlertDialog open={showInningChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>攻守交代</AlertDialogTitle>
            <AlertDialogDescription>
              3アウトチェンジ。
              {nextInningInfo &&
                `${nextInningInfo.inning}回${nextInningInfo.half === "top" ? "表" : "裏"}に進みます。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleInningChangeConfirm}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ---- Pitcher change dialog ---- */}
      <Dialog open={showPitcherChange} onOpenChange={setShowPitcherChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>投手交代</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">新しい投手を選択</label>
            <Select
              value={selectedPitcherLineupId}
              onValueChange={setSelectedPitcherLineupId}
            >
              <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder="投手を選択" />
              </SelectTrigger>
              <SelectContent>
                {fieldingLineup.map((l) => (
                  <SelectItem key={l.id} value={l.id} className="text-base">
                    {l.player_name ?? "—"} ({l.position})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPitcherChange(false)}
            >
              キャンセル
            </Button>
            <Button
              onClick={handlePitcherChangeConfirm}
              disabled={!selectedPitcherLineupId || saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              交代する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Finish game dialog ---- */}
      <AlertDialog open={showFinishGame} onOpenChange={setShowFinishGame}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>試合を終了しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              試合ステータスが「終了」に変更されます。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleFinishGame} disabled={finishing}>
              {finishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              終了する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ---- Steal dialog ---- */}
      <Dialog open={showStealDialog} onOpenChange={setShowStealDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>盗塁</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">走者を選択</label>
              <Select value={stealLineupId} onValueChange={setStealLineupId}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="走者を選択" />
                </SelectTrigger>
                <SelectContent>
                  {stealRunnerOptions.map((r) => (
                    <SelectItem key={r.lineupId} value={r.lineupId} className="text-base">
                      {r.fromBase === "1st" ? "1塁" : r.fromBase === "2nd" ? "2塁" : "3塁"}: {r.playerName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3">
              <Button
                size="lg"
                className="flex-1 min-h-16 text-lg"
                disabled={!stealLineupId || stealSaving}
                onClick={() => handleSteal("stolen_base")}
              >
                {stealSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                成功
              </Button>
              <Button
                size="lg"
                variant="destructive"
                className="flex-1 min-h-16 text-lg"
                disabled={!stealLineupId || stealSaving}
                onClick={() => handleSteal("caught_stealing")}
              >
                {stealSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                失敗
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---- Substitution dialog ---- */}
      <Dialog open={showSubDialog} onOpenChange={setShowSubDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>選手交代</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Type toggle */}
            <div className="flex gap-2">
              <Button
                variant={subType === "pinch_hitter" ? "default" : "outline"}
                size="lg"
                className="flex-1"
                onClick={() => {
                  setSubType("pinch_hitter");
                  setSubTargetLineupId("");
                }}
              >
                代打
              </Button>
              <Button
                variant={subType === "pinch_runner" ? "default" : "outline"}
                size="lg"
                className="flex-1"
                onClick={() => setSubType("pinch_runner")}
              >
                代走
              </Button>
            </div>

            {/* Target display */}
            {subType === "pinch_hitter" && currentBatter && (
              <div className="text-sm text-muted-foreground">
                対象: {currentBatter.batting_order}番 {currentBatter.player_name}（{currentBatter.position}）
              </div>
            )}

            {/* Pinch runner: select which runner to replace */}
            {subType === "pinch_runner" && (
              <div className="space-y-1">
                <label className="text-sm font-medium">走者を選択</label>
                <Select value={subTargetLineupId} onValueChange={setSubTargetLineupId}>
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue placeholder="走者を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {gameState.baseRunners.first && (
                      <SelectItem value={gameState.baseRunners.first.id} className="text-base">
                        1塁: {gameState.baseRunners.first.player_name}
                      </SelectItem>
                    )}
                    {gameState.baseRunners.second && (
                      <SelectItem value={gameState.baseRunners.second.id} className="text-base">
                        2塁: {gameState.baseRunners.second.player_name}
                      </SelectItem>
                    )}
                    {gameState.baseRunners.third && (
                      <SelectItem value={gameState.baseRunners.third.id} className="text-base">
                        3塁: {gameState.baseRunners.third.player_name}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* New player selection */}
            {(() => {
              const targetSide = subType === "pinch_hitter"
                ? battingTeamSide
                : (gameState.lineups.find((l) => l.id === subTargetLineupId)?.team_side ?? battingTeamSide);
              const isOwnTeam = targetSide === ownTeamSide;

              return isOwnTeam && availablePlayers.length > 0 ? (
                <div className="space-y-1">
                  <label className="text-sm font-medium">交代選手</label>
                  <Select
                    value={subNewPlayerId ?? ""}
                    onValueChange={(val) => {
                      const player = availablePlayers.find((p) => p.id === val);
                      if (player) {
                        setSubNewPlayerId(player.id);
                        setSubNewPlayerName(player.name);
                        setSubNewPosition(player.position ?? currentBatter?.position ?? "");
                      }
                    }}
                  >
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder="選手を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePlayers.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-base">
                          {p.number ? `#${p.number} ` : ""}{p.name}{p.position ? `（${p.position}）` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-sm font-medium">交代選手名</label>
                  <Input
                    className="text-lg h-14"
                    placeholder="選手名を入力"
                    value={subNewPlayerName}
                    onChange={(e) => setSubNewPlayerName(e.target.value)}
                  />
                </div>
              );
            })()}

            {/* Position select */}
            <div className="space-y-1">
              <label className="text-sm font-medium">守備位置</label>
              <Select value={subNewPosition} onValueChange={setSubNewPosition}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="守備位置" />
                </SelectTrigger>
                <SelectContent>
                  {["投", "捕", "一", "二", "三", "遊", "左", "中", "右", "DH"].map((pos) => (
                    <SelectItem key={pos} value={pos} className="text-base">{pos}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubDialog(false)}>
              キャンセル
            </Button>
            <Button
              disabled={
                subSaving ||
                !subNewPlayerName.trim() ||
                (subType === "pinch_runner" && !subTargetLineupId)
              }
              onClick={handleSubstitution}
            >
              {subSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              交代する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Undo confirm dialog ---- */}
      <AlertDialog open={showUndoConfirm} onOpenChange={setShowUndoConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>直前の打席を取り消しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              直前に記録した打席結果を取り消します。投手成績も元に戻されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleUndo} disabled={undoing}>
              {undoing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              取り消す
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ---- WP/PB/BK dialog ---- */}
      <Dialog open={showAdvanceDialog} onOpenChange={setShowAdvanceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>WP / PB / BK</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Event type selection */}
            <div className="flex gap-2">
              {(["wild_pitch", "passed_ball", "balk"] as const).map((type) => (
                <Button
                  key={type}
                  variant={advanceEventType === type ? "default" : "outline"}
                  size="lg"
                  className="flex-1"
                  onClick={() => setAdvanceEventType(type)}
                >
                  {type === "wild_pitch" ? "WP" : type === "passed_ball" ? "PB" : "BK"}
                </Button>
              ))}
            </div>

            {/* Runner advance selections */}
            {advanceRunnerOptions.map((runner) => (
              <div key={runner.lineupId} className="space-y-1">
                <label className="text-sm font-medium">
                  {runner.fromBase === "1st" ? "1塁" : runner.fromBase === "2nd" ? "2塁" : "3塁"}走者: {runner.playerName}
                </label>
                <Select
                  value={advanceSelections[runner.lineupId] ?? "stay"}
                  onValueChange={(v) => setAdvanceSelections((prev) => ({ ...prev, [runner.lineupId]: v }))}
                >
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stay" className="text-base">そのまま</SelectItem>
                    {runner.fromBase === "1st" && (
                      <SelectItem value="2nd" className="text-base">→2塁</SelectItem>
                    )}
                    {(runner.fromBase === "1st" || runner.fromBase === "2nd") && (
                      <SelectItem value="3rd" className="text-base">→3塁</SelectItem>
                    )}
                    <SelectItem value="home" className="text-base">得点</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdvanceDialog(false)}>
              キャンセル
            </Button>
            <Button
              onClick={handleRunnerAdvance}
              disabled={advanceSaving || Object.values(advanceSelections).every((v) => v === "stay")}
            >
              {advanceSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              記録する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Position change dialog ---- */}
      <Dialog open={showPosChangeDialog} onOpenChange={setShowPosChangeDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>守備変更</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {fieldingLineup.map((l) => {
              const hasSub = !!posSubstitutions[l.id];
              return (
                <div key={l.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm w-20 sm:w-28 truncate shrink-0">
                      {l.batting_order}番 {l.player_name}
                    </span>
                    <Select
                      value={posChanges[l.id] ?? l.position ?? ""}
                      onValueChange={(val) => setPosChanges((prev) => ({ ...prev, [l.id]: val }))}
                    >
                      <SelectTrigger className="h-10 text-base flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["投", "捕", "一", "二", "三", "遊", "左", "中", "右", "DH"].map((pos) => (
                          <SelectItem key={pos} value={pos} className="text-base">{pos}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant={hasSub ? "secondary" : "outline"}
                      size="sm"
                      className="shrink-0"
                      onClick={() => {
                        if (hasSub) {
                          setPosSubstitutions((prev) => {
                            const next = { ...prev };
                            delete next[l.id];
                            return next;
                          });
                        } else {
                          setPosSubstitutions((prev) => ({
                            ...prev,
                            [l.id]: { newPlayerId: null, newPlayerName: "" },
                          }));
                        }
                      }}
                    >
                      {hasSub ? "取消" : "交代"}
                    </Button>
                  </div>
                  {hasSub && (
                    <div className="pl-8 space-y-1">
                      {fieldingTeamSide === ownTeamSide && availablePlayers.length > 0 && !posSubManualInput.has(l.id) ? (
                        <>
                          <Select
                            value={posSubstitutions[l.id]?.newPlayerId ?? ""}
                            onValueChange={(val) => {
                              const player = availablePlayers.find((p) => p.id === val);
                              if (player) {
                                setPosSubstitutions((prev) => ({
                                  ...prev,
                                  [l.id]: { newPlayerId: player.id, newPlayerName: player.name },
                                }));
                              }
                            }}
                          >
                            <SelectTrigger className="h-10 text-base">
                              <SelectValue placeholder="交代選手を選択" />
                            </SelectTrigger>
                            <SelectContent>
                              {availablePlayers.map((p) => (
                                <SelectItem key={p.id} value={p.id} className="text-base">
                                  {p.number ? `#${p.number} ` : ""}{p.name}{p.position ? `（${p.position}）` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:text-foreground underline"
                            onClick={() => {
                              setPosSubManualInput((prev) => new Set(prev).add(l.id));
                              setPosSubstitutions((prev) => ({
                                ...prev,
                                [l.id]: { newPlayerId: null, newPlayerName: "" },
                              }));
                            }}
                          >
                            手入力
                          </button>
                        </>
                      ) : (
                        <>
                          <Input
                            className="text-base h-10"
                            placeholder="交代選手名を入力"
                            value={posSubstitutions[l.id]?.newPlayerName ?? ""}
                            onChange={(e) => {
                              setPosSubstitutions((prev) => ({
                                ...prev,
                                [l.id]: { ...prev[l.id], newPlayerId: null, newPlayerName: e.target.value },
                              }));
                            }}
                          />
                          {fieldingTeamSide === ownTeamSide && availablePlayers.length > 0 && (
                            <button
                              type="button"
                              className="text-xs text-muted-foreground hover:text-foreground underline"
                              onClick={() => {
                                setPosSubManualInput((prev) => {
                                  const next = new Set(prev);
                                  next.delete(l.id);
                                  return next;
                                });
                                setPosSubstitutions((prev) => ({
                                  ...prev,
                                  [l.id]: { newPlayerId: null, newPlayerName: "" },
                                }));
                              }}
                            >
                              一覧から選択
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPosChangeDialog(false)}>
              キャンセル
            </Button>
            <Button
              disabled={posChangeSaving || Object.values(posSubstitutions).some((s) => !s.newPlayerName.trim())}
              onClick={handlePositionChange}
            >
              {posChangeSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              変更する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Utility ----

function countOutsFromResult(
  result: string,
  batterDest: RunnerDest,
  runnerRows: RunnerRow[]
): number {
  let outs = 0;
  if (batterDest === "out") outs++;
  for (const r of runnerRows) {
    if (r.destination === "out") outs++;
  }
  return outs;
}
