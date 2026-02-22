"use client";

import { useParams, useRouter } from "next/navigation";
import { useRealtimeGame } from "@/hooks/useRealtimeGame";
import { ScoreBoard } from "@/components/game/ScoreBoard";
import { OutCount } from "@/components/game/OutCount";
import { RunnerDisplay } from "@/components/game/RunnerDisplay";
import { InningScoreTable } from "@/components/game/InningScoreTable";
import { RecentAtBatLog } from "@/components/game/RecentAtBatLog";
import { PitchCountDisplay } from "@/components/game/PitchCountDisplay";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Radio, RefreshCw } from "lucide-react";

export default function SpectatePage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.id as string;

  const state = useRealtimeGame(gameId);

  if (state.loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state.error || !state.game) {
    return (
      <div className="space-y-4 text-center py-16">
        <p className="text-destructive">
          {state.error ?? "試合データが見つかりません"}
        </p>
        <Button
          variant="outline"
          onClick={() => router.push(`/games/${gameId}`)}
        >
          試合詳細に戻る
        </Button>
      </div>
    );
  }

  const isLive = state.game.status === "in_progress";

  // Determine current batter and pitcher for display
  const battingTeamSide =
    state.currentHalf === "top" ? "visitor" : "home";
  const fieldingTeamSide =
    state.currentHalf === "top" ? "home" : "visitor";

  const battingLineup = state.lineups.filter(
    (l) => l.team_side === battingTeamSide
  );
  const fieldingLineup = state.lineups.filter(
    (l) => l.team_side === fieldingTeamSide
  );

  const currentBatter = battingLineup.find(
    (l) => l.batting_order === state.currentBatterOrder
  );
  const currentPitcher = fieldingLineup.find((l) => l.position === "投");

  const batterDisplay = currentBatter
    ? `${currentBatter.player_number ? `#${currentBatter.player_number} ` : ""}${currentBatter.player_name ?? "—"}`
    : "—";
  const pitcherDisplay = currentPitcher
    ? `${currentPitcher.player_number ? `#${currentPitcher.player_number} ` : ""}${currentPitcher.player_name ?? "—"}`
    : "—";

  return (
    <div className="space-y-4 pb-8">
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
        <div className="flex items-center gap-2">
          {isLive && (
            <Badge variant="default" className="bg-red-600">
              <Radio className="mr-1 h-3 w-3" />
              LIVE
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => state.reload()}
          >
            <RefreshCw className="mr-1 h-4 w-4" />
            更新
          </Button>
        </div>
      </div>

      {/* Large score display */}
      <ScoreBoard
        myTeamName={state.myTeamName}
        opponentName={state.game.opponent_name}
        isHome={state.game.is_home}
        score={state.score}
        currentInning={state.currentInning}
        currentHalf={state.currentHalf}
      />

      {/* Inning-by-inning scores */}
      <Card>
        <CardContent className="pt-4 pb-3 px-3">
          <InningScoreTable
            myTeamName={state.myTeamName}
            opponentName={state.game.opponent_name}
            isHome={state.game.is_home}
            inningScores={state.inningScores}
            totalScore={state.score}
          />
        </CardContent>
      </Card>

      {/* Current situation */}
      {isLive && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <OutCount outs={state.currentOuts} />
              <RunnerDisplay baseRunners={state.baseRunners} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <div>
                <span className="text-muted-foreground">打者: </span>
                <span className="font-medium">{batterDisplay}</span>
              </div>
              <div>
                <span className="text-muted-foreground">投手: </span>
                <span className="font-medium">{pitcherDisplay}</span>
              </div>
            </div>
            <PitchCountDisplay pitchLog={state.currentPitchLog} />
          </CardContent>
        </Card>
      )}

      {/* Recent at-bat log */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">直近の記録</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentAtBatLog
            recentAtBats={state.recentAtBats}
            liveAtBat={
              isLive && currentBatter
                ? {
                    inning: state.currentInning,
                    inning_half: state.currentHalf,
                    playerName: batterDisplay,
                    pitches: state.currentPitchLog,
                  }
                : null
            }
          />
        </CardContent>
      </Card>

      {/* Input holder info */}
      {state.inputHolder && (
        <p className="text-xs text-muted-foreground text-center">
          入力者: {state.inputHolder.displayName}
        </p>
      )}
    </div>
  );
}
