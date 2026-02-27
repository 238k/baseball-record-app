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
    is_free_mode?: boolean;
    home_team_name?: string | null;
    visitor_team_name?: string | null;
  };
  score?: { home: number; visitor: number };
  hasLineup?: boolean;
}

export function TodayGameCard({ game, score, hasLineup = false }: TodayGameCardProps) {
  const isFree = game.is_free_mode ?? false;

  const myScore = score
    ? isFree ? score.home : game.is_home ? score.home : score.visitor
    : null;
  const opponentScore = score
    ? isFree ? score.visitor : game.is_home ? score.visitor : score.home
    : null;

  const isReady = game.status === "scheduled" && hasLineup;
  const isInputting = game.status === "scheduled" && !hasLineup;
  const canSpectate = game.status !== "scheduled" || hasLineup;

  const title = isFree
    ? `${game.home_team_name ?? "ホーム"} vs ${game.visitor_team_name ?? "ビジター"}`
    : `vs ${game.opponent_name}`;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base sm:text-lg min-w-0 break-all">
            {title}
          </CardTitle>
          <div className="flex items-center gap-2 shrink-0">
            {isFree && (
              <Badge variant="outline" className="text-xs">
                フリー
              </Badge>
            )}
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
        </div>
        <div className="text-sm text-muted-foreground">
          <p>
            {!isFree && (game.is_home ? "ホーム" : "ビジター")}
            {game.location && <span>{!isFree && " / "}{game.location}</span>}
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
              className="w-full min-h-11 sm:min-h-14 text-base sm:text-lg"
              variant="outline"
            >
              {game.status === "scheduled" ? (
                <><ClipboardEdit className="mr-1.5 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />編集</>
              ) : (
                <><Play className="mr-1.5 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />記録</>
              )}
            </Button>
          </Link>
          {canSpectate ? (
            <Link href={`/games/${game.id}`} prefetch={false} className="flex-1">
              <Button
                size="lg"
                className="w-full min-h-11 sm:min-h-14 text-base sm:text-lg"
                variant="outline"
              >
                <Eye className="mr-1.5 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                観戦
              </Button>
            </Link>
          ) : (
            <Button
              size="lg"
              className="flex-1 min-h-11 sm:min-h-14 text-base sm:text-lg"
              variant="outline"
              disabled
            >
              <Eye className="mr-1.5 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              観戦
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
