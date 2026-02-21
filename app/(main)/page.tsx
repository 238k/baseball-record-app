import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TeamCard } from "@/components/team/TeamCard";
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">チーム一覧</h1>
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
    </div>
  );
}
