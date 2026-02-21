import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, ClipboardEdit, Play } from "lucide-react";

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

interface LineupRow {
  batting_order: number;
  team_side: string;
  player_name: string | null;
  position: string | null;
}

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: gameId } = await params;
  const supabase = await createClient();

  const { data: game } = await supabase
    .from("games")
    .select("id, team_id, opponent_name, game_date, location, is_home, status, innings")
    .eq("id", gameId)
    .single();

  if (!game) notFound();

  const { data: lineups } = await supabase
    .from("lineups")
    .select("batting_order, team_side, player_name, position")
    .eq("game_id", gameId)
    .order("batting_order");

  const myTeamSide = game.is_home ? "home" : "visitor";
  const opponentSide = game.is_home ? "visitor" : "home";

  const myLineup = (lineups ?? []).filter(
    (l: LineupRow) => l.team_side === myTeamSide
  );
  const opponentLineupRaw = (lineups ?? []).filter(
    (l: LineupRow) => l.team_side === opponentSide
  );
  // Hide opponent lineup if all entries are placeholders
  const hasRealOpponentData = opponentLineupRaw.some(
    (l) => l.player_name && !l.player_name.startsWith("相手選手")
  );
  const opponentLineup = hasRealOpponentData ? opponentLineupRaw : [];

  // Fetch team name
  const { data: team } = await supabase
    .from("teams")
    .select("name")
    .eq("id", game.team_id)
    .single();

  return (
    <div className="space-y-6">
      <Link
        href="/"
        prefetch={false}
        className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        トップに戻る
      </Link>

      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">
            {team?.name ?? "自チーム"} vs {game.opponent_name}
          </h1>
          <Badge variant={STATUS_VARIANTS[game.status] ?? "secondary"}>
            {STATUS_LABELS[game.status] ?? game.status}
          </Badge>
        </div>
        <div className="text-muted-foreground space-y-1">
          <p>
            {game.game_date} /{" "}
            {game.is_home ? "ホーム" : "ビジター"} /{" "}
            {game.innings}回制
          </p>
          {game.location && <p>{game.location}</p>}
        </div>
      </div>

      {myLineup.length > 0 && (
        <LineupTable
          title={team?.name ?? "自チーム"}
          lineup={myLineup}
        />
      )}

      {opponentLineup.length > 0 && (
        <LineupTable
          title={game.opponent_name}
          lineup={opponentLineup}
        />
      )}

      {myLineup.length === 0 && opponentLineup.length === 0 && (
        <p className="text-muted-foreground text-center py-8">
          オーダーが未登録です
        </p>
      )}

      <div className="flex gap-3">
        {game.status === "scheduled" && (
          <Link href={`/games/${gameId}/lineup`} className="flex-1">
            <Button
              size="lg"
              variant="outline"
              className="w-full min-h-16 text-lg"
            >
              <ClipboardEdit className="mr-2 h-5 w-5" />
              オーダーを編集する
            </Button>
          </Link>
        )}
        {game.status === "in_progress" && (
          <Link href={`/games/${gameId}/input`} className="flex-1">
            <Button
              size="lg"
              className="w-full min-h-16 text-lg bg-green-600 hover:bg-green-700"
            >
              <Play className="mr-2 h-5 w-5" />
              記録を入力する
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

function LineupTable({
  title,
  lineup,
}: {
  title: string;
  lineup: LineupRow[];
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-center">打順</TableHead>
              <TableHead>選手名</TableHead>
              <TableHead className="w-16 text-center">守備</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineup.map((row) => (
              <TableRow key={row.batting_order}>
                <TableCell className="text-center font-medium">
                  {row.batting_order}
                </TableCell>
                <TableCell>{row.player_name ?? "—"}</TableCell>
                <TableCell className="text-center">
                  {row.position ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
