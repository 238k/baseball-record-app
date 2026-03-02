"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRealtimeGame } from "@/hooks/useRealtimeGame";
import { ScoreBoard } from "@/components/game/ScoreBoard";
import { OutCount } from "@/components/game/OutCount";
import { FieldRunnerDisplay } from "@/components/field/FieldRunnerDisplay";
import { InningScoreTable } from "@/components/game/InningScoreTable";
import { RecentAtBatLog } from "@/components/game/RecentAtBatLog";
import { PitchCountDisplay } from "@/components/game/PitchCountDisplay";
import { BatterStatsTable } from "@/components/stats/BatterStatsTable";
import { PitcherStatsTable } from "@/components/stats/PitcherStatsTable";
import { LineupTable, type LineupRow } from "@/components/game/LineupTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Loader2,
  Play,
  Radio,
  RefreshCw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type BatterGameStats = Database["public"]["Views"]["v_batter_game_stats"]["Row"];
type PitcherGameStats = Database["public"]["Views"]["v_pitcher_game_stats"]["Row"];

interface GameDetailClientProps {
  gameId: string;
  teamName: string;
  opponentName: string;
  isHome: boolean;
  innings: number;
  useDh: boolean;
  gameDate: string;
  location: string | null;
  initialStatus: string;
  isFreeMode?: boolean;
}

