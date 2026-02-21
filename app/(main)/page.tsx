import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TeamCard } from "@/components/team/TeamCard";
import { GameCard } from "@/components/game/GameCard";
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

  // Fetch games for all teams
  const { data: games } = teamIds.length > 0
    ? await supabase
        .from("games")
        .select("id, opponent_name, game_date, is_home, status")
        .in("team_id", teamIds)
        .order("game_date", { ascending: false })
    : { data: [] };

  // Fetch scores for finished games from v_scoreboard
  const finishedGameIds = (games ?? [])
    .filter((g) => g.status === "finished")
    .map((g) => g.id);

  const scoreMap: Record<string, { home: number; visitor: number }> = {};
  if (finishedGameIds.length > 0) {
    const { data: scoreRows } = await supabase
      .from("v_scoreboard")
      .select("game_id, inning_half, runs")
      .in("game_id", finishedGameIds);

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
      {/* Games Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">試合一覧</h1>
          {teams.length > 0 && (
            <Link href="/games/new">
              <Button size="lg" className="min-h-16 text-lg">
                <PlusCircle className="mr-2 h-5 w-5" />
                新規試合登録
              </Button>
            </Link>
          )}
        </div>

        {(games ?? []).length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            試合がまだありません
          </p>
        ) : (
          <div className="grid gap-4">
            {(games ?? []).map((game) => (
              <GameCard
                key={game.id}
                game={game}
                score={scoreMap[game.id]}
              />
            ))}
          </div>
        )}
      </section>

      {/* Teams Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">チーム一覧</h2>
          <div className="flex gap-2">
            <JoinTeamDialog />
            <Link href="/team/new">
              <Button size="lg" className="min-h-16 text-lg">
                <PlusCircle className="mr-2 h-5 w-5" />
                チームを作成
              </Button>
            </Link>
          </div>
        </div>

        {teams.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <p className="text-muted-foreground text-lg">
              チームがまだありません
            </p>
            <p className="text-muted-foreground text-sm">
              チームを作成するか、招待コードでチームに参加してください
            </p>
            <div className="flex gap-3 justify-center mt-6">
              <JoinTeamDialog />
              <Link href="/team/new">
                <Button size="lg" className="min-h-16 text-lg">
                  <PlusCircle className="mr-2 h-5 w-5" />
                  チームを作成
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {teams.map((team) => (
              <TeamCard key={team.id} team={team} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
