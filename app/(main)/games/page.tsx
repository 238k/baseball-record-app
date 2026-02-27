import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GameCard } from "@/components/game/GameCard";
import { ArrowLeft } from "lucide-react";

export default async function GamesListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("team_members")
    .select("role, teams(id, name)")
    .eq("profile_id", user.id);

  const teams = (memberships ?? []).flatMap((m) => {
    if (!m.teams) return [];
    const t = m.teams as { id: string; name: string };
    return [{ id: t.id, name: t.name, role: m.role }];
  });

  const teamIds = teams.map((t) => t.id);

  // Fetch team games
  const { data: teamGames } = teamIds.length > 0
    ? await supabase
        .from("games")
        .select("id, opponent_name, game_date, is_home, status, is_free_mode, home_team_name, visitor_team_name")
        .in("team_id", teamIds)
        .order("game_date", { ascending: false })
    : { data: [] };

  // Fetch free-mode games by this user
  const { data: freeGames } = await supabase
    .from("games")
    .select("id, opponent_name, game_date, is_home, status, is_free_mode, home_team_name, visitor_team_name")
    .eq("is_free_mode", true)
    .eq("created_by", user.id)
    .order("game_date", { ascending: false });

  // Merge, deduplicate, sort by game_date desc
  type GameRow = NonNullable<typeof freeGames>[number];
  const gameMap = new Map<string, GameRow>();
  for (const g of teamGames ?? []) gameMap.set(g.id, g);
  for (const g of freeGames ?? []) gameMap.set(g.id, g);
  const games = Array.from(gameMap.values()).sort(
    (a, b) => b.game_date.localeCompare(a.game_date)
  );

  // Fetch lineup existence for scheduled games
  const scheduledGameIds = games
    .filter((g) => g.status === "scheduled")
    .map((g) => g.id);

  const lineupSet = new Set<string>();
  if (scheduledGameIds.length > 0) {
    const { data: lineupRows } = await supabase
      .from("lineups")
      .select("game_id")
      .in("game_id", scheduledGameIds);

    for (const row of lineupRows ?? []) {
      if (row.game_id) lineupSet.add(row.game_id);
    }
  }

  // Fetch scores for finished and in_progress games from v_scoreboard
  const scorableGameIds = games
    .filter((g) => g.status === "finished" || g.status === "in_progress")
    .map((g) => g.id);

  const scoreMap: Record<string, { home: number; visitor: number }> = {};
  if (scorableGameIds.length > 0) {
    const { data: scoreRows } = await supabase
      .from("v_scoreboard")
      .select("game_id, inning_half, runs")
      .in("game_id", scorableGameIds);

    for (const row of scoreRows ?? []) {
      if (!row.game_id) continue;
      if (!scoreMap[row.game_id]) {
        scoreMap[row.game_id] = { home: 0, visitor: 0 };
      }
      if (row.inning_half === "bottom") {
        scoreMap[row.game_id].home += row.runs ?? 0;
      } else {
        scoreMap[row.game_id].visitor += row.runs ?? 0;
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <Link
          href="/"
          prefetch={false}
          className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          トップに戻る
        </Link>
      </div>

      <h1 className="text-2xl font-bold">試合一覧</h1>

      {games.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          試合がまだありません
        </p>
      ) : (
        <div className="grid gap-4">
          {games.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              score={scoreMap[game.id]}
              hasLineup={lineupSet.has(game.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
