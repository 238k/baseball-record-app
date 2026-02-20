'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, UserPlus } from 'lucide-react'

export function JoinTeamDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name')
      .eq('invite_code', inviteCode.trim())
      .single()

    if (teamError || !team) {
      setError('招待コードが見つかりません')
      setLoading(false)
      return
    }

    const { error: joinError } = await supabase
      .from('team_members')
      .insert({ team_id: team.id, profile_id: user.id, role: 'member' })

    if (joinError) {
      if (joinError.code === '23505') {
        setError('すでにこのチームのメンバーです')
      } else {
        setError('参加に失敗しました')
      }
      setLoading(false)
      return
    }

    setOpen(false)
    setInviteCode('')
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" variant="outline" className="min-h-16 text-lg">
          <UserPlus className="mr-2 h-5 w-5" />
          チームに参加
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>招待コードでチームに参加</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleJoin} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="inviteCode">招待コード</Label>
            <Input
              id="inviteCode"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="8桁のコードを入力"
              required
              className="text-lg h-14"
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button type="submit" size="lg" className="w-full min-h-14 text-lg" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            参加する
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
