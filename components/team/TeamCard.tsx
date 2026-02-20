import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronRight, Users } from 'lucide-react'

interface TeamCardProps {
  team: {
    id: string
    name: string
    role: string
  }
}

export function TeamCard({ team }: TeamCardProps) {
  return (
    <Card className="hover:bg-accent/50 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">{team.name}</CardTitle>
          <Badge variant={team.role === 'admin' ? 'default' : 'secondary'}>
            {team.role === 'admin' ? '管理者' : 'メンバー'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Link href={`/team/${team.id}`}>
          <Button size="lg" className="w-full min-h-14 text-lg" variant="outline">
            <Users className="mr-2 h-5 w-5" />
            チームを管理
            <ChevronRight className="ml-auto h-5 w-5" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
