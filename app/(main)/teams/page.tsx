import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { JoinTeamDialog } from "@/components/team/JoinTeamDialog";
import { TeamSwitcher } from "@/components/team/TeamSwitcher";
import { EditTeamNameDialog } from "@/components/team/EditTeamNameDialog";
import { ActiveSessionsSection } from "@/components/team/ActiveSessionsSection";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Users, UserCog, BarChart3 } from "lucide-react";

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const { team: teamParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch profile for default_team_id
  const { data: profile } = await supabase
    .from("profiles")
    .select("default_team_id")
    .eq("id", user.id)
    .single();

  const { data: memberships } = await supabase
    .from("team_members")
    .select("role, teams(id, name)")
    .eq("profile_id", user.id);

  const teams = (memberships ?? []).flatMap((m) => {
    if (!m.teams) return [];
    const t = m.teams as { id: string; name: string };
    return [{ id: t.id, name: t.name, role: m.role }];
  });

  // No teams: show empty state
  if (teams.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">マイチーム</h1>
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
      </div>
    );
  }

  // Determine which team to show
  const selectedTeamId =
    teamParam && teams.some((t) => t.id === teamParam)
      ? teamParam
      : profile?.default_team_id && teams.some((t) => t.id === profile.default_team_id)
        ? profile.default_team_id
        : teams[0].id;

  const selectedTeam = teams.find((t) => t.id === selectedTeamId)!;

  // Fetch team detail
  const { data: teamDetail } = await supabase
    .from("teams")
    .select("id, name, invite_code")
    .eq("id", selectedTeamId)
    .single();

  const isAdmin = selectedTeam.role === "admin";

  // Fetch active input sessions for admin
  let activeSessions: {
    gameId: string;
    opponentName: string;
    gameDate: string;
    holderName: string;
    lastActiveAt: string;
  }[] = [];

  if (isAdmin) {
    const { data: gameIds } = await supabase
      .from("games")
      .select("id")
      .eq("team_id", selectedTeamId);

    const ids = (gameIds ?? []).map((g) => g.id);
    if (ids.length > 0) {
      const { data: sessions } = await supabase
        .from("game_input_sessions")
        .select(
          "game_id, profile_id, last_active_at, games(opponent_name, game_date), profiles(display_name)"
        )
        .in("game_id", ids);

      activeSessions = (sessions ?? []).map((s) => ({
        gameId: s.game_id,
        opponentName:
          (s.games as { opponent_name: string } | null)?.opponent_name ?? "不明",
        gameDate:
          (s.games as { game_date: string } | null)?.game_date ?? "",
        holderName:
          (s.profiles as { display_name: string } | null)?.display_name ??
          "不明",
        lastActiveAt: s.last_active_at,
      }));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">マイチーム</h1>
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

      {/* Team switcher */}
      <TeamSwitcher
        teams={teams.map((t) => ({ id: t.id, name: t.name }))}
        currentTeamId={selectedTeamId}
      />

      {/* Team detail card */}
      {teamDetail && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-2xl">{teamDetail.name}</CardTitle>
                <div className="mt-1">
                  <Badge variant={isAdmin ? "default" : "secondary"}>
                    {isAdmin ? "管理者" : "メンバー"}
                  </Badge>
                </div>
              </div>
              {isAdmin && (
                <EditTeamNameDialog
                  teamId={teamDetail.id}
                  currentName={teamDetail.name}
                />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              招待コード：
              <span className="font-mono font-bold text-foreground text-base">
                {teamDetail.invite_code}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Menu cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href={`/team/${selectedTeamId}/players`}>
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
            <CardContent className="pt-6 pb-6 flex flex-col items-center justify-center gap-3 min-h-32">
              <Users className="h-10 w-10 text-muted-foreground" />
              <span className="text-xl font-semibold">選手管理</span>
              <span className="text-sm text-muted-foreground">
                選手の登録・編集・引退
              </span>
            </CardContent>
          </Card>
        </Link>

        <Link href={`/team/${selectedTeamId}/invite`}>
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
            <CardContent className="pt-6 pb-6 flex flex-col items-center justify-center gap-3 min-h-32">
              <UserCog className="h-10 w-10 text-muted-foreground" />
              <span className="text-xl font-semibold">招待・メンバー管理</span>
              <span className="text-sm text-muted-foreground">
                招待コード・メンバー一覧
              </span>
            </CardContent>
          </Card>
        </Link>

        <Link href={`/team/${selectedTeamId}/stats`}>
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
            <CardContent className="pt-6 pb-6 flex flex-col items-center justify-center gap-3 min-h-32">
              <BarChart3 className="h-10 w-10 text-muted-foreground" />
              <span className="text-xl font-semibold">成績</span>
              <span className="text-sm text-muted-foreground">
                打者・投手の通算成績
              </span>
            </CardContent>
          </Card>
        </Link>
      </div>

      {isAdmin && (
        <ActiveSessionsSection
          teamId={selectedTeamId}
          sessions={activeSessions}
        />
      )}
    </div>
  );
}
