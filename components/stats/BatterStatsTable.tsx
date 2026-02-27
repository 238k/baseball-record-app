import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatAvg, formatObp, formatSlg, formatOps } from "./formatStats"
import type { Database } from "@/lib/supabase/types"

type BatterGameStats = Database["public"]["Views"]["v_batter_game_stats"]["Row"]
type BatterCareerStats = Database["public"]["Views"]["v_batter_career_stats"]["Row"]

interface GameModeProps {
  mode: "game"
  data: BatterGameStats[]
  teamId?: never
}

interface CareerModeProps {
  mode: "career"
  data: BatterCareerStats[]
  teamId?: string
}

interface PlayerModeProps {
  mode: "player"
  data: (BatterGameStats & { game_date?: string | null; opponent_name?: string | null })[]
  teamId?: string
}

type BatterStatsTableProps = GameModeProps | CareerModeProps | PlayerModeProps

export function BatterStatsTable(props: BatterStatsTableProps) {
  if (props.data.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8">
        打者成績データがありません
      </p>
    )
  }

  if (props.mode === "game") {
    return <GameBatterTable data={props.data} />
  }
  if (props.mode === "player") {
    return <PlayerBatterTable data={props.data} teamId={props.teamId} />
  }
  return <CareerBatterTable data={props.data} teamId={props.teamId} />
}

