import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GameDetailClient } from "@/components/game/GameDetailClient";

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: gameId } = await params;
  const supabase = await createClient();

  const { data: game } = await supabase
    .from("games")
    .select("id, team_id, opponent_name, game_date, location, is_home, status, innings, use_dh, is_free_mode, home_team_name, visitor_team_name")
    .eq("id", gameId)
    .single();

  if (!game) notFound();

  // scheduled games without lineup redirect to lineup page
  if (game.status === "scheduled") {
    const { count } = await supabase
      .from("lineups")
      .select("id", { count: "exact", head: true })
      .eq("game_id", gameId);

    if (!count || count === 0) {
      redirect(`/games/${gameId}/lineup`);
    }
  }

  let teamName: string;
  if (game.is_free_mode) {
    teamName = game.home_team_name ?? "ホーム";
  } else {
    const { data: team } = await supabase
      .from("teams")
      .select("name")
      .eq("id", game.team_id!)
      .single();
    teamName = team?.name ?? "自チーム";
  }

  const opponentName = game.is_free_mode
    ? (game.visitor_team_name ?? "ビジター")
    : game.opponent_name;

  return (
    <GameDetailClient
      gameId={game.id}
      teamName={teamName}
      opponentName={opponentName}
      isHome={game.is_home}
      innings={game.innings}
      useDh={game.use_dh}
      gameDate={game.game_date}
      location={game.location}
      initialStatus={game.status}
      isFreeMode={game.is_free_mode}
    />
  );
}
