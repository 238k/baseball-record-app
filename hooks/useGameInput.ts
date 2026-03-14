"use client";

import { useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { recordAtBatAction } from "@/app/(main)/games/actions";
import { getDefaultDestinations, getDefaultBatterDest } from "@/lib/game/runner-logic";
import { computeRbi } from "@/lib/game/rbi-logic";
import { countOutsFromResult } from "@/lib/game/at-bat-logic";
import type { GameState, BaseRunners } from "@/hooks/useGameState";
import type { RunnerDest, RunnerRow } from "@/app/(main)/games/[id]/input/types";
import type { PitchResult } from "@/components/game/PitchCounter";

interface UseGameInputParams {
  gameId: string;
  gameState: GameState & {
    reload: (force?: boolean) => Promise<void>;
    optimisticUpdate: (partial: {
      currentOuts?: number;
      currentBatterOrder?: number;
      baseRunners?: BaseRunners;
      score?: { home: number; visitor: number };
    }) => void;
  };
  currentBatter: {
    id: string;
    batting_order: number;
    player_name: string | null;
    position: string | null;
  } | undefined;
}

export function useGameInput({ gameId, gameState, currentBatter }: UseGameInputParams) {
  const [pendingResult, setPendingResult] = useState<{ code: string; label: string } | null>(null);
  const [runnerDialogOpen, setRunnerDialogOpen] = useState(false);
  const [runnerRows, setRunnerRows] = useState<RunnerRow[]>([]);
  const [batterDest, setBatterDest] = useState<RunnerDest>("1st");
  const [showInningChange, setShowInningChange] = useState(false);
  const [nextInningInfo, setNextInningInfo] = useState<{ inning: number; half: "top" | "bottom" } | null>(null);
  const [autoSaveBanner, setAutoSaveBanner] = useState<{ playerName: string; resultLabel: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pitchLog, setPitchLog] = useState<PitchResult[]>([]);

  const lastResultCode = useRef("");
  const pendingActionRef = useRef(false);

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

  const handleInningTransition = useCallback((totalOuts: number) => {
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
      return true;
    }
    return false;
  }, [gameState.currentHalf, gameState.currentInning]);

  const buildOptimisticState = useCallback((
    bDest: RunnerDest,
    runners: RunnerRow[],
    outsFromResult: number,
    batter: typeof currentBatter,
  ) => {
    const optimisticRunners: BaseRunners = { first: null, second: null, third: null };

    // Map runner destinations
    for (const r of runners) {
      if (["1st", "2nd", "3rd"].includes(r.destination)) {
        const lineup = gameState.lineups.find((l) => l.id === r.lineupId) ?? null;
        if (r.destination === "1st") optimisticRunners.first = lineup;
        else if (r.destination === "2nd") optimisticRunners.second = lineup;
        else if (r.destination === "3rd") optimisticRunners.third = lineup;
      }
    }

    // Map batter destination
    if (batter) {
      const batterLineup = gameState.lineups.find((l) => l.id === batter.id) ?? null;
      if (bDest === "1st") optimisticRunners.first = batterLineup;
      else if (bDest === "2nd") optimisticRunners.second = batterLineup;
      else if (bDest === "3rd") optimisticRunners.third = batterLineup;
    }

    const scoredCount = runners.filter((r) => r.destination === "scored").length
      + (bDest === "scored" ? 1 : 0);
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
  }, [gameState]);

  const fireRecordAction = useCallback((
    code: string,
    rbi: number,
    bDest: RunnerDest,
    runners: RunnerRow[],
    log: PitchResult[],
  ) => {
    if (!currentBatter) return;

    const baseRunnersBefore: { base: string; lineupId: string }[] = [];
    for (const r of runners) {
      baseRunnersBefore.push({ base: r.fromBase, lineupId: r.lineupId });
    }

    const destinations: { lineupId: string; event: "scored" | "out"; toBase: undefined }[] = [];
    for (const r of runners) {
      if (r.destination === "scored" || r.destination === "out") {
        destinations.push({ lineupId: r.lineupId, event: r.destination, toBase: undefined });
      }
    }
    if (bDest === "scored" || bDest === "out") {
      destinations.push({ lineupId: currentBatter.id, event: bDest, toBase: undefined });
    }

    const runnersAfter: { base: string; lineupId: string }[] = [];
    for (const r of runners) {
      if (r.destination === "stay") {
        runnersAfter.push({ base: r.fromBase, lineupId: r.lineupId });
      } else if (["1st", "2nd", "3rd"].includes(r.destination)) {
        runnersAfter.push({ base: r.destination, lineupId: r.lineupId });
      }
    }
    if (["1st", "2nd", "3rd"].includes(bDest)) {
      runnersAfter.push({ base: bDest, lineupId: currentBatter.id });
    }

    pendingActionRef.current = true;
    void recordAtBatAction({
      gameId,
      inning: gameState.currentInning,
      inningHalf: gameState.currentHalf,
      battingOrder: gameState.currentBatterOrder,
      lineupId: currentBatter.id,
      result: code,
      rbi,
      pitchCount: log.length,
      pitches: log,
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
  }, [currentBatter, gameState, gameId]);

  const autoSaveAtBat = useCallback(
    (code: string, label: string, bDest: RunnerDest, existingRunners?: RunnerRow[]) => {
      if (!currentBatter || !gameState.game) return;
      if (pendingActionRef.current) return;

      setActionError(null);
      const runners = existingRunners ?? [];
      const rbi = computeRbi(code, bDest, runners);

      setAutoSaveBanner({ playerName: currentBatter.player_name ?? "—", resultLabel: label });
      setPendingResult(null);
      setPitchLog([]);
      syncPitchLogToDb([]);

      const outsFromResult = countOutsFromResult(code, bDest, runners);
      const totalOuts = gameState.currentOuts + outsFromResult;

      if (!handleInningTransition(totalOuts)) {
        buildOptimisticState(bDest, runners, outsFromResult, currentBatter);
      }

      fireRecordAction(code, rbi, bDest, runners, pitchLog);
    },
    [currentBatter, gameState, pitchLog, syncPitchLogToDb, handleInningTransition, buildOptimisticState, fireRecordAction]
  );

  const processResult = useCallback(
    (code: string, label: string) => {
      if (!currentBatter) return;

      lastResultCode.current = code;
      const defaults = getDefaultDestinations(code, gameState.baseRunners);
      const bDest = getDefaultBatterDest(code);

      if (defaults.length === 0 || code === "HR") {
        autoSaveAtBat(code, label, bDest, defaults);
        return;
      }

      setPendingResult({ code, label });
      setRunnerRows(defaults);
      setBatterDest(bDest);
      setRunnerDialogOpen(true);
    },
    [currentBatter, gameState.baseRunners, autoSaveAtBat]
  );

  const handleSaveAtBat = useCallback(() => {
    if (!currentBatter || !gameState.game) return;
    if (pendingActionRef.current) return;

    setActionError(null);
    const resultCode = lastResultCode.current;

    setRunnerDialogOpen(false);
    setPendingResult(null);
    setPitchLog([]);
    syncPitchLogToDb([]);

    const outsFromResult = countOutsFromResult(resultCode, batterDest, runnerRows);
    const totalOuts = gameState.currentOuts + outsFromResult;

    if (!handleInningTransition(totalOuts)) {
      buildOptimisticState(batterDest, runnerRows, outsFromResult, currentBatter);
    }

    const rbi = computeRbi(resultCode, batterDest, runnerRows);
    fireRecordAction(resultCode, rbi, batterDest, runnerRows, pitchLog);
  }, [
    currentBatter, gameState, runnerRows, batterDest,
    pitchLog, syncPitchLogToDb, handleInningTransition, buildOptimisticState, fireRecordAction,
  ]);

  const handleRunnerDestChange = useCallback((lineupId: string, dest: RunnerDest) => {
    setRunnerRows((prev) =>
      prev.map((r) => r.lineupId === lineupId ? { ...r, destination: dest } : r)
    );
  }, []);

  const handleBatterDestChange = useCallback((dest: RunnerDest) => {
    setBatterDest(dest);
  }, []);

  const handleInningChangeConfirm = useCallback(async () => {
    setShowInningChange(false);
    setNextInningInfo(null);
    await gameState.reload(true);
  }, [gameState]);

  return {
    pendingResult,
    setPendingResult,
    runnerDialogOpen,
    setRunnerDialogOpen,
    runnerRows,
    batterDest,
    showInningChange,
    nextInningInfo,
    autoSaveBanner,
    setAutoSaveBanner,
    actionError,
    setActionError,
    pitchLog,
    setPitchLog,
    lastResultCode,
    pendingActionRef,
    syncPitchLogToDb,
    processResult,
    handleSaveAtBat,
    handleRunnerDestChange,
    handleBatterDestChange,
    handleInningChangeConfirm,
    autoSaveAtBat,
  };
}
