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
}

interface CareerModeProps {
  mode: "career"
  data: BatterCareerStats[]
}

type BatterStatsTableProps = GameModeProps | CareerModeProps

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
  return <CareerBatterTable data={props.data} />
}

function GameBatterTable({ data }: { data: BatterGameStats[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10 text-center">打順</TableHead>
          <TableHead>名前</TableHead>
          <TableHead className="text-right">打席</TableHead>
          <TableHead className="text-right">打数</TableHead>
          <TableHead className="text-right">安打</TableHead>
          <TableHead className="text-right">打率</TableHead>
          <TableHead className="text-right">打点</TableHead>
          <TableHead className="text-right">得点</TableHead>
          <TableHead className="text-right">本塁打</TableHead>
          <TableHead className="text-right">盗塁</TableHead>
          <TableHead className="text-right">三振</TableHead>
          <TableHead className="text-right">四球</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.lineup_id}>
            <TableCell className="text-center">{row.batting_order ?? "—"}</TableCell>
            <TableCell>{row.player_name ?? row.name ?? "—"}</TableCell>
            <TableCell className="text-right">{row.plate_appearances ?? 0}</TableCell>
            <TableCell className="text-right">{row.at_bats ?? 0}</TableCell>
            <TableCell className="text-right">{row.hits ?? 0}</TableCell>
            <TableCell className="text-right font-mono">
              {formatAvg(row.hits ?? 0, row.at_bats ?? 0)}
            </TableCell>
            <TableCell className="text-right">{row.rbi ?? 0}</TableCell>
            <TableCell className="text-right">{row.runs ?? 0}</TableCell>
            <TableCell className="text-right">{row.home_runs ?? 0}</TableCell>
            <TableCell className="text-right">{row.stolen_bases ?? 0}</TableCell>
            <TableCell className="text-right">{row.strikeouts ?? 0}</TableCell>
            <TableCell className="text-right">{row.walks ?? 0}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function CareerBatterTable({ data }: { data: BatterCareerStats[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>名前</TableHead>
          <TableHead className="text-right">試合</TableHead>
          <TableHead className="text-right">打席</TableHead>
          <TableHead className="text-right">打数</TableHead>
          <TableHead className="text-right">安打</TableHead>
          <TableHead className="text-right">打率</TableHead>
          <TableHead className="text-right">出塁率</TableHead>
          <TableHead className="text-right">長打率</TableHead>
          <TableHead className="text-right">OPS</TableHead>
          <TableHead className="text-right">打点</TableHead>
          <TableHead className="text-right">得点</TableHead>
          <TableHead className="text-right">本塁打</TableHead>
          <TableHead className="text-right">盗塁</TableHead>
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
          return (
            <TableRow key={row.player_id}>
              <TableCell>{row.name ?? "—"}</TableCell>
              <TableCell className="text-right">{row.games ?? 0}</TableCell>
              <TableCell className="text-right">{row.plate_appearances ?? 0}</TableCell>
              <TableCell className="text-right">{atBats}</TableCell>
              <TableCell className="text-right">{hits}</TableCell>
              <TableCell className="text-right font-mono">
                {formatAvg(hits, atBats)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatObp(hits, walks, hbp, atBats, sacFlies)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatSlg(totalBases, atBats)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatOps(hits, walks, hbp, atBats, sacFlies, totalBases)}
              </TableCell>
              <TableCell className="text-right">{row.rbi ?? 0}</TableCell>
              <TableCell className="text-right">{row.runs ?? 0}</TableCell>
              <TableCell className="text-right">{row.home_runs ?? 0}</TableCell>
              <TableCell className="text-right">{row.stolen_bases ?? 0}</TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
