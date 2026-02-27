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

interface GameCardProps {
  game: {
    id: string;
    opponent_name: string;
    game_date: string;
    is_home: boolean;
    status: string;
    is_free_mode?: boolean;
    home_team_name?: string | null;
    visitor_team_name?: string | null;
  };
  score?: { home: number; visitor: number };
  hasLineup?: boolean;
}

function getDisplayStatus(status: string, hasLineup: boolean) {
  if (status === "scheduled") {
    return hasLineup
      ? { label: "準備完了", variant: "secondary" as const }
      : { label: "準備中", variant: "secondary" as const };
  }
  if (status === "in_progress") return { label: "試合中", variant: "default" as const };
  if (status === "finished") return { label: "終了", variant: "outline" as const };
  return { label: status, variant: "secondary" as const };
}

export function GameCard({ game, score, hasLineup = false }: GameCardProps) {
  const isFree = game.is_free_mode ?? false;

  const myScore = score
    ? isFree ? score.home : game.is_home ? score.home : score.visitor
    : null;
  const opponentScore = score
    ? isFree ? score.visitor : game.is_home ? score.visitor : score.home
    : null;

  const isReady = game.status === "scheduled" && hasLineup;
  const displayStatus = getDisplayStatus(game.status, hasLineup);
  const canSpectate = game.status !== "scheduled" || hasLineup;

  const title = isFree
    ? `${game.home_team_name ?? "ホーム"} vs ${game.visitor_team_name ?? "ビジター"}`
    : `vs ${game.opponent_name}`;

  return (
    <Card className="hover:bg-accent/50 transition-colors">
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
                {displayStatus.label}
              </Badge>
            ) : (
              <Badge variant={displayStatus.variant}>
                {displayStatus.label}
              </Badge>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {game.game_date}{!isFree && ` / ${game.is_home ? "ホーム" : "ビジター"}`}
          {myScore !== null && opponentScore !== null && (
            <span className="ml-2 font-medium text-foreground">
              {myScore} - {opponentScore}
            </span>
          )}
        </p>
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
