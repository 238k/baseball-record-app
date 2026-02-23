import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatEra, formatIp } from "./formatStats"
import type { Database } from "@/lib/supabase/types"

type PitcherGameStats = Database["public"]["Views"]["v_pitcher_game_stats"]["Row"]
type PitcherCareerStats = Database["public"]["Views"]["v_pitcher_career_stats"]["Row"]

interface GameModeProps {
  mode: "game"
  data: PitcherGameStats[]
  teamId?: never
}

interface CareerModeProps {
  mode: "career"
  data: PitcherCareerStats[]
  teamId?: string
}

interface PlayerModeProps {
  mode: "player"
  data: (PitcherGameStats & { game_date?: string | null; opponent_name?: string | null })[]
  teamId?: string
}

type PitcherStatsTableProps = GameModeProps | CareerModeProps | PlayerModeProps

export function PitcherStatsTable(props: PitcherStatsTableProps) {
  if (props.data.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8">
        投手成績データがありません
      </p>
    )
  }

  if (props.mode === "game") {
    return <GamePitcherTable data={props.data} />
  }
  if (props.mode === "player") {
    return <PlayerPitcherTable data={props.data} teamId={props.teamId} />
  }
  return <CareerPitcherTable data={props.data} teamId={props.teamId} />
}

function GamePitcherTable({ data }: { data: PitcherGameStats[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>名前</TableHead>
          <TableHead className="text-right">投球回</TableHead>
          <TableHead className="text-right">被安打</TableHead>
          <TableHead className="text-right">失点</TableHead>
          <TableHead className="text-right">自責点</TableHead>
          <TableHead className="text-right">防御率</TableHead>
          <TableHead className="text-right">奪三振</TableHead>
          <TableHead className="text-right">与四球</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.lineup_id}>
            <TableCell>{row.name ?? "—"}</TableCell>
            <TableCell className="text-right">
              {row.innings_pitched ?? formatIp(row.outs_recorded ?? 0)}
            </TableCell>
            <TableCell className="text-right">{row.hits ?? 0}</TableCell>
            <TableCell className="text-right">{row.runs ?? 0}</TableCell>
            <TableCell className="text-right">{row.earned_runs ?? 0}</TableCell>
            <TableCell className="text-right font-mono">
              {row.era != null ? row.era.toFixed(2) : formatEra(row.earned_runs ?? 0, row.outs_recorded ?? 0)}
            </TableCell>
            <TableCell className="text-right">{row.strikeouts ?? 0}</TableCell>
            <TableCell className="text-right">{row.walks ?? 0}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function PlayerPitcherTable({ data, teamId }: {
  data: (PitcherGameStats & { game_date?: string | null; opponent_name?: string | null })[]
  teamId?: string
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>日付</TableHead>
          <TableHead>対戦</TableHead>
          <TableHead className="text-right">投球回</TableHead>
          <TableHead className="text-right">被安打</TableHead>
          <TableHead className="text-right">失点</TableHead>
          <TableHead className="text-right">自責点</TableHead>
          <TableHead className="text-right">防御率</TableHead>
          <TableHead className="text-right">奪三振</TableHead>
          <TableHead className="text-right">与四球</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.game_id}>
            <TableCell className="whitespace-nowrap">
              {row.game_id && teamId ? (
                <Link href={`/games/${row.game_id}`} className="text-primary hover:underline" prefetch={false}>
                  {row.game_date ?? "—"}
                </Link>
              ) : (
                row.game_date ?? "—"
              )}
            </TableCell>
            <TableCell>{row.opponent_name ?? "—"}</TableCell>
            <TableCell className="text-right">
              {row.innings_pitched ?? formatIp(row.outs_recorded ?? 0)}
            </TableCell>
            <TableCell className="text-right">{row.hits ?? 0}</TableCell>
            <TableCell className="text-right">{row.runs ?? 0}</TableCell>
            <TableCell className="text-right">{row.earned_runs ?? 0}</TableCell>
            <TableCell className="text-right font-mono">
              {row.era != null ? row.era.toFixed(2) : formatEra(row.earned_runs ?? 0, row.outs_recorded ?? 0)}
            </TableCell>
            <TableCell className="text-right">{row.strikeouts ?? 0}</TableCell>
            <TableCell className="text-right">{row.walks ?? 0}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function CareerPitcherTable({ data, teamId }: { data: PitcherCareerStats[]; teamId?: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>名前</TableHead>
          <TableHead className="text-right">登板</TableHead>
          <TableHead className="text-right">投球回</TableHead>
          <TableHead className="text-right">防御率</TableHead>
          <TableHead className="text-right">奪三振</TableHead>
          <TableHead className="text-right">与四球</TableHead>
          <TableHead className="text-right">被安打</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => {
          const nameCell = teamId && row.player_id ? (
            <Link href={`/team/${teamId}/players/${row.player_id}`} className="text-primary hover:underline" prefetch={false}>
              {row.name ?? "—"}
            </Link>
          ) : (
            row.name ?? "—"
          )
          return (
            <TableRow key={row.player_id}>
              <TableCell>{nameCell}</TableCell>
              <TableCell className="text-right">{row.games ?? 0}</TableCell>
              <TableCell className="text-right">
                {row.innings_pitched ?? formatIp(row.outs_recorded ?? 0)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {row.era != null ? row.era.toFixed(2) : formatEra(row.earned_runs ?? 0, row.outs_recorded ?? 0)}
              </TableCell>
              <TableCell className="text-right">{row.strikeouts ?? 0}</TableCell>
              <TableCell className="text-right">{row.walks ?? 0}</TableCell>
              <TableCell className="text-right">{row.hits ?? 0}</TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
