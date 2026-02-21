'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Tables } from '@/lib/supabase/types'
import { PlayerForm } from '@/components/team/PlayerForm'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, UserX } from 'lucide-react'

type Player = Tables<'players'>

export default function PlayersPage() {
  const params = useParams()
  const teamId = params.id as string

  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const [showRetired, setShowRetired] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('players')
        .select('*')
        .eq('team_id', teamId)
        .order('number', { ascending: true, nullsFirst: false })

      if (cancelled) return

      // number カラムは text 型のため JS 側で数値ソート（例: 1,2,10 の順）
      const sorted = (data ?? []).sort((a, b) => {
        const na = parseInt(a.number ?? '', 10)
        const nb = parseInt(b.number ?? '', 10)
        if (!isNaN(na) && !isNaN(nb)) return na - nb
        if (isNaN(na) && !isNaN(nb)) return 1
        if (!isNaN(na) && isNaN(nb)) return -1
        return (a.number ?? '').localeCompare(b.number ?? '')
      })

      setAllPlayers(sorted)
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [teamId, refreshKey])

  const players = showRetired ? allPlayers : allPlayers.filter(p => p.is_active)

  const handleRetire = async (playerId: string) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('players')
      .update({ is_active: false })
      .eq('id', playerId)

    if (error) {
      console.error('retire error:', error)
      return
    }

    setAllPlayers(prev => prev.map(p => p.id === playerId ? { ...p, is_active: false } : p))
  }

  return (
    <div className="space-y-6">
      <Link href={`/team/${teamId}`} className="flex items-center text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="mr-1 h-4 w-4" />
        チーム管理に戻る
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">選手管理</h1>
        <PlayerForm teamId={teamId} onSaved={() => setRefreshKey(k => k + 1)} />
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={showRetired ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowRetired(!showRetired)}
        >
          {showRetired ? '引退選手を非表示' : '引退選手を表示'}
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">読み込み中...</div>
      ) : players.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>選手が登録されていません</p>
          <p className="text-sm mt-1">「選手を追加」から登録してください</p>
        </div>
      ) : (
        <div className="space-y-2">
          {players.map((player) => (
            <Card key={player.id} className={player.is_active ? '' : 'opacity-60'}>
              <CardContent className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground w-8 text-right font-mono">
                    {player.number ?? '-'}
                  </span>
                  <span className="text-lg font-medium">{player.name}</span>
                  {player.position && (
                    <Badge variant="outline">{player.position}</Badge>
                  )}
                  {!player.is_active && (
                    <Badge variant="secondary">引退</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <PlayerForm
                    teamId={teamId}
                    player={{ id: player.id, name: player.name, number: player.number, position: player.position }}
                    onSaved={() => setRefreshKey(k => k + 1)}
                  />
                  {player.is_active && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRetire(player.id)}
                      title="引退"
                    >
                      <UserX className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
