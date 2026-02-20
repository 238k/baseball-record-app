'use client'

import { useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Plus, Pencil } from 'lucide-react'

const POSITIONS = ['投', '捕', '一', '二', '三', '遊', '左', '中', '右', 'DH']

interface Player {
  id: string
  name: string
  number: string | null
  position: string | null
}

interface PlayerFormProps {
  teamId: string
  player?: Player
  onSaved: () => void
}

export function PlayerForm({ teamId, player, onSaved }: PlayerFormProps) {
  const isEdit = !!player
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(player?.name ?? '')
  const [number, setNumber] = useState(player?.number ?? '')
  const [position, setPosition] = useState(player?.position ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetForm = () => {
    if (!isEdit) {
      setName('')
      setNumber('')
      setPosition('')
    }
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()

    const payload = {
      name: name.trim(),
      number: number.trim() || null,
      position: position || null,
    }

    let err
    if (isEdit) {
      const { error } = await supabase
        .from('players')
        .update(payload)
        .eq('id', player.id)
      err = error
    } else {
      const { error } = await supabase
        .from('players')
        .insert({ ...payload, team_id: teamId })
      err = error
    }

    if (err) {
      setError('保存に失敗しました')
      setLoading(false)
      return
    }

    setOpen(false)
    resetForm()
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o && isEdit) { setName(player.name); setNumber(player.number ?? ''); setPosition(player.position ?? '') } if (!o) resetForm() }}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="sm">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button size="lg" className="min-h-14 text-lg">
            <Plus className="mr-2 h-5 w-5" />
            選手を追加
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? '選手を編集' : '選手を追加'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="playerName">名前 <span className="text-destructive">*</span></Label>
            <Input
              id="playerName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="山田 太郎"
              required
              className="text-lg h-14"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="playerNumber">背番号</Label>
            <Input
              id="playerNumber"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="例：1"
              className="text-lg h-14"
            />
          </div>
          <div className="space-y-2">
            <Label>ポジション</Label>
            <Select value={position} onValueChange={setPosition}>
              <SelectTrigger className="text-lg h-14">
                <SelectValue placeholder="選択してください" />
              </SelectTrigger>
              <SelectContent>
                {POSITIONS.map((pos) => (
                  <SelectItem key={pos} value={pos} className="text-lg">
                    {pos}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button type="submit" size="lg" className="w-full min-h-14 text-lg" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            {isEdit ? '更新する' : '追加する'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
