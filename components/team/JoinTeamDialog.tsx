'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { joinTeamAction } from '@/app/(main)/team/actions'

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

    const result = await joinTeamAction(inviteCode)
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    setLoading(false)
    setOpen(false)
    setInviteCode('')
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" variant="outline" className="min-h-12 sm:min-h-16 text-base sm:text-lg">
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
