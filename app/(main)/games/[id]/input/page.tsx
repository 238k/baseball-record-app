"use client";

import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGameState, type BaseRunners } from "@/hooks/useGameState";
import { useGameSession } from "@/hooks/useGameSession";
import { recordAtBatAction, changePitcherAction, finishGameAction, recordStealAction, substitutePlayerAction, changePositionAction, undoLastAtBatAction, recordRunnerAdvanceAction } from "@/app/(main)/games/actions";
import { ScoreBoard } from "@/components/game/ScoreBoard";
import { OutCount } from "@/components/game/OutCount";
import { RunnerDisplay } from "@/components/game/RunnerDisplay";
import { AtBatInput } from "@/components/game/AtBatInput";
import { PitchCounter, countFromLog, type PitchResult } from "@/components/game/PitchCounter";
import { InputLockBanner } from "@/components/game/InputLockBanner";
import { SessionRequestModal } from "@/components/game/SessionRequestModal";
import { createClient } from "@/lib/supabase/client";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, RefreshCw, Undo2 } from "lucide-react";

// ---- Runner destination types ----

type RunnerDest = "1st" | "2nd" | "3rd" | "scored" | "out" | "stay";

interface RunnerRow {
  lineupId: string;
  playerName: string;
  fromBase: "batter" | "1st" | "2nd" | "3rd";
  destination: RunnerDest;
}

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

// ---- Destination options ----

