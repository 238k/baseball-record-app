"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { GameActionButtons } from "@/components/game/GameActionButtons";
import { LineupTable, type LineupRow } from "@/components/game/LineupTable";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ClipboardEdit } from "lucide-react";
import type { GameInfo, LineupPlayer } from "@/hooks/useGameState";

interface ScheduledViewProps {
  game: GameInfo;
  gameId: string;
  myTeamName: string;
  lineups: LineupPlayer[];
  onStarted: () => void;
}

export function ScheduledView({
  game,
  gameId,
  myTeamName,
  lineups,
  onStarted,
}: ScheduledViewProps) {
  const router = useRouter();
  const myTeamSide = game.is_home ? "home" : "visitor";
  const lineupRows: LineupRow[] = lineups
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
        {myTeamName} vs {game.opponent_name}
      </h1>

      {hasLineup && (
        <LineupTable title={myTeamName} lineup={lineupRows} dhPitcher={null} />
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
        <GameActionButtons gameId={gameId} hasLineup={hasLineup} onStarted={onStarted} />
      </div>
    </div>
  );
}
