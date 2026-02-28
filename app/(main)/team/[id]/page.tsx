import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Users, UserCog, BarChart3 } from 'lucide-react'
import { EditTeamNameDialog } from '@/components/team/EditTeamNameDialog'
import { ActiveSessionsSection } from '@/components/team/ActiveSessionsSection'

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: team } = await supabase
    .from('teams')
    .select('id, name, invite_code')
    .eq('id', id)
    .single()

  if (!team) notFound()

  const { data: membership } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', id)
    .eq('profile_id', user.id)
    .single()

  if (!membership) notFound()

  const isAdmin = membership.role === 'admin'

  // Fetch active input sessions for admin
  let activeSessions: {
    gameId: string;
    opponentName: string;
    gameDate: string;
    holderName: string;
    lastActiveAt: string;
  }[] = []

  if (isAdmin) {
    const { data: sessions } = await supabase
      .from('game_input_sessions')
      .select('game_id, profile_id, last_active_at, games(opponent_name, game_date), profiles(display_name)')
      .in('game_id', (
        await supabase.from('games').select('id').eq('team_id', id)
      ).data?.map((g) => g.id) ?? [])

    activeSessions = (sessions ?? []).map((s) => ({
      gameId: s.game_id,
      opponentName: (s.games as { opponent_name: string } | null)?.opponent_name ?? '不明',
      gameDate: (s.games as { game_date: string } | null)?.game_date ?? '',
      holderName: (s.profiles as { display_name: string } | null)?.display_name ?? '不明',
      lastActiveAt: s.last_active_at,
    }))
  }

  return (
    <div className="space-y-6">
      <Link href="/" className="flex items-center text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="mr-1 h-4 w-4" />
        チーム一覧に戻る
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-2xl">{team.name}</CardTitle>
              <div className="mt-1">
                <Badge variant={isAdmin ? 'default' : 'secondary'}>
                  {isAdmin ? '管理者' : 'メンバー'}
                </Badge>
              </div>
            </div>
            {isAdmin && (
              <EditTeamNameDialog teamId={team.id} currentName={team.name} />
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            招待コード：<span className="font-mono font-bold text-foreground text-base">{team.invite_code}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href={`/team/${id}/players`}>
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
            <CardContent className="pt-6 pb-6 flex flex-col items-center justify-center gap-3 min-h-32">
              <Users className="h-10 w-10 text-muted-foreground" />
              <span className="text-xl font-semibold">選手管理</span>
              <span className="text-sm text-muted-foreground">選手の登録・編集・引退</span>
            </CardContent>
          </Card>
        </Link>

        <Link href={`/team/${id}/invite`}>
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
            <CardContent className="pt-6 pb-6 flex flex-col items-center justify-center gap-3 min-h-32">
              <UserCog className="h-10 w-10 text-muted-foreground" />
              <span className="text-xl font-semibold">招待・メンバー管理</span>
              <span className="text-sm text-muted-foreground">招待コード・メンバー一覧</span>
            </CardContent>
          </Card>
        </Link>

        <Link href={`/team/${id}/stats`}>
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
            <CardContent className="pt-6 pb-6 flex flex-col items-center justify-center gap-3 min-h-32">
              <BarChart3 className="h-10 w-10 text-muted-foreground" />
              <span className="text-xl font-semibold">成績</span>
              <span className="text-sm text-muted-foreground">打者・投手の通算成績</span>
            </CardContent>
          </Card>
        </Link>
      </div>

      {isAdmin && (
        <ActiveSessionsSection teamId={id} sessions={activeSessions} />
      )}
    </div>
  )
}