function GameBatterTable({ data }: { data: BatterGameStats[] }) {
  return (
    <div className="overflow-x-auto -mx-2">
      <Table className="text-xs sm:text-sm">
        <TableHeader>
          <TableRow>
            <TableHead className="w-8 sm:w-10 text-center px-1 sm:px-2">打順</TableHead>
            <TableHead className="sticky left-0 bg-background px-1 sm:px-2">名前</TableHead>
            <TableHead className="text-right px-1 sm:px-2">打席</TableHead>
            <TableHead className="text-right px-1 sm:px-2">打数</TableHead>
            <TableHead className="text-right px-1 sm:px-2">安打</TableHead>
            <TableHead className="text-right px-1 sm:px-2">打率</TableHead>
            <TableHead className="text-right px-1 sm:px-2">打点</TableHead>
            <TableHead className="text-right px-1 sm:px-2">得点</TableHead>
            <TableHead className="text-right px-1 sm:px-2">本塁打</TableHead>
            <TableHead className="text-right px-1 sm:px-2">盗塁</TableHead>
            <TableHead className="text-right px-1 sm:px-2">三振</TableHead>
            <TableHead className="text-right px-1 sm:px-2">四球</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.lineup_id}>
              <TableCell className="text-center px-1 sm:px-2">{row.batting_order ?? "—"}</TableCell>
              <TableCell className="sticky left-0 bg-background px-1 sm:px-2 whitespace-nowrap">{row.player_name ?? row.name ?? "—"}</TableCell>
              <TableCell className="text-right px-1 sm:px-2">{row.plate_appearances ?? 0}</TableCell>
              <TableCell className="text-right px-1 sm:px-2">{row.at_bats ?? 0}</TableCell>
              <TableCell className="text-right px-1 sm:px-2">{row.hits ?? 0}</TableCell>
              <TableCell className="text-right font-mono px-1 sm:px-2">
                {formatAvg(row.hits ?? 0, row.at_bats ?? 0)}
              </TableCell>
              <TableCell className="text-right px-1 sm:px-2">{row.rbi ?? 0}</TableCell>
              <TableCell className="text-right px-1 sm:px-2">{row.runs ?? 0}</TableCell>
              <TableCell className="text-right px-1 sm:px-2">{row.home_runs ?? 0}</TableCell>
              <TableCell className="text-right px-1 sm:px-2">{row.stolen_bases ?? 0}</TableCell>
              <TableCell className="text-right px-1 sm:px-2">{row.strikeouts ?? 0}</TableCell>
              <TableCell className="text-right px-1 sm:px-2">{row.walks ?? 0}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function PlayerBatterTable({ data, teamId }: {
  data: (BatterGameStats & { game_date?: string | null; opponent_name?: string | null })[]
  teamId?: string
}) {
  return (
    <div className="overflow-x-auto -mx-2">
      <Table className="text-xs sm:text-sm">
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-background px-1 sm:px-2">日付</TableHead>
            <TableHead className="px-1 sm:px-2">対戦</TableHead>
            <TableHead className="text-right px-1 sm:px-2">打席</TableHead>
            <TableHead className="text-right px-1 sm:px-2">打数</TableHead>
            <TableHead className="text-right px-1 sm:px-2">安打</TableHead>
            <TableHead className="text-right px-1 sm:px-2">打率</TableHead>
            <TableHead className="text-right px-1 sm:px-2">打点</TableHead>
            <TableHead className="text-right px-1 sm:px-2">本塁打</TableHead>
            <TableHead className="text-right px-1 sm:px-2">三振</TableHead>
            <TableHead className="text-right px-1 sm:px-2">四球</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.game_id}>
              <TableCell className="whitespace-nowrap sticky left-0 bg-background px-1 sm:px-2">
                {row.game_id && teamId ? (
                  <Link href={`/games/${row.game_id}`} className="text-primary hover:underline" prefetch={false}>
                    {row.game_date ?? "—"}
                  </Link>
                ) : (
                  row.game_date ?? "—"
                )}
              </TableCell>
              <TableCell className="px-1 sm:px-2">{row.opponent_name ?? "—"}</TableCell>
              <TableCell className="text-right px-1 sm:px-2">{row.plate_appearances ?? 0}</TableCell>
              <TableCell className="text-right px-1 sm:px-2">{row.at_bats ?? 0}</TableCell>
              <TableCell className="text-right px-1 sm:px-2">{row.hits ?? 0}</TableCell>
              <TableCell className="text-right font-mono px-1 sm:px-2">
                {formatAvg(row.hits ?? 0, row.at_bats ?? 0)}
              </TableCell>
              <TableCell className="text-right px-1 sm:px-2">{row.rbi ?? 0}</TableCell>
              <TableCell className="text-right px-1 sm:px-2">{row.home_runs ?? 0}</TableCell>
              <TableCell className="text-right px-1 sm:px-2">{row.strikeouts ?? 0}</TableCell>
              <TableCell className="text-right px-1 sm:px-2">{row.walks ?? 0}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function CareerBatterTable({ data, teamId }: { data: BatterCareerStats[]; teamId?: string }) {
  return (
    <div className="overflow-x-auto -mx-2">
      <Table className="text-xs sm:text-sm">
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-background px-1 sm:px-2">名前</TableHead>
            <TableHead className="text-right px-1 sm:px-2">試合</TableHead>
            <TableHead className="text-right px-1 sm:px-2">打席</TableHead>
            <TableHead className="text-right px-1 sm:px-2">打数</TableHead>
            <TableHead className="text-right px-1 sm:px-2">安打</TableHead>
            <TableHead className="text-right px-1 sm:px-2">打率</TableHead>
            <TableHead className="text-right px-1 sm:px-2">出塁率</TableHead>
            <TableHead className="text-right px-1 sm:px-2">長打率</TableHead>
            <TableHead className="text-right px-1 sm:px-2">OPS</TableHead>
            <TableHead className="text-right px-1 sm:px-2">打点</TableHead>
            <TableHead className="text-right px-1 sm:px-2">得点</TableHead>
            <TableHead className="text-right px-1 sm:px-2">本塁打</TableHead>
            <TableHead className="text-right px-1 sm:px-2">盗塁</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => {
            const hits = row.hits ?? 0
            const atBats = row.at_bats ?? 0
            const walks = row.walks ?? 0
            const hbp = row.hit_by_pitch ?? 0
            const sacFlies = row.sac_flies ?? 0
            const totalBases = row.total_bases ?? 0
            const nameCell = teamId && row.player_id ? (
              <Link href={`/team/${teamId}/players/${row.player_id}`} className="text-primary hover:underline" prefetch={false}>
                {row.name ?? "—"}
              </Link>
            ) : (
              row.name ?? "—"
            )
            return (
              <TableRow key={row.player_id}>
                <TableCell className="sticky left-0 bg-background px-1 sm:px-2 whitespace-nowrap">{nameCell}</TableCell>
                <TableCell className="text-right px-1 sm:px-2">{row.games ?? 0}</TableCell>
                <TableCell className="text-right px-1 sm:px-2">{row.plate_appearances ?? 0}</TableCell>
                <TableCell className="text-right px-1 sm:px-2">{atBats}</TableCell>
                <TableCell className="text-right px-1 sm:px-2">{hits}</TableCell>
                <TableCell className="text-right font-mono px-1 sm:px-2">
                  {formatAvg(hits, atBats)}
                </TableCell>
                <TableCell className="text-right font-mono px-1 sm:px-2">
                  {formatObp(hits, walks, hbp, atBats, sacFlies)}
                </TableCell>
                <TableCell className="text-right font-mono px-1 sm:px-2">
                  {formatSlg(totalBases, atBats)}
                </TableCell>
                <TableCell className="text-right font-mono px-1 sm:px-2">
                  {formatOps(hits, walks, hbp, atBats, sacFlies, totalBases)}
                </TableCell>
                <TableCell className="text-right px-1 sm:px-2">{row.rbi ?? 0}</TableCell>
                <TableCell className="text-right px-1 sm:px-2">{row.runs ?? 0}</TableCell>
                <TableCell className="text-right px-1 sm:px-2">{row.home_runs ?? 0}</TableCell>
                <TableCell className="text-right px-1 sm:px-2">{row.stolen_bases ?? 0}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
