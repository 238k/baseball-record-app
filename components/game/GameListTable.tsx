import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle2, ClipboardEdit, Play, Radio } from "lucide-react";

interface GameRow {
  id: string;
  opponent_name: string;
  game_date: string;
  is_home: boolean;
  status: string;
  is_free_mode?: boolean;
  home_team_name?: string | null;
  visitor_team_name?: string | null;
}

interface GameListTableProps {
  games: GameRow[];
  scoreMap: Record<string, { home: number; visitor: number }>;
  lineupSet: Set<string>;
}

function StatusBadge({ status, hasLineup }: { status: string; hasLineup: boolean }) {
  if (status === "in_progress") {
    return (
      <Badge variant="default" className="bg-red-600">
        <Radio className="mr-1 h-3 w-3" />
        LIVE
      </Badge>
    );
  }
  if (status === "scheduled" && hasLineup) {
    return (
      <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-300">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        準備完了
      </Badge>
    );
  }
  if (status === "scheduled") {
    return <Badge variant="secondary">準備中</Badge>;
  }
  if (status === "finished") {
    return <Badge variant="outline">試合終了</Badge>;
  }
  return <Badge variant="secondary">{status}</Badge>;
}

export function GameListTable({ games, scoreMap, lineupSet }: GameListTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>日付</TableHead>
          <TableHead>対戦</TableHead>
          <TableHead>スコア</TableHead>
          <TableHead>状態</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {games.map((game) => {
          const isFree = game.is_free_mode ?? false;
          const score = scoreMap[game.id];
          const hasLineup = lineupSet.has(game.id);

          const matchup = isFree
            ? `${game.home_team_name ?? "ホーム"} vs ${game.visitor_team_name ?? "ビジター"}`
            : `vs ${game.opponent_name}`;

          const myScore = score
            ? isFree ? score.home : game.is_home ? score.home : score.visitor
            : null;
          const opponentScore = score
            ? isFree ? score.visitor : game.is_home ? score.visitor : score.home
            : null;

          return (
            <TableRow key={game.id}>
              <TableCell className="text-muted-foreground">
                {game.game_date}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/games/${game.id}`}
                    className="font-medium hover:underline"
                  >
                    {matchup}
                  </Link>
                  {isFree && (
                    <Badge variant="outline" className="text-xs">
                      フリー
                    </Badge>
                  )}
                  {!isFree && (
                    <span className="text-xs text-muted-foreground">
                      {game.is_home ? "ホーム" : "ビジター"}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {myScore !== null && opponentScore !== null ? (
                  <span className="font-medium tabular-nums">
                    {myScore} - {opponentScore}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge status={game.status} hasLineup={hasLineup} />
              </TableCell>
              {game.status !== "finished" && (
                <TableCell className="text-right">
                  <Link href={`/games/${game.id}/input`}>
                    <Button size="sm" variant="outline">
                      {game.status === "scheduled" ? (
                        <><ClipboardEdit className="mr-1 h-3.5 w-3.5" />編集</>
                      ) : (
                        <><Play className="mr-1 h-3.5 w-3.5" />記録</>
                      )}
                    </Button>
                  </Link>
                </TableCell>
              )}
              {game.status === "finished" && (
                <TableCell />
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
