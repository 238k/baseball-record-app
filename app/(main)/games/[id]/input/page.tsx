"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGameState } from "@/hooks/useGameState";
import { useGameSession } from "@/hooks/useGameSession";
import { useGameInput } from "@/hooks/useGameInput";
import { useGameActions } from "@/hooks/useGameActions";
import { AtBatInput } from "@/components/game/AtBatInput";
import { countFromLog, type PitchResult } from "@/components/game/PitchCounter";
import { FieldRunnerDisplay } from "@/components/field/FieldRunnerDisplay";
import { InputLockBanner } from "@/components/game/InputLockBanner";
import { SessionRequestModal } from "@/components/game/SessionRequestModal";
import { ScheduledView } from "@/components/game/input/ScheduledView";
import { RunnerDestinationDialog } from "@/components/game/input/RunnerDestinationDialog";
import { InningChangeDialog } from "@/components/game/input/InningChangeDialog";
import { PitcherChangeDialog } from "@/components/game/input/PitcherChangeDialog";
import { FinishGameDialog } from "@/components/game/input/FinishGameDialog";
import { StealDialog } from "@/components/game/input/StealDialog";
import { SubstitutionDialog } from "@/components/game/input/SubstitutionDialog";
import { UndoConfirmDialog } from "@/components/game/input/UndoConfirmDialog";
import { AdvanceDialog } from "@/components/game/input/AdvanceDialog";
import { PositionChangeDialog } from "@/components/game/input/PositionChangeDialog";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArrowLeft, Check, ChevronDown, Loader2, RefreshCw, Undo2 } from "lucide-react";

