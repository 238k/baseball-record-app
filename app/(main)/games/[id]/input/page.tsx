"use client";

import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGameState, type BaseRunners } from "@/hooks/useGameState";
import { useGameSession } from "@/hooks/useGameSession";
import { recordAtBatAction, changePitcherAction, finishGameAction, recordStealAction } from "@/app/(main)/games/actions";
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
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";

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

  // Track last result code between confirm and save
  const lastResultCode = useRef("");
  const [finishing, setFinishing] = useState(false);

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

  // Get batting lineup for current side (exclude DH pitchers — position 投 in DH game)
  const battingLineup = useMemo(() => {
    if (!gameState.game) return [];
    const side = battingTeamSide;
    const lineups = gameState.lineups.filter((l) => l.team_side === side);

    if (gameState.game.use_dh) {
      // In DH games, there may be duplicate batting_orders (DH + pitcher)
      // Only include batting lineup (not position=投 for DH)
      const dhOrders = new Set(
        lineups.filter((l) => l.position === "DH").map((l) => l.batting_order)
      );
      return lineups.filter(
        (l) => !(l.position === "投" && dhOrders.has(l.batting_order))
      );
    }
    return lineups;
  }, [gameState.lineups, gameState.game, battingTeamSide]);

  const currentBatter = battingLineup.find(
    (l) => l.batting_order === gameState.currentBatterOrder
  );

  // Fielding team lineup (for pitcher change)
  const fieldingLineup = useMemo(() => {
    return gameState.lineups.filter((l) => l.team_side === fieldingTeamSide);
  }, [gameState.lineups, fieldingTeamSide]);

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
      <div className="flex gap-3">
        <Button
          variant="outline"
          size="lg"
          className="flex-1 min-h-16 text-base"
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
          className="flex-1 min-h-16 text-base"
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
          className="flex-1 min-h-16 text-base"
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
