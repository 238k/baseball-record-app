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
import { ArrowLeft, ClipboardEdit, Eye, Pencil, Play } from "lucide-react";
import { GameStatsTabs } from "@/components/stats/GameStatsTabs";
import { GameActionButtons } from "@/components/game/GameActionButtons";

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
  id: string;
  batting_order: number;
  team_side: string;
  player_name: string | null;
  position: string | null;
  inning_from: number;
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
    .select("id, team_id, opponent_name, game_date, location, is_home, status, innings, use_dh")
    .eq("id", gameId)
    .single();

  if (!game) notFound();

  const showStats = game.status === "in_progress" || game.status === "finished";

  // Fetch lineups, team, and stats in parallel
  const [lineupsResult, teamResult, batterResult, pitcherResult] = await Promise.all([
    supabase
      .from("lineups")
      .select("id, batting_order, team_side, player_name, position, inning_from")
      .eq("game_id", gameId)
      .order("batting_order")
      .order("inning_from"),
    supabase
      .from("teams")
      .select("name")
      .eq("id", game.team_id)
      .single(),
    showStats
      ? supabase
          .from("v_batter_game_stats")
          .select("*")
          .eq("game_id", gameId)
          .order("batting_order")
      : null,
    showStats
      ? supabase
          .from("v_pitcher_game_stats")
          .select("*")
          .eq("game_id", gameId)
      : null,
  ]);

  const lineups = lineupsResult.data;
  const team = teamResult.data;
  const batterStats = batterResult?.data ?? [];
  const pitcherStats = pitcherResult?.data ?? [];

  const myTeamSide = game.is_home ? "home" : "visitor";
  const opponentSide = game.is_home ? "visitor" : "home";

  // Keep only the latest entry per (team_side, batting_order) — substituted players have higher inning_from
  // DH pitchers (position=投 sharing batting_order with DH) are kept separately
  const latestByKey = new Map<string, LineupRow>();
  const dhPitchers: LineupRow[] = [];
  for (const l of (lineups ?? []) as LineupRow[]) {
    // In DH games, pitchers sharing batting_order with a DH entry are handled separately
    if (game.use_dh && l.position === "投") {
      const hasDhAtSameOrder = (lineups ?? []).some(
        (other: LineupRow) => other.team_side === l.team_side && other.batting_order === l.batting_order && other.position === "DH"
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

  // DH pitchers already separated into dhPitchers array above
  const myLineup = allRows.filter((l) => l.team_side === myTeamSide);
  const myDhPitcher = dhPitchers.find((l) => l.team_side === myTeamSide) ?? null;

  const opponentLineupRaw = allRows.filter((l) => l.team_side === opponentSide);
  const opponentDhPitcher = dhPitchers.find((l) => l.team_side === opponentSide) ?? null;

  // Hide opponent lineup if all entries are placeholders
  const hasRealOpponentData = opponentLineupRaw.some(
    (l) => l.player_name && !l.player_name.startsWith("相手選手")
  );
  const opponentLineup = hasRealOpponentData ? opponentLineupRaw : [];
  const showOpponentPitcher = hasRealOpponentData && opponentDhPitcher != null;

  const lineupContent = (
    <>
      {myLineup.length > 0 && (
        <LineupTable
          title={team?.name ?? "自チーム"}
          lineup={myLineup}
          dhPitcher={myDhPitcher}
        />
      )}

      {opponentLineup.length > 0 && (
        <LineupTable
          title={game.opponent_name}
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

      {showStats ? (
        <GameStatsTabs
          lineupContent={lineupContent}
          batterStats={batterStats}
          pitcherStats={pitcherStats}
        />
      ) : (
        lineupContent
      )}

      {game.status === "scheduled" && (
        <div className="space-y-3">
          <div className="flex gap-3">
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
            <Link href={`/games/${gameId}/edit`} className="flex-1">
              <Button
                size="lg"
                variant="outline"
                className="w-full min-h-16 text-lg"
              >
                <Pencil className="mr-2 h-5 w-5" />
                試合情報を編集
              </Button>
            </Link>
          </div>
          <GameActionButtons gameId={gameId} hasLineup={myLineup.length > 0} />
        </div>
      )}
      {game.status === "in_progress" && (
        <div className="flex gap-3">
          <Link href={`/games/${gameId}/input`} className="flex-1">
            <Button
              size="lg"
              className="w-full min-h-16 text-lg bg-green-600 hover:bg-green-700"
            >
              <Play className="mr-2 h-5 w-5" />
              記録を入力する
            </Button>
          </Link>
          <Link href={`/games/${gameId}/spectate`} className="flex-1">
            <Button
              size="lg"
              variant="outline"
              className="w-full min-h-16 text-lg"
            >
              <Eye className="mr-2 h-5 w-5" />
              観戦する
            </Button>
          </Link>
        </div>
      )}
      {game.status === "finished" && (
        <Link href={`/games/${gameId}/spectate`} className="flex-1">
          <Button
            size="lg"
            variant="outline"
            className="w-full min-h-16 text-lg"
          >
            <Eye className="mr-2 h-5 w-5" />
            試合結果を見る
          </Button>
        </Link>
      )}
    </div>
  );
}

function LineupTable({
  title,
  lineup,
  dhPitcher,
}: {
  title: string;
  lineup: LineupRow[];
  dhPitcher?: LineupRow | null;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-2">
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
              <TableRow key={row.id}>
                <TableCell className="text-center font-medium">
                  {row.batting_order}
                </TableCell>
                <TableCell>{row.player_name ?? "—"}</TableCell>
                <TableCell className="text-center">
                  {row.position ?? "—"}
                </TableCell>
              </TableRow>
            ))}
            {dhPitcher && (
              <TableRow className="border-t-2">
                <TableCell className="text-center font-medium">
                  先発
                </TableCell>
                <TableCell>{dhPitcher.player_name ?? "—"}</TableCell>
                <TableCell className="text-center">投</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
