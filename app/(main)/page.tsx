import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TodayGameCard } from "@/components/game/TodayGameCard";
import { JoinTeamDialog } from "@/components/team/JoinTeamDialog";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

export default async function HomePage() {
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

  // Today's date in JST (YYYY-MM-DD)
  const todayString = new Date().toLocaleDateString("sv-SE", {
    timeZone: "Asia/Tokyo",
  });

  // Fetch today's team games
  const { data: teamGames } = teamIds.length > 0
    ? await supabase
        .from("games")
        .select("id, opponent_name, game_date, is_home, status, location, is_free_mode, home_team_name, visitor_team_name")
        .in("team_id", teamIds)
        .eq("game_date", todayString)
        .order("game_date", { ascending: false })
    : { data: [] };

  // Fetch today's free-mode games by this user
  const { data: freeGames } = await supabase
    .from("games")
    .select("id, opponent_name, game_date, is_home, status, location, is_free_mode, home_team_name, visitor_team_name")
    .eq("is_free_mode", true)
    .eq("created_by", user.id)
    .eq("game_date", todayString)
    .order("game_date", { ascending: false });

  // Merge and deduplicate
  type GameRow = NonNullable<typeof freeGames>[number];
  const gameMap = new Map<string, GameRow>();
  for (const g of teamGames ?? []) gameMap.set(g.id, g);
  for (const g of freeGames ?? []) gameMap.set(g.id, g);
  const games = Array.from(gameMap.values());

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
    <div className="space-y-8">
      {/* Today's Games Section */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl font-bold">今日の試合</h1>
          <div className="flex gap-2">
            <JoinTeamDialog />
            <Link href="/games/new">
              <Button size="lg" className="min-h-12 sm:min-h-16 text-base sm:text-lg">
                <PlusCircle className="mr-2 h-5 w-5" />
                新規試合登録
              </Button>
            </Link>
          </div>
        </div>

        {games.length === 0 ? (
          <div className="text-center py-8 space-y-4">
            <p className="text-muted-foreground">
              今日の試合はありません
            </p>
            {teams.length === 0 && (
              <div className="flex justify-center gap-4">
                <Link href="/team/new">
                  <Button size="lg" variant="outline" className="min-h-16 text-lg">
                    <PlusCircle className="mr-2 h-5 w-5" />
                    チームを作成
                  </Button>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {games.map((game) => (
              <TodayGameCard
                key={game.id}
                game={game}
                score={scoreMap[game.id]}
                hasLineup={lineupSet.has(game.id)}
              />
            ))}
          </div>
        )}

      </section>
    </div>
  );
}
