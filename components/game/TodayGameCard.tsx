import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ClipboardEdit, Eye, Play, Radio } from "lucide-react";

interface TodayGameCardProps {
  game: {
    id: string;
    opponent_name: string;
    game_date: string;
    is_home: boolean;
    status: string;
    location?: string | null;
  };
  score?: { home: number; visitor: number };
  hasLineup?: boolean;
}

export function TodayGameCard({ game, score, hasLineup = false }: TodayGameCardProps) {
  const myScore = score
    ? game.is_home ? score.home : score.visitor
    : null;
  const opponentScore = score
    ? game.is_home ? score.visitor : score.home
    : null;

  const isReady = game.status === "scheduled" && hasLineup;
  const isInputting = game.status === "scheduled" && !hasLineup;
  const canSpectate = game.status !== "scheduled" || hasLineup;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            vs {game.opponent_name}
          </CardTitle>
          {game.status === "in_progress" ? (
            <Badge variant="default" className="bg-red-600">
              <Radio className="mr-1 h-3 w-3" />
              LIVE
            </Badge>
          ) : isReady ? (
            <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-300">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              準備完了
            </Badge>
          ) : isInputting ? (
            <Badge variant="secondary">準備中</Badge>
          ) : null}
        </div>
        <div className="text-sm text-muted-foreground">
          <p>
            {game.is_home ? "ホーム" : "ビジター"}
            {game.location && <span> / {game.location}</span>}
            {myScore !== null && opponentScore !== null && (
              <span className="ml-2 font-medium text-foreground">
                {myScore} - {opponentScore}
              </span>
            )}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Link href={`/games/${game.id}/input`} prefetch={false} className="flex-1">
            <Button
              size="lg"
              className="w-full min-h-14 text-lg"
              variant="outline"
            >
              {game.status === "scheduled" ? (
                <><ClipboardEdit className="mr-2 h-5 w-5" />編集</>
              ) : (
                <><Play className="mr-2 h-5 w-5" />記録</>
              )}
            </Button>
          </Link>
          {canSpectate ? (
            <Link href={`/games/${game.id}`} prefetch={false} className="flex-1">
              <Button
                size="lg"
                className="w-full min-h-14 text-lg"
                variant="outline"
              >
                <Eye className="mr-2 h-5 w-5" />
                観戦
              </Button>
            </Link>
          ) : (
            <Button
              size="lg"
              className="flex-1 min-h-14 text-lg"
              variant="outline"
              disabled
            >
              <Eye className="mr-2 h-5 w-5" />
              観戦
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
