import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface LineupRow {
  id: string;
  batting_order: number;
  team_side: string;
  player_name: string | null;
  position: string | null;
  inning_from: number;
}

interface LineupTableProps {
  title: string;
  lineup: LineupRow[];
  dhPitcher?: LineupRow | null;
}

export function LineupTable({ title, lineup, dhPitcher }: LineupTableProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-center">打順</TableHead>
              <TableHead>選手名</TableHead>
              <TableHead className="w-16 text-center">守備</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineup.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="text-center font-medium">
                  {row.batting_order}
                </TableCell>
                <TableCell>{row.player_name ?? "—"}</TableCell>
                <TableCell className="text-center">
                  {row.position ?? "—"}
                </TableCell>
              </TableRow>
            ))}
            {dhPitcher && (
              <TableRow className="border-t-2">
                <TableCell className="text-center font-medium">
                  先発
                </TableCell>
                <TableCell>{dhPitcher.player_name ?? "—"}</TableCell>
                <TableCell className="text-center">投</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
