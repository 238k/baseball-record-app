import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  scheduled: "試合前",
  in_progress: "試合中",
  finished: "終了",
};

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  scheduled: "secondary",
  in_progress: "default",
  finished: "outline",
};

interface GameCardProps {
  game: {
    id: string;
    opponent_name: string;
    game_date: string;
    is_home: boolean;
    status: string;
  };
}

export function GameCard({ game }: GameCardProps) {
  return (
    <Card className="hover:bg-accent/50 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            vs {game.opponent_name}
          </CardTitle>
          <Badge variant={STATUS_VARIANTS[game.status] ?? "secondary"}>
            {STATUS_LABELS[game.status] ?? game.status}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {game.game_date} / {game.is_home ? "ホーム" : "ビジター"}
        </p>
      </CardHeader>
      <CardContent>
        <Link href={`/games/${game.id}`} prefetch={false}>
          <Button
            size="lg"
            className="w-full min-h-14 text-lg"
            variant="outline"
          >
            試合詳細
            <ChevronRight className="ml-auto h-5 w-5" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