export function GameDetailClient({
  gameId,
  teamName,
  opponentName,
  isHome,
  innings,
  useDh,
  gameDate,
  location,
  initialStatus,
  isFreeMode = false,
}: GameDetailClientProps) {
  const router = useRouter();
  const state = useRealtimeGame(gameId);

  const [batterStats, setBatterStats] = useState<BatterGameStats[]>([]);
  const [pitcherStats, setPitcherStats] = useState<PitcherGameStats[]>([]);
  const [statsVersion, setStatsVersion] = useState(0);

  const fetchStats = useCallback(async () => {
    const supabase = createClient();
    const [batterRes, pitcherRes] = await Promise.all([
      supabase
        .from("v_batter_game_stats")
        .select("*")
        .eq("game_id", gameId)
        .order("batting_order"),
      supabase
        .from("v_pitcher_game_stats")
        .select("*")
        .eq("game_id", gameId),
    ]);
    setBatterStats(batterRes.data ?? []);
    setPitcherStats(pitcherRes.data ?? []);
  }, [gameId]);

  // Fetch stats client-side for in_progress / finished games
  useEffect(() => {
    const status = state.game?.status ?? initialStatus;
    if (status !== "in_progress" && status !== "finished") return;
    fetchStats();
  }, [gameId, state.game?.status, initialStatus, statsVersion, fetchStats]);

  const handleReload = () => {
    state.reload();
    setStatsVersion((v) => v + 1);
  };

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
        <Button variant="outline" onClick={() => router.push("/")}>
          トップに戻る
        </Button>
      </div>
    );
  }

  const currentStatus = state.game.status;
  const isLive = currentStatus === "in_progress";
  const isFinished = currentStatus === "finished";
  const isShowStats = isLive || isFinished;

  // Build lineup data from useRealtimeGame lineups
  const myTeamSide = isHome ? "home" : "visitor";
  const opponentSide = isHome ? "visitor" : "home";

  const lineupRows: LineupRow[] = state.lineups.map((l) => ({
    id: l.id,
    batting_order: l.batting_order,
    team_side: l.team_side,
    player_name: l.player_name,
    position: l.position,
    inning_from: l.inning_from,
  }));

  // Dedup lineup: latest entry per (team_side, batting_order), DH pitchers separate
  const latestByKey = new Map<string, LineupRow>();
  const dhPitchers: LineupRow[] = [];
  for (const l of lineupRows) {
    if (useDh && l.position === "投") {
      const hasDhAtSameOrder = lineupRows.some(
        (other) =>
          other.team_side === l.team_side &&
          other.batting_order === l.batting_order &&
          other.position === "DH"
      );
      if (hasDhAtSameOrder) {
        dhPitchers.push(l);
        continue;
      }
    }
    const key = `${l.team_side}-${l.batting_order}`;
    const existing = latestByKey.get(key);
    if (!existing || l.inning_from >= existing.inning_from) {
      latestByKey.set(key, l);
    }
  }
  const allRows = Array.from(latestByKey.values());

  const myLineup = allRows.filter((l) => l.team_side === myTeamSide);
  const myDhPitcher = dhPitchers.find((l) => l.team_side === myTeamSide) ?? null;
  const opponentLineupRaw = allRows.filter((l) => l.team_side === opponentSide);
  const opponentDhPitcher = dhPitchers.find((l) => l.team_side === opponentSide) ?? null;

  const hasRealOpponentData = opponentLineupRaw.some(
    (l) => l.player_name && !l.player_name.startsWith("相手選手")
  );
  const opponentLineup = hasRealOpponentData ? opponentLineupRaw : [];
  const showOpponentPitcher = hasRealOpponentData && opponentDhPitcher != null;

  const lineupContent = (
    <>
      {myLineup.length > 0 && (
        <LineupTable
          title={teamName}
          lineup={myLineup}
          dhPitcher={myDhPitcher}
        />
      )}
      {opponentLineup.length > 0 && (
        <LineupTable
          title={opponentName}
          lineup={opponentLineup}
          dhPitcher={showOpponentPitcher ? opponentDhPitcher : null}
        />
      )}
      {myLineup.length === 0 && opponentLineup.length === 0 && (
        <p className="text-muted-foreground text-center py-8">
          オーダーが未登録です
        </p>
      )}
    </>
  );

  // Current batter/pitcher for live display
  const battingTeamSide = state.currentHalf === "top" ? "visitor" : "home";
  const fieldingTeamSide = state.currentHalf === "top" ? "home" : "visitor";
  const battingLineup = state.lineups.filter((l) => l.team_side === battingTeamSide);
  const fieldingLineup = state.lineups.filter((l) => l.team_side === fieldingTeamSide);
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
        <Link
          href="/"
          className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          トップに戻る
        </Link>
        <div className="flex items-center gap-2">
          {isLive && (
            <Badge variant="default" className="bg-red-600">
              <Radio className="mr-1 h-3 w-3" />
              LIVE
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={handleReload}>
            <RefreshCw className="mr-1 h-4 w-4" />
            更新
          </Button>
        </div>
      </div>

      {/* Game title and meta */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">
          {teamName} vs {opponentName}
        </h1>
        <div className="text-muted-foreground space-y-1">
          <p>
            {gameDate}{!isFreeMode && ` / ${isHome ? "ホーム" : "ビジター"}`} / {innings}回制
          </p>
          {location && <p>{location}</p>}
        </div>
      </div>

      {/* Score */}
      <ScoreBoard
        myTeamName={teamName}
        opponentName={opponentName}
        isHome={isHome}
        score={state.score}
        currentInning={state.currentInning}
        currentHalf={state.currentHalf}
      />

      {/* Record input button (hide for finished games) */}
      {!isFinished && (
        <>
          <Link href={`/games/${gameId}/input`}>
            <Button
              size="lg"
              className="w-full min-h-16 text-lg bg-green-600 hover:bg-green-700"
            >
              <Play className="mr-2 h-5 w-5" />
              記録を入力する
            </Button>
          </Link>

          {/* Input holder */}
          {state.inputHolder && (
            <p className="text-xs text-muted-foreground text-center">
              入力者: {state.inputHolder.displayName}
            </p>
          )}
        </>
      )}

      {/* Tabbed content */}
      <Tabs defaultValue="live">
        <TabsList className="w-full">
          <TabsTrigger value="live">速報</TabsTrigger>
          <TabsTrigger value="lineup">オーダー</TabsTrigger>
          {isShowStats && (
            <>
              <TabsTrigger value="batter">打者成績</TabsTrigger>
              <TabsTrigger value="pitcher">投手成績</TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Live / Overview tab */}
        <TabsContent value="live" className="mt-4 space-y-4">
          <Card>
            <CardContent className="pt-4 pb-3 px-3">
              <InningScoreTable
                myTeamName={teamName}
                opponentName={opponentName}
                isHome={isHome}
                inningScores={state.inningScores}
                totalScore={state.score}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center gap-2 sm:gap-4">
                <FieldRunnerDisplay
                  baseRunners={state.baseRunners}
                  className="w-24 h-24 sm:w-32 sm:h-32 shrink-0"
                />
                <OutCount outs={state.currentOuts} />
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

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">直近の記録</CardTitle>
            </CardHeader>
            <CardContent>
              <RecentAtBatLog
                recentAtBats={state.recentAtBats}
                liveAtBat={
                  currentBatter
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
        </TabsContent>

        {/* Lineup tab */}
        <TabsContent value="lineup" className="mt-4 space-y-4">
          {lineupContent}
        </TabsContent>

        {/* Batter stats tab */}
        {isShowStats && (
          <TabsContent value="batter" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">打者成績</CardTitle>
              </CardHeader>
              <CardContent className="px-2">
                <BatterStatsTable mode="game" data={batterStats} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Pitcher stats tab */}
        {isShowStats && (
          <TabsContent value="pitcher" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">投手成績</CardTitle>
              </CardHeader>
              <CardContent className="px-2">
                <PitcherStatsTable mode="game" data={pitcherStats} />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