export default function GameInputPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.id as string;

  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null));
  }, []);

  const gameState = useGameState(gameId);
  const session = useGameSession(gameId, userId);

  const battingTeamSide: "home" | "visitor" = gameState.currentHalf === "top" ? "visitor" : "home";
  const fieldingTeamSide: "home" | "visitor" = gameState.currentHalf === "top" ? "home" : "visitor";

  const battingLineup = useMemo(() => {
    if (!gameState.game) return [];
    let lineups = gameState.lineups.filter((l) => l.team_side === battingTeamSide);
    if (gameState.game.use_dh) {
      const dhOrders = new Set(lineups.filter((l) => l.position === "DH").map((l) => l.batting_order));
      lineups = lineups.filter((l) => !(l.position === "投" && dhOrders.has(l.batting_order)));
    }
    const latestByOrder = new Map<number, typeof lineups[number]>();
    for (const l of lineups) {
      const existing = latestByOrder.get(l.batting_order);
      if (!existing || l.inning_from >= existing.inning_from) latestByOrder.set(l.batting_order, l);
    }
    return Array.from(latestByOrder.values()).sort((a, b) => a.batting_order - b.batting_order);
  }, [gameState.lineups, gameState.game, battingTeamSide]);

  const currentBatter = battingLineup.find((l) => l.batting_order === gameState.currentBatterOrder);

  const fieldingLineup = useMemo(() => {
    const lineups = gameState.lineups.filter((l) => l.team_side === fieldingTeamSide);
    const latestByOrder = new Map<number, typeof lineups[number]>();
    for (const l of lineups) {
      const existing = latestByOrder.get(l.batting_order);
      if (!existing || l.inning_from >= existing.inning_from) latestByOrder.set(l.batting_order, l);
    }
    return Array.from(latestByOrder.values()).sort((a, b) => a.batting_order - b.batting_order);
  }, [gameState.lineups, fieldingTeamSide]);

  const ownTeamSide = gameState.game?.is_home ? "home" : "visitor";
  const input = useGameInput({ gameId, gameState, currentBatter });

  const actions = useGameActions({
    gameId, gameState, currentBatter, battingTeamSide, fieldingTeamSide, fieldingLineup,
    pendingActionRef: input.pendingActionRef,
    setActionError: input.setActionError,
    setPitchLog: input.setPitchLog,
    syncPitchLogToDb: input.syncPitchLogToDb,
  });

  // Dialog open states
  const [showPitcherChange, setShowPitcherChange] = useState(false);
  const [showFinishGame, setShowFinishGame] = useState(false);
  const [showInPlayDialog, setShowInPlayDialog] = useState(false);
  const [showStealDialog, setShowStealDialog] = useState(false);
  const [showSubDialog, setShowSubDialog] = useState(false);
  const [showPosChangeDialog, setShowPosChangeDialog] = useState(false);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  const [showAdvanceDialog, setShowAdvanceDialog] = useState(false);
  const [advanceEventType, setAdvanceEventType] = useState<"wild_pitch" | "passed_ball" | "balk">("wild_pitch");
  const [advanceSelections, setAdvanceSelections] = useState<Record<string, string>>({});
  const [finishing, setFinishing] = useState(false);

  // Available players for substitution
  const [availablePlayers, setAvailablePlayers] = useState<{ id: string; name: string; number: string | null; position: string | null }[]>([]);
  useEffect(() => {
    if (!gameState.game || gameState.game.is_free_mode || !gameState.game.team_id) return;
    const supabase = createClient();
    supabase.from("players").select("id, name, number, position").eq("team_id", gameState.game.team_id).eq("is_active", true).order("number").then(({ data: players }) => {
      if (!players) return;
      const usedPlayerIds = new Set(gameState.lineups.filter((l) => l.player_id).map((l) => l.player_id));
      setAvailablePlayers(players.filter((p) => !usedPlayerIds.has(p.id)));
    });
  }, [gameState.game, gameState.lineups]);

  const pitchCounts = useMemo(() => countFromLog(input.pitchLog), [input.pitchLog]);
  const highlightCode = useMemo(() => {
    if (pitchCounts.balls >= 4) return "BB";
    if (pitchCounts.strikes >= 3) return input.pitchLog[input.pitchLog.length - 1] === "looking" ? "KK" : "K";
    return null;
  }, [pitchCounts, input.pitchLog]);

  const { autoSaveBanner, setAutoSaveBanner } = input;
  useEffect(() => {
    if (!autoSaveBanner) return;
    const timer = setTimeout(() => setAutoSaveBanner(null), 5000);
    return () => clearTimeout(timer);
  }, [autoSaveBanner, setAutoSaveBanner]);

  const handlePitch = useCallback((result: PitchResult) => {
    const newLog = [...input.pitchLog, result];
    input.setPitchLog(newLog);
    input.syncPitchLogToDb(newLog);
    const counts = countFromLog(newLog);
    if (counts.balls >= 4) { input.setActionError(null); input.processResult("BB", "四球"); }
    else if (counts.strikes >= 3) { input.setActionError(null); input.processResult(result === "looking" ? "KK" : "K", result === "looking" ? "三振(見)" : "三振(空)"); }
  }, [input]);

  const handleUndoPitch = useCallback(() => {
    input.setPitchLog((prev) => { const newLog = prev.slice(0, -1); input.syncPitchLogToDb(newLog); return newLog; });
  }, [input]);

  const clearError = useCallback(() => input.setActionError(null), [input]);

  // ---- Loading / error / status guards ----
  if (gameState.loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (gameState.error || !gameState.game) return <div className="space-y-4 text-center py-16"><p className="text-destructive">{gameState.error ?? "試合データが見つかりません"}</p><Button variant="outline" onClick={() => router.push(`/games/${gameId}`)}>試合詳細に戻る</Button></div>;
  if (gameState.game.status !== "in_progress" && gameState.game.status !== "scheduled") return <div className="space-y-4 text-center py-16"><p className="text-muted-foreground">この試合は記録入力中ではありません</p><Button variant="outline" onClick={() => router.push(`/games/${gameId}`)}>試合詳細に戻る</Button></div>;
  if (gameState.game.status === "scheduled") return <ScheduledView game={gameState.game} gameId={gameId} myTeamName={gameState.myTeamName} lineups={gameState.lineups} onStarted={() => gameState.reload()} />;
  if (session.loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!session.isMySession && !session.currentHolder && !session.loading) return (
    <div className="space-y-4 pb-8">
      <button type="button" onClick={() => router.push(`/games/${gameId}`)} className="flex items-center text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="mr-1 h-4 w-4" />試合詳細</button>
      <div className="text-center space-y-4 py-8"><p className="text-muted-foreground">入力セッションが解除されました</p><Button onClick={() => router.refresh()}>再接続する</Button></div>
    </div>
  );
  if (!session.isMySession && session.currentHolder) return (
    <div className="space-y-4 pb-8">
      <button type="button" onClick={() => router.push(`/games/${gameId}`)} className="flex items-center text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="mr-1 h-4 w-4" />試合詳細</button>
      <InputLockBanner holderName={session.currentHolder.display_name} hasPendingRequest={!!session.myPendingRequest} wasRejected={session.wasRejected} onRequestSession={session.requestSession} />
    </div>
  );

  const batterOrderLabel = currentBatter ? `${gameState.currentBatterOrder}番・${currentBatter.position ?? ""}` : "";
  const batterName = currentBatter ? `${currentBatter.player_number ? `#${currentBatter.player_number} ` : ""}${currentBatter.player_name ?? "—"}` : "—";
  const halfLabel = gameState.currentHalf === "top" ? "表" : "裏";
  const myScore = gameState.game.is_home ? gameState.score.home : gameState.score.visitor;
  const opponentScore = gameState.game.is_home ? gameState.score.visitor : gameState.score.home;
  const { balls, strikes } = pitchCounts;
  const countFull = balls >= 4 || strikes >= 3;
  const hasRunners = !!(gameState.baseRunners.first || gameState.baseRunners.second || gameState.baseRunners.third);

  return (
    <div className="flex flex-col gap-3 pb-4">
      {session.pendingRequest && <SessionRequestModal requesterName={session.pendingRequest.requester_name} requestId={session.pendingRequest.id} requestCreatedAt={session.pendingRequest.created_at} onApprove={session.approveRequest} onReject={session.rejectRequest} />}

      <div className="flex items-center justify-between bg-muted rounded-lg px-3 py-2">
        <div className="flex items-center gap-2 font-bold">
          <span className="text-sm">{gameState.myTeamName}</span>
          <span className="text-xl tabular-nums">{myScore} - {opponentScore}</span>
          <span className="text-sm">{gameState.game.opponent_name}</span>
        </div>
        <span className="text-sm font-medium">{gameState.currentInning}回{halfLabel}</span>
      </div>

      {input.autoSaveBanner && (
        <div className="flex items-center justify-between bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
          <span className="text-sm font-medium text-green-800 dark:text-green-200 flex items-center gap-1">
            <Check className="h-4 w-4" />{input.autoSaveBanner.playerName} → {input.autoSaveBanner.resultLabel} を記録
          </span>
          <Button variant="ghost" size="sm" className="text-green-800 dark:text-green-200 hover:text-green-900 dark:hover:text-green-100" onClick={() => { input.setAutoSaveBanner(null); actions.handleUndo(); }}>取消</Button>
        </div>
      )}

      <div className="flex items-start gap-2 sm:gap-4 px-1">
        <div className="shrink-0"><FieldRunnerDisplay baseRunners={gameState.baseRunners} className="w-20 h-20 sm:w-24 sm:h-24" /></div>
        <div className="flex-1 space-y-1.5 pt-1">
          {([{ label: "B", dots: 4, count: balls, color: "bg-green-500" }, { label: "S", dots: 3, count: strikes, color: "bg-yellow-500" }, { label: "O", dots: 3, count: gameState.currentOuts, color: "bg-red-500" }] as const).map(({ label, dots, count, color }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-base font-bold w-5">{label}</span>
              <div className="flex gap-1.5">
                {Array.from({ length: dots }, (_, i) => (
                  <div key={i} className={`w-6 h-6 rounded-full ${i < count ? color : "bg-muted border border-border"}`} />
                ))}
              </div>
              {label === "O" && <Badge variant="outline" className="ml-auto tabular-nums">{input.pitchLog.length}球</Badge>}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-baseline gap-2 px-1">
        {batterOrderLabel && <span className="text-sm text-muted-foreground shrink-0">{batterOrderLabel}</span>}
        <span className="text-base font-bold truncate">{batterName}</span>
      </div>

      <Button variant="outline" size="default" className="w-full" disabled={!hasRunners} onClick={() => { setShowStealDialog(true); clearError(); }}>盗塁 / 進塁 / アウト</Button>

      <div className="grid grid-cols-3 gap-2">
        {(["ball", "looking", "swinging"] as const).map((type) => (
          <Button key={type} size="lg" variant="outline" className="min-h-14 text-base" disabled={countFull} onClick={() => handlePitch(type)}>
            {type === "ball" ? "ボール" : type === "looking" ? "見逃し" : "空振り"}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-2">
        <Button size="lg" variant="outline" className="col-span-2 min-h-14 text-base" disabled={countFull} onClick={() => handlePitch("foul")}>ファウル</Button>
        <Button size="lg" variant="default" className="col-span-3 min-h-14 text-base font-bold" onClick={() => setShowInPlayDialog(true)}>★ インプレイ</Button>
      </div>

      <div className="grid grid-cols-4 gap-2 border-t pt-3">
        <Button variant="outline" size="default" className="text-sm" disabled={input.pitchLog.length === 0} onClick={handleUndoPitch}><Undo2 className="mr-1 h-4 w-4" />戻す</Button>
        <Button variant="outline" size="default" className="text-sm" onClick={() => { setShowSubDialog(true); clearError(); }}>選手交代</Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="outline" size="default" className="text-sm">その他<ChevronDown className="ml-1 h-3 w-3" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            <DropdownMenuItem disabled={actions.advanceRunnerOptions.length === 0} onClick={() => { setAdvanceEventType("wild_pitch"); const init: Record<string, string> = {}; for (const r of actions.advanceRunnerOptions) init[r.lineupId] = r.defaultToBase; setAdvanceSelections(init); setShowAdvanceDialog(true); clearError(); }}>WP / PB / BK</DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setShowPosChangeDialog(true); clearError(); }}>守備変更</DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setShowPitcherChange(true); clearError(); }}>投手交代</DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setShowUndoConfirm(true); clearError(); }}>打席取消</DropdownMenuItem>
            <DropdownMenuItem className="text-muted-foreground" onClick={() => { setShowFinishGame(true); clearError(); }}>試合終了</DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(`/games/${gameId}`)}>← 試合詳細</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="outline" size="default" className="text-sm" onClick={() => gameState.reload()}><RefreshCw className="mr-1 h-4 w-4" />更新</Button>
      </div>

      {input.actionError && <p className="text-destructive text-sm text-center">{input.actionError}</p>}

      <Dialog open={showInPlayDialog} onOpenChange={setShowInPlayDialog}>
        <DialogContent className="max-w-sm"><DialogHeader><DialogTitle>打席結果を選択</DialogTitle></DialogHeader><AtBatInput onSelect={(code, label) => { setShowInPlayDialog(false); clearError(); input.processResult(code, label); }} disabled={false} highlightCode={highlightCode} /></DialogContent>
      </Dialog>

      <RunnerDestinationDialog open={input.runnerDialogOpen} onOpenChange={input.setRunnerDialogOpen} pendingResult={input.pendingResult} runnerRows={input.runnerRows} batterLineupId={currentBatter?.id ?? ""} batterName={currentBatter?.player_name ?? "—"} batterDest={input.batterDest} baseRunners={gameState.baseRunners} lastResultCode={input.lastResultCode.current} saving={false} onRunnerDestChange={input.handleRunnerDestChange} onBatterDestChange={input.handleBatterDestChange} onSave={input.handleSaveAtBat} onCancel={() => { input.setRunnerDialogOpen(false); input.setPendingResult(null); }} />
      <InningChangeDialog open={input.showInningChange} nextInning={input.nextInningInfo?.inning ?? null} nextHalf={input.nextInningInfo?.half ?? null} onConfirm={input.handleInningChangeConfirm} />
      <PitcherChangeDialog open={showPitcherChange} onOpenChange={setShowPitcherChange} fieldingLineup={fieldingLineup} saving={false} onConfirm={(id) => { setShowPitcherChange(false); actions.handlePitcherChangeConfirm(id); }} />
      <FinishGameDialog open={showFinishGame} onOpenChange={setShowFinishGame} finishing={finishing} onConfirm={async () => { setFinishing(true); const ok = await actions.handleFinishGame(); setFinishing(false); if (ok) router.push(`/games/${gameId}`); }} />
      <StealDialog open={showStealDialog} onOpenChange={setShowStealDialog} runnerOptions={actions.stealRunnerOptions} saving={false} onSteal={(id, type) => { setShowStealDialog(false); actions.handleSteal(id, type); }} />
      <SubstitutionDialog open={showSubDialog} onOpenChange={setShowSubDialog} currentBatter={currentBatter} baseRunners={gameState.baseRunners} battingTeamSide={battingTeamSide} ownTeamSide={ownTeamSide} availablePlayers={availablePlayers} saving={false} onConfirm={(p) => { setShowSubDialog(false); actions.handleSubstitution(p); }} />
      <UndoConfirmDialog open={showUndoConfirm} onOpenChange={setShowUndoConfirm} undoing={false} onConfirm={() => { setShowUndoConfirm(false); actions.handleUndo(); }} />
      <AdvanceDialog open={showAdvanceDialog} onOpenChange={setShowAdvanceDialog} eventType={advanceEventType} onEventTypeChange={setAdvanceEventType} runnerOptions={actions.advanceRunnerOptions} selections={advanceSelections} onSelectionChange={(id, v) => setAdvanceSelections((prev) => ({ ...prev, [id]: v }))} saving={false} onConfirm={() => { if (actions.handleRunnerAdvance(advanceSelections, advanceEventType)) { setShowAdvanceDialog(false); setAdvanceSelections({}); } }} />
      <PositionChangeDialog open={showPosChangeDialog} onOpenChange={setShowPosChangeDialog} fieldingLineup={fieldingLineup} fieldingTeamSide={fieldingTeamSide} ownTeamSide={ownTeamSide} availablePlayers={availablePlayers} saving={false} onConfirm={(p) => { setShowPosChangeDialog(false); actions.handlePositionChange(p); }} />
    </div>
  );
}
