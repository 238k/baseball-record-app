import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Users, UserCog } from 'lucide-react'
import { EditTeamNameDialog } from '@/components/team/EditTeamNameDialog'

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

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

  return (
    <div className="space-y-6">
      <Link href="/" prefetch={false} className="flex items-center text-muted-foreground hover:text-foreground transition-colors">
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
      </div>
    </div>
  )
}
