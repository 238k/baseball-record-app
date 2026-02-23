import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ArrowLeft } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BatterStatsTable } from "@/components/stats/BatterStatsTable"
import { PitcherStatsTable } from "@/components/stats/PitcherStatsTable"

export default async function PlayerStatsPage({
  params,
}: {
  params: Promise<{ id: string; playerId: string }>
}) {
  const { id: teamId, playerId } = await params

  const supabase = await createClient()

  // Verify auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  // Verify team membership
  const { data: membership } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("profile_id", user.id)
    .single()

  if (!membership) notFound()

  // Fetch player info
  const { data: player } = await supabase
    .from("players")
    .select("id, name, number, position, is_active")
    .eq("id", playerId)
    .eq("team_id", teamId)
    .single()

  if (!player) notFound()

  // Fetch stats in parallel
  const [batterCareerResult, batterGameResult, pitcherCareerResult, pitcherGameResult, gamesResult] = await Promise.all([
    supabase
      .from("v_batter_career_stats")
      .select("*")
      .eq("player_id", playerId)
      .eq("team_id", teamId),
    supabase
      .from("v_batter_game_stats")
      .select("*")
      .eq("player_id", playerId),
    supabase
      .from("v_pitcher_career_stats")
      .select("*")
      .eq("player_id", playerId)
      .eq("team_id", teamId),
    supabase
      .from("v_pitcher_game_stats")
      .select("*")
      .eq("player_id", playerId),
    supabase
      .from("games")
      .select("id, game_date, opponent_name, status")
      .eq("team_id", teamId)
      .in("status", ["in_progress", "finished"])
      .order("game_date", { ascending: false }),
  ])

  const batterCareer = batterCareerResult.data ?? []
  const batterGame = batterGameResult.data ?? []
  const pitcherCareer = pitcherCareerResult.data ?? []
  const pitcherGame = pitcherGameResult.data ?? []
  const games = gamesResult.data ?? []

  // Build game lookup for dates and opponents
  const gameMap = new Map(games.map((g) => [g.id, g]))

  // Enrich game stats with game info
  const enrichedBatterGame = batterGame
    .map((row) => {
      const game = row.game_id ? gameMap.get(row.game_id) : null
      return { ...row, game_date: game?.game_date ?? null, opponent_name: game?.opponent_name ?? null }
    })
    .sort((a, b) => {
      if (!a.game_date || !b.game_date) return 0
      return b.game_date.localeCompare(a.game_date)
    })

  const enrichedPitcherGame = pitcherGame
    .map((row) => {
      const game = row.game_id ? gameMap.get(row.game_id) : null
      return { ...row, game_date: game?.game_date ?? null, opponent_name: game?.opponent_name ?? null }
    })
    .sort((a, b) => {
      if (!a.game_date || !b.game_date) return 0
      return b.game_date.localeCompare(a.game_date)
    })

  const hasBatterStats = batterCareer.length > 0 || batterGame.length > 0
  const hasPitcherStats = pitcherCareer.length > 0 || pitcherGame.length > 0

  return (
    <div className="space-y-6">
      <Link
        href={`/team/${teamId}/players`}
        prefetch={false}
        className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        選手管理に戻る
      </Link>

      {/* Player header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          {player.number && (
            <span className="text-3xl font-bold text-muted-foreground font-mono">
              #{player.number}
            </span>
          )}
          <h1 className="text-2xl font-bold">{player.name}</h1>
          {player.position && <Badge variant="outline">{player.position}</Badge>}
          {!player.is_active && <Badge variant="secondary">引退</Badge>}
        </div>
      </div>

      {!hasBatterStats && !hasPitcherStats && (
        <p className="text-muted-foreground text-center py-8">
          成績データがありません
        </p>
      )}

      {/* Career batting stats */}
      {batterCareer.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">通算打撃成績</CardTitle>
          </CardHeader>
          <CardContent className="px-2">
            <BatterStatsTable mode="career" data={batterCareer} />
          </CardContent>
        </Card>
      )}

      {/* Game-by-game batting stats */}
      {enrichedBatterGame.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">試合別打撃成績</CardTitle>
          </CardHeader>
          <CardContent className="px-2">
            <BatterStatsTable mode="player" data={enrichedBatterGame} teamId={teamId} />
          </CardContent>
        </Card>
      )}

      {/* Career pitching stats */}
      {pitcherCareer.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">通算投手成績</CardTitle>
          </CardHeader>
          <CardContent className="px-2">
            <PitcherStatsTable mode="career" data={pitcherCareer} />
          </CardContent>
        </Card>
      )}

      {/* Game-by-game pitching stats */}
      {enrichedPitcherGame.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">試合別投手成績</CardTitle>
          </CardHeader>
          <CardContent className="px-2">
            <PitcherStatsTable mode="player" data={enrichedPitcherGame} teamId={teamId} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
