"use client";

import { useCallback, useMemo } from "react";
import {
  changePitcherAction,
  finishGameAction,
  recordStealAction,
  substitutePlayerAction,
  changePositionAction,
  undoLastAtBatAction,
  recordRunnerAdvanceAction,
} from "@/app/(main)/games/actions";
import type { GameState, LineupPlayer } from "@/hooks/useGameState";
import type { PitchResult } from "@/components/game/PitchCounter";
import type { MutableRefObject, Dispatch, SetStateAction } from "react";

interface UseGameActionsParams {
  gameId: string;
  gameState: GameState & {
    reload: (force?: boolean) => Promise<void>;
    optimisticUpdate: (partial: Record<string, unknown>) => void;
  };
  currentBatter: LineupPlayer | undefined;
  battingTeamSide: "home" | "visitor";
  fieldingTeamSide: "home" | "visitor";
  fieldingLineup: LineupPlayer[];
  pendingActionRef: MutableRefObject<boolean>;
  setActionError: (error: string | null) => void;
  setPitchLog: Dispatch<SetStateAction<PitchResult[]>>;
  syncPitchLogToDb: (log: PitchResult[]) => void;
}

export function useGameActions({
  gameId,
  gameState,
  currentBatter,
  battingTeamSide,
  fieldingTeamSide,
  fieldingLineup,
  pendingActionRef,
  setActionError,
  setPitchLog,
  syncPitchLogToDb,
}: UseGameActionsParams) {
  const handlePitcherChangeConfirm = useCallback((lineupId: string) => {
    if (!gameState.game || pendingActionRef.current) return;
    pendingActionRef.current = true;
    void changePitcherAction({
      gameId,
      currentInning: gameState.currentInning,
      newPitcherLineupId: lineupId,
      fieldingTeamSide,
    }).then(result => {
      pendingActionRef.current = false;
      if (result.error) setActionError(result.error);
      return gameState.reload(true);
    }).catch(() => {
      pendingActionRef.current = false;
      setActionError("通信エラーが発生しました");
    });
  }, [gameState, gameId, fieldingTeamSide, pendingActionRef, setActionError]);

  const handleUndo = useCallback(() => {
    if (pendingActionRef.current) return;
    setActionError(null);
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
  }, [gameId, gameState, pendingActionRef, setActionError, setPitchLog, syncPitchLogToDb]);

  const advanceRunnerOptions = useMemo(() => {
    const options: { lineupId: string; playerName: string; fromBase: "1st" | "2nd" | "3rd"; defaultToBase: string }[] = [];
    if (gameState.baseRunners.first) options.push({ lineupId: gameState.baseRunners.first.id, playerName: gameState.baseRunners.first.player_name ?? "—", fromBase: "1st", defaultToBase: "2nd" });
    if (gameState.baseRunners.second) options.push({ lineupId: gameState.baseRunners.second.id, playerName: gameState.baseRunners.second.player_name ?? "—", fromBase: "2nd", defaultToBase: "3rd" });
    if (gameState.baseRunners.third) options.push({ lineupId: gameState.baseRunners.third.id, playerName: gameState.baseRunners.third.player_name ?? "—", fromBase: "3rd", defaultToBase: "home" });
    return options;
  }, [gameState.baseRunners]);

  const handleRunnerAdvance = useCallback((
    advanceSelections: Record<string, string>,
    advanceEventType: "wild_pitch" | "passed_ball" | "balk",
  ) => {
    if (pendingActionRef.current) return;
    const advances = Object.entries(advanceSelections)
      .filter(([, toBase]) => toBase !== "stay")
      .map(([lineupId, toBase]) => {
        const runner = advanceRunnerOptions.find((r) => r.lineupId === lineupId);
        return { lineupId, fromBase: runner!.fromBase, toBase: toBase as "2nd" | "3rd" | "home" };
      });
    if (advances.length === 0) { setActionError("進塁する走者を選択してください"); return false; }
    setActionError(null);
    pendingActionRef.current = true;
    void recordRunnerAdvanceAction({ gameId, eventType: advanceEventType, advances }).then(result => {
      pendingActionRef.current = false;
      if (result.error) setActionError(result.error);
      return gameState.reload(true);
    }).catch(() => {
      pendingActionRef.current = false;
      setActionError("通信エラーが発生しました");
    });
    return true;
  }, [advanceRunnerOptions, gameId, gameState, pendingActionRef, setActionError]);

  const stealRunnerOptions = useMemo(() => {
    const options: { lineupId: string; playerName: string; fromBase: "1st" | "2nd" | "3rd" }[] = [];
    if (gameState.baseRunners.first && !gameState.baseRunners.second) options.push({ lineupId: gameState.baseRunners.first.id, playerName: gameState.baseRunners.first.player_name ?? "—", fromBase: "1st" });
    if (gameState.baseRunners.second && !gameState.baseRunners.third) options.push({ lineupId: gameState.baseRunners.second.id, playerName: gameState.baseRunners.second.player_name ?? "—", fromBase: "2nd" });
    if (gameState.baseRunners.third) options.push({ lineupId: gameState.baseRunners.third.id, playerName: gameState.baseRunners.third.player_name ?? "—", fromBase: "3rd" });
    return options;
  }, [gameState.baseRunners]);

  const handleSteal = useCallback((lineupId: string, eventType: "stolen_base" | "caught_stealing") => {
    if (pendingActionRef.current) return;
    const runner = stealRunnerOptions.find((r) => r.lineupId === lineupId);
    if (!runner) return;
    setActionError(null);
    pendingActionRef.current = true;
    void recordStealAction({ gameId, lineupId: runner.lineupId, eventType, fromBase: runner.fromBase }).then(result => {
      pendingActionRef.current = false;
      if (result.error) setActionError(result.error);
      return gameState.reload(true);
    }).catch(() => {
      pendingActionRef.current = false;
      setActionError("通信エラーが発生しました");
    });
  }, [stealRunnerOptions, gameId, gameState, pendingActionRef, setActionError]);

  const handleSubstitution = useCallback((params: {
    type: "pinch_hitter" | "pinch_runner";
    targetLineupId: string;
    newPlayerId: string | null;
    newPlayerName: string;
    newPosition: string;
  }) => {
    if (!gameState.game || pendingActionRef.current) return;
    setActionError(null);
    let targetBattingOrder: number;
    let targetTeamSide: "home" | "visitor";
    if (params.type === "pinch_hitter") {
      if (!currentBatter) return;
      targetBattingOrder = currentBatter.batting_order;
      targetTeamSide = battingTeamSide as "home" | "visitor";
    } else {
      const runner = gameState.lineups.find((l) => l.id === params.targetLineupId);
      if (!runner) return;
      targetBattingOrder = runner.batting_order;
      targetTeamSide = runner.team_side as "home" | "visitor";
    }
    pendingActionRef.current = true;
    void substitutePlayerAction({
      gameId,
      battingOrder: targetBattingOrder,
      teamSide: targetTeamSide,
      newPlayerId: params.newPlayerId,
      newPlayerName: params.newPlayerName,
      newPosition: params.newPosition,
      currentInning: gameState.currentInning,
      type: params.type,
      replacedLineupId: params.type === "pinch_runner" ? params.targetLineupId : undefined,
    }).then(result => {
      pendingActionRef.current = false;
      if (result.error) setActionError(result.error);
      return gameState.reload(true);
    }).catch(() => {
      pendingActionRef.current = false;
      setActionError("通信エラーが発生しました");
    });
  }, [gameState, gameId, currentBatter, battingTeamSide, pendingActionRef, setActionError]);

  const handlePositionChange = useCallback((params: {
    posChanges: Record<string, string>;
    substitutions: Record<string, { newPlayerId: string | null; newPlayerName: string }>;
  }) => {
    if (!gameState.game || pendingActionRef.current) return;
    const subEntries = Object.entries(params.substitutions).filter(([, sub]) => sub.newPlayerName.trim());
    const posOnlyChanges = Object.entries(params.posChanges)
      .filter(([lineupId, newPos]) => {
        if (params.substitutions[lineupId]) return false;
        const lineup = fieldingLineup.find((l) => l.id === lineupId);
        return lineup && lineup.position !== newPos;
      })
      .map(([lineupId, newPosition]) => ({ lineupId, newPosition }));
    if (subEntries.length === 0 && posOnlyChanges.length === 0) return false;
    setActionError(null);
    pendingActionRef.current = true;
    const run = async () => {
      for (const [lineupId, sub] of subEntries) {
        const lineup = fieldingLineup.find((l) => l.id === lineupId);
        if (!lineup) continue;
        const result = await substitutePlayerAction({
          gameId,
          battingOrder: lineup.batting_order,
          teamSide: fieldingTeamSide as "home" | "visitor",
          newPlayerId: sub.newPlayerId,
          newPlayerName: sub.newPlayerName.trim(),
          newPosition: params.posChanges[lineupId] ?? lineup.position ?? "",
          currentInning: gameState.currentInning,
          type: "pinch_hitter",
        });
        if (result.error) { pendingActionRef.current = false; setActionError(result.error); return; }
      }
      if (posOnlyChanges.length > 0) {
        const result = await changePositionAction({ gameId, changes: posOnlyChanges });
        if (result.error) { pendingActionRef.current = false; setActionError(result.error); return; }
      }
      pendingActionRef.current = false;
      await gameState.reload(true);
    };
    void run().catch(() => { pendingActionRef.current = false; setActionError("通信エラーが発生しました"); });
    return true;
  }, [gameState, gameId, fieldingLineup, fieldingTeamSide, pendingActionRef, setActionError]);

  const handleFinishGame = useCallback(async () => {
    const result = await finishGameAction(gameId);
    if (result.error) { setActionError(result.error); return false; }
    return true;
  }, [gameId, setActionError]);

  return {
    handlePitcherChangeConfirm,
    handleUndo,
    handleRunnerAdvance,
    handleSteal,
    handleSubstitution,
    handlePositionChange,
    handleFinishGame,
    advanceRunnerOptions,
    stealRunnerOptions,
  };
}
