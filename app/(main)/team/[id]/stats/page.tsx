import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ArrowLeft } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BatterStatsTable } from "@/components/stats/BatterStatsTable"
import { PitcherStatsTable } from "@/components/stats/PitcherStatsTable"

export default async function TeamStatsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: teamId } = await params

  const supabase = await createClient()

  // Verify team membership
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: membership } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("profile_id", user.id)
    .single()

  if (!membership) notFound()

  const [teamResult, batterResult, pitcherResult] = await Promise.all([
    supabase.from("teams").select("name").eq("id", teamId).single(),
    supabase
      .from("v_batter_career_stats")
      .select("*")
      .eq("team_id", teamId)
      .order("plate_appearances", { ascending: false }),
    supabase
      .from("v_pitcher_career_stats")
      .select("*")
      .eq("team_id", teamId)
      .order("games", { ascending: false }),
  ])

  if (!teamResult.data) notFound()

  const team = teamResult.data
  const batterStats = batterResult.data ?? []
  const pitcherStats = pitcherResult.data ?? []

  return (
    <div className="space-y-6">
      <Link
        href={`/team/${teamId}`}
        className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        {team.name} に戻る
      </Link>

      <h1 className="text-2xl font-bold">{team.name} — 通算成績</h1>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">打者成績</CardTitle>
        </CardHeader>
        <CardContent className="px-2">
          <BatterStatsTable mode="career" data={batterStats} teamId={teamId} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">投手成績</CardTitle>
        </CardHeader>
        <CardContent className="px-2">
          <PitcherStatsTable mode="career" data={pitcherStats} teamId={teamId} />
        </CardContent>
      </Card>
    </div>
  )
}