const DEST_OPTIONS: { value: RunnerDest; label: string }[] = [
  { value: "stay", label: "そのまま" },
  { value: "1st", label: "→1塁" },
  { value: "2nd", label: "→2塁" },
  { value: "3rd", label: "→3塁" },
  { value: "scored", label: "得点" },
  { value: "out", label: "アウト" },
];

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
  const [rbiOverride, setRbiOverride] = useState<number>(0);
  const [saving, setSaving] = useState(false);

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

  // Steal dialog state
  const [showStealDialog, setShowStealDialog] = useState(false);
  const [stealLineupId, setStealLineupId] = useState("");
  const [stealSaving, setStealSaving] = useState(false);

  // Substitution dialog state
  const [showSubDialog, setShowSubDialog] = useState(false);
  const [subType, setSubType] = useState<"pinch_hitter" | "pinch_runner">("pinch_hitter");
  const [subTargetLineupId, setSubTargetLineupId] = useState(""); // runner lineup_id for pinch runner
  const [subNewPlayerId, setSubNewPlayerId] = useState<string | null>(null);
  const [subNewPlayerName, setSubNewPlayerName] = useState("");
  const [subNewPosition, setSubNewPosition] = useState("");
  const [subSaving, setSubSaving] = useState(false);

  // Position change dialog state
  const [showPosChangeDialog, setShowPosChangeDialog] = useState(false);
  const [posChanges, setPosChanges] = useState<Record<string, string>>({}); // lineupId → position
  const [posSubstitutions, setPosSubstitutions] = useState<Record<string, {
    newPlayerId: string | null;
    newPlayerName: string;
  }>>({}); // lineupId → substitute player info
  const [posSubManualInput, setPosSubManualInput] = useState<Set<string>>(new Set()); // lineupIds using manual text input
  const [posChangeSaving, setPosChangeSaving] = useState(false);

  // Track last result code between confirm and save
  const lastResultCode = useRef("");
  const [finishing, setFinishing] = useState(false);

  // Undo state
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  const [undoing, setUndoing] = useState(false);

  // WP/PB/BK dialog state
  const [showAdvanceDialog, setShowAdvanceDialog] = useState(false);
  const [advanceEventType, setAdvanceEventType] = useState<"wild_pitch" | "passed_ball" | "balk">("wild_pitch");
  const [advanceSelections, setAdvanceSelections] = useState<Record<string, string>>({}); // lineupId → toBase
  const [advanceSaving, setAdvanceSaving] = useState(false);

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
  const [availablePlayers, setAvailablePlayers] = useState<{ id: string; name: string; number: string | null; position: string | null }[]>([]);
  useEffect(() => {
    if (!gameState.game) return;
    const fetchPlayers = async () => {
      const supabase = createClient();
      const { data: players } = await supabase
        .from("players")
        .select("id, name, number, position")
        .eq("team_id", gameState.game!.team_id)
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

  const handlePitch = useCallback((result: PitchResult) => {
    const newLog = [...pitchLog, result];
    setPitchLog(newLog);
    syncPitchLogToDb(newLog);

    // Auto-result: check if count is full after this pitch
    const counts = countFromLog(newLog);
    if (counts.balls >= 4) {
      setPendingResult({ code: "BB", label: "四球" });
      setActionError(null);
    } else if (counts.strikes >= 3) {
      if (result === "looking") {
        setPendingResult({ code: "KK", label: "三振(見)" });
      } else {
        setPendingResult({ code: "K", label: "三振(空)" });
      }
      setActionError(null);
    }
  }, [pitchLog, syncPitchLogToDb]);

  const handleUndoPitch = useCallback(() => {
    setPitchLog((prev) => {
      const newLog = prev.slice(0, -1);
      syncPitchLogToDb(newLog);
      return newLog;
    });
  }, [syncPitchLogToDb]);

  // ---- Handlers ----

  const handleResultSelect = useCallback(
    (code: string, label: string) => {
      setPendingResult({ code, label });
      setActionError(null);
    },
    []
  );

  const handleConfirmResult = useCallback(() => {
    if (!pendingResult || !currentBatter) return;

    const code = pendingResult.code;
    lastResultCode.current = code;
    const defaults = getDefaultDestinations(code, gameState.baseRunners);
    const bDest = getDefaultBatterDest(code);

    setRunnerRows(defaults);
    setBatterDest(bDest);
    setRbiOverride(computeRbi(code, bDest, defaults));
    setPendingResult(null);
    setRunnerDialogOpen(true);
  }, [pendingResult, currentBatter, gameState.baseRunners]);

  const handleRunnerDestChange = useCallback(
    (lineupId: string, dest: RunnerDest) => {
      setRunnerRows((prev) => {
        const updated = prev.map((r) =>
          r.lineupId === lineupId ? { ...r, destination: dest } : r
        );
        // Recalculate RBI
        const code = lastResultCode.current;
        if (code) {
          setRbiOverride(computeRbi(code, batterDest, updated));
        }
        return updated;
      });
    },
    [batterDest]
  );

  const handleBatterDestChange = useCallback(
    (dest: RunnerDest) => {
      setBatterDest(dest);
      setRbiOverride(computeRbi(lastResultCode.current, dest, runnerRows));
    },
    [runnerRows]
  );

  const handleSaveAtBat = useCallback(async () => {
    if (!currentBatter || !gameState.game) return;

    setSaving(true);
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

    const result = await recordAtBatAction({
      gameId,
      inning: gameState.currentInning,
      inningHalf: gameState.currentHalf,
      battingOrder: gameState.currentBatterOrder,
      lineupId: currentBatter.id,
      result: resultCode,
      rbi: rbiOverride,
      pitchCount: pitchLog.length,
      pitches: pitchLog,
      baseRunnersBefore,
      runnerDestinations: destinations,
      runnersAfter,
    });

    setSaving(false);

    if (result.error) {
      setActionError(result.error);
      return;
    }

    setRunnerDialogOpen(false);
    setPitchLog([]);
    syncPitchLogToDb([]);

    // Check if 3 outs reached after this at-bat
    const outsFromResult = countOutsFromResult(resultCode, batterDest, runnerRows);
    const totalOuts = gameState.currentOuts + outsFromResult;

    if (totalOuts >= 3) {
      // Change of innings
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
      await gameState.reload();
    }
  }, [
    currentBatter,
    gameState,
    gameId,
    runnerRows,
    batterDest,
    rbiOverride,
    pitchLog,
    syncPitchLogToDb,
  ]);

  const handleInningChangeConfirm = useCallback(async () => {
    setShowInningChange(false);
    setNextInningInfo(null);
    await gameState.reload();
  }, [gameState]);

  const handlePitcherChangeConfirm = useCallback(async () => {
    if (!selectedPitcherLineupId || !gameState.game) return;

    setSaving(true);
    const result = await changePitcherAction({
      gameId,
      currentInning: gameState.currentInning,
      newPitcherLineupId: selectedPitcherLineupId,
      fieldingTeamSide,
    });
    setSaving(false);

    if (result.error) {
      setActionError(result.error);
      return;
    }

    setShowPitcherChange(false);
    setSelectedPitcherLineupId("");
    await gameState.reload();
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

  const handleUndo = useCallback(async () => {
    setUndoing(true);
    setActionError(null);

    const result = await undoLastAtBatAction(gameId);

    setUndoing(false);

    if (result.error) {
      setActionError(result.error);
      return;
    }

    setShowUndoConfirm(false);
    setPitchLog([]);
    syncPitchLogToDb([]);
    await gameState.reload();
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

  const handleRunnerAdvance = useCallback(async () => {
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

    setAdvanceSaving(true);
    setActionError(null);

    const result = await recordRunnerAdvanceAction({
      gameId,
      eventType: advanceEventType,
      advances,
    });

    setAdvanceSaving(false);

    if (result.error) {
      setActionError(result.error);
      return;
    }

    setShowAdvanceDialog(false);
    setAdvanceSelections({});
    await gameState.reload();
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

  const handleSteal = useCallback(async (eventType: "stolen_base" | "caught_stealing") => {
    const runner = stealRunnerOptions.find((r) => r.lineupId === stealLineupId);
    if (!runner) return;

    setStealSaving(true);
    setActionError(null);

    const result = await recordStealAction({
      gameId,
      lineupId: runner.lineupId,
      eventType,
      fromBase: runner.fromBase,
    });

    setStealSaving(false);

    if (result.error) {
      setActionError(result.error);
      return;
    }

    setShowStealDialog(false);
    setStealLineupId("");
    await gameState.reload();
  }, [stealLineupId, stealRunnerOptions, gameId, gameState]);

  // ---- Substitution handler ----

  const handleSubstitution = useCallback(async () => {
    if (!gameState.game || !subNewPlayerName.trim()) return;

    setSubSaving(true);
    setActionError(null);

    // Determine target batting order and team side
    let targetBattingOrder: number;
    let targetTeamSide: "home" | "visitor";

    if (subType === "pinch_hitter") {
      if (!currentBatter) { setSubSaving(false); return; }
      targetBattingOrder = currentBatter.batting_order;
      targetTeamSide = battingTeamSide as "home" | "visitor";
    } else {
      // pinch runner: find the runner's batting order
      const runner = gameState.lineups.find((l) => l.id === subTargetLineupId);
      if (!runner) { setSubSaving(false); return; }
      targetBattingOrder = runner.batting_order;
      targetTeamSide = runner.team_side as "home" | "visitor";
    }

    const result = await substitutePlayerAction({
      gameId,
      battingOrder: targetBattingOrder,
      teamSide: targetTeamSide,
      newPlayerId: subNewPlayerId,
      newPlayerName: subNewPlayerName.trim(),
      newPosition: subNewPosition || currentBatter?.position || "",
      currentInning: gameState.currentInning,
      type: subType,
      replacedLineupId: subType === "pinch_runner" ? subTargetLineupId : undefined,
    });

    setSubSaving(false);

    if (result.error) {
      setActionError(result.error);
      return;
    }

    setShowSubDialog(false);
    setSubNewPlayerId(null);
    setSubNewPlayerName("");
    setSubNewPosition("");
    setSubTargetLineupId("");
    await gameState.reload();
  }, [gameState, gameId, subType, subNewPlayerId, subNewPlayerName, subNewPosition, subTargetLineupId, currentBatter, battingTeamSide]);

  // ---- Position change handler ----

  const handlePositionChange = useCallback(async () => {
    if (!gameState.game) return;

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

    setPosChangeSaving(true);
    setActionError(null);

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
        setPosChangeSaving(false);
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
        setPosChangeSaving(false);
        setActionError(result.error);
        return;
      }
    }

    setPosChangeSaving(false);
    setShowPosChangeDialog(false);
    setPosChanges({});
    setPosSubstitutions({});
    await gameState.reload();
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

  if (gameState.game.status !== "in_progress") {
    return (
      <div className="space-y-4 text-center py-16">
        <p className="text-muted-foreground">この試合は記録入力中ではありません</p>
        <Button variant="outline" onClick={() => router.push(`/games/${gameId}`)}>
          試合詳細に戻る
        </Button>
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
  const batterDisplay = currentBatter
    ? `${numberPrefix}${currentBatter.player_name ?? "—"}（${gameState.currentBatterOrder}番・${positionLabel}）`
    : "—";

  return (
    <div className="space-y-4 pb-8">
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push(`/games/${gameId}`)}
          className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          試合詳細
        </button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowUndoConfirm(true);
              setActionError(null);
            }}
          >
            <Undo2 className="mr-1 h-4 w-4" />
            戻す
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => gameState.reload()}
          >
            <RefreshCw className="mr-1 h-4 w-4" />
            更新
          </Button>
        </div>
      </div>

      {/* Scoreboard */}
      <ScoreBoard
        myTeamName={gameState.myTeamName}
        opponentName={gameState.game.opponent_name}
        isHome={gameState.game.is_home}
        score={gameState.score}
        currentInning={gameState.currentInning}
        currentHalf={gameState.currentHalf}
      />

      {/* Outs + Runners */}
      <div className="flex items-center justify-between">
        <OutCount outs={gameState.currentOuts} />
        <RunnerDisplay baseRunners={gameState.baseRunners} />
      </div>

      {/* Current batter */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">打者</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-bold">{batterDisplay}</p>
        </CardContent>
      </Card>

      {/* Pitch counter */}
      <PitchCounter
        pitchLog={pitchLog}
        onPitch={handlePitch}
        onUndo={handleUndoPitch}
        disabled={saving}
      />

      {/* At-bat result buttons */}
      <AtBatInput onSelect={handleResultSelect} disabled={saving} highlightCode={highlightCode} />

      {/* Action buttons */}
      <div className="grid grid-cols-3 gap-3">
        <Button
          variant="outline"
          size="lg"
          className="min-h-14 text-base"
          disabled={stealRunnerOptions.length === 0}
          onClick={() => {
            setShowStealDialog(true);
            setStealLineupId("");
            setActionError(null);
          }}
        >
          盗塁
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="min-h-14 text-base"
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
          WP/PB/BK
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="min-h-14 text-base"
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
          交代
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="min-h-14 text-base"
          onClick={() => {
            // Init position changes with current positions
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
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="min-h-14 text-base"
          onClick={() => {
            setShowPitcherChange(true);
            setActionError(null);
          }}
        >
          投手交代
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="min-h-14 text-base"
          onClick={() => {
            setShowFinishGame(true);
            setActionError(null);
          }}
        >
          試合終了
        </Button>
      </div>

      {actionError && (
        <p className="text-destructive text-sm text-center">{actionError}</p>
      )}

      {/* ---- Confirm result dialog ---- */}
      <AlertDialog
        open={pendingResult != null}
        onOpenChange={(open) => {
          if (!open) setPendingResult(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>打席結果の確認</AlertDialogTitle>
            <AlertDialogDescription>
              {currentBatter?.player_name ?? "—"} → {pendingResult?.label}{" "}
              でよいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmResult}>
              確定
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ---- Runner / scoring dialog ---- */}
      <Dialog open={runnerDialogOpen} onOpenChange={setRunnerDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>走者・得点入力</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Runners */}
            {runnerRows.map((row) => (
              <div key={row.lineupId} className="space-y-1">
                <label className="text-sm font-medium">
                  {row.fromBase === "1st"
                    ? "1塁"
                    : row.fromBase === "2nd"
                      ? "2塁"
                      : "3塁"}
                  走者: {row.playerName}
                </label>
                <Select
                  value={row.destination}
                  onValueChange={(v) =>
                    handleRunnerDestChange(row.lineupId, v as RunnerDest)
                  }
                >
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEST_OPTIONS.map((opt) => (
                      <SelectItem
                        key={opt.value}
                        value={opt.value}
                        className="text-base"
                      >
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}

            {/* Batter destination */}
            <div className="space-y-1">
              <label className="text-sm font-medium">
                打者: {currentBatter?.player_name ?? "—"}
              </label>
              <Select
                value={batterDest}
                onValueChange={(v) => handleBatterDestChange(v as RunnerDest)}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEST_OPTIONS.filter((o) => o.value !== "stay").map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      className="text-base"
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* RBI */}
            <div className="space-y-1">
              <label className="text-sm font-medium">打点</label>
              <Input
                type="number"
                min={0}
                max={9}
                value={rbiOverride}
                onChange={(e) => setRbiOverride(parseInt(e.target.value) || 0)}
                className="h-12 text-base"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRunnerDialogOpen(false)}
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
                    <span className="text-sm w-28 truncate">
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
