'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Shield, Trash2 } from 'lucide-react'

interface Member {
  id: string
  role: string
  profiles: {
    id: string
    display_name: string
  }
}

interface MemberListProps {
  members: Member[]
  currentUserId: string
  isAdmin: boolean
  teamId: string
  onChanged: () => void
}

export function MemberList({ members, currentUserId, isAdmin, onChanged }: MemberListProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handlePromote = async (memberId: string) => {
    setLoadingId(memberId)
    const supabase = createClient()
    await supabase
      .from('team_members')
      .update({ role: 'admin' })
      .eq('id', memberId)
    setLoadingId(null)
    onChanged()
  }

  const handleRemove = async (memberId: string) => {
    setLoadingId(memberId)
    const supabase = createClient()
    await supabase
      .from('team_members')
      .delete()
      .eq('id', memberId)
    setLoadingId(null)
    onChanged()
  }

  return (
    <div className="space-y-2">
      {members.map((member) => {
        const isSelf = member.profiles.id === currentUserId
        const isLoading = loadingId === member.id

        return (
          <Card key={member.id}>
            <CardContent className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg font-medium">{member.profiles.display_name}</span>
                {isSelf && (
                  <Badge variant="outline" className="text-xs">あなた</Badge>
                )}
                <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                  {member.role === 'admin' ? '管理者' : 'メンバー'}
                </Badge>
              </div>

              {isAdmin && !isSelf && (
                <div className="flex items-center gap-1">
                  {member.role === 'member' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePromote(member.id)}
                      disabled={isLoading}
                      title="管理者に昇格"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Shield className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(member.id)}
                    disabled={isLoading}
                    title="チームから削除"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-destructive" />
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
