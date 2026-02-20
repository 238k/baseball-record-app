'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { MemberList } from '@/components/team/MemberList'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Copy, RefreshCw, Loader2 } from 'lucide-react'

interface TeamData {
  id: string
  invite_code: string
  owner_id: string
}

interface Member {
  id: string
  role: string
  profiles: {
    id: string
    display_name: string
  }
}

export default function InvitePage() {
  const params = useParams()
  const teamId = params.id as string

  const [team, setTeam] = useState<TeamData | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setCurrentUserId(user.id)

    const [teamRes, membersRes, myMemberRes] = await Promise.all([
      supabase.from('teams').select('id, invite_code, owner_id').eq('id', teamId).single(),
      supabase.from('team_members').select('id, role, profiles(id, display_name)').eq('team_id', teamId),
      supabase.from('team_members').select('role').eq('team_id', teamId).eq('profile_id', user.id).single(),
    ])

    setTeam(teamRes.data)
    setMembers((membersRes.data ?? []) as Member[])
    setIsAdmin(myMemberRes.data?.role === 'admin')
  }, [teamId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCopy = async () => {
    if (!team) return
    await navigator.clipboard.writeText(team.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRegenerate = async () => {
    setRegenerating(true)
    const supabase = createClient()
    const newCode = Math.random().toString(36).substring(2, 10)
    await supabase.from('teams').update({ invite_code: newCode }).eq('id', teamId)
    await fetchData()
    setRegenerating(false)
  }

  if (!team) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link href={`/team/${teamId}`} className="flex items-center text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="mr-1 h-4 w-4" />
        チーム管理に戻る
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>招待コード</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-3xl font-bold tracking-widest">{team.invite_code}</span>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              <Copy className="h-4 w-4 mr-1" />
              {copied ? 'コピーしました！' : 'コピー'}
            </Button>
          </div>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={regenerating}
            >
              {regenerating ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              コードを再発行
            </Button>
          )}
          <p className="text-sm text-muted-foreground">
            このコードを共有すると、他のユーザーがチームに参加できます
          </p>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-xl font-bold mb-3">メンバー一覧</h2>
        {currentUserId && (
          <MemberList
            members={members}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            teamId={teamId}
            onChanged={fetchData}
          />
        )}
      </div>
    </div>
  )
}
