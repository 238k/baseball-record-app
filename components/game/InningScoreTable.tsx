"use client";

import type { InningScore } from "@/hooks/useRealtimeGame";

interface InningScoreTableProps {
  myTeamName: string;
  opponentName: string;
  isHome: boolean;
  inningScores: InningScore[];
  totalScore: { home: number; visitor: number };
}

export function InningScoreTable({
  myTeamName,
  opponentName,
  isHome,
  inningScores,
  totalScore,
}: InningScoreTableProps) {
  // Group scores by inning
  const innings = new Map<number, { top: number; bottom: number }>();
  for (const s of inningScores) {
    const entry = innings.get(s.inning) ?? { top: 0, bottom: 0 };
    if (s.inning_half === "top") entry.top = s.runs;
    else entry.bottom = s.runs;
    innings.set(s.inning, entry);
  }

  const inningNumbers = Array.from(innings.keys()).sort((a, b) => a - b);

  // Determine display order: top row = visitor, bottom row = home
  const topTeamName = isHome ? opponentName : myTeamName;
  const bottomTeamName = isHome ? myTeamName : opponentName;
  const topTotal = isHome ? totalScore.visitor : totalScore.home;
  const bottomTotal = isHome ? totalScore.home : totalScore.visitor;

  if (inningNumbers.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b">
            <th className="px-2 py-1.5 text-left font-medium">回</th>
            {inningNumbers.map((n) => (
              <th key={n} className="px-2 py-1.5 text-center font-medium w-9">
                {n}
              </th>
            ))}
            <th className="px-2 py-1.5 text-center font-bold w-9">計</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="px-2 py-1.5 font-medium whitespace-nowrap">{topTeamName}</td>
            {inningNumbers.map((n) => (
              <td key={n} className="px-2 py-1.5 text-center tabular-nums">
                {innings.get(n)?.top ?? ""}
              </td>
            ))}
            <td className="px-2 py-1.5 text-center font-bold tabular-nums">{topTotal}</td>
          </tr>
          <tr className="border-b">
            <td className="px-2 py-1.5 font-medium whitespace-nowrap">{bottomTeamName}</td>
            {inningNumbers.map((n) => (
              <td key={n} className="px-2 py-1.5 text-center tabular-nums">
                {innings.get(n)?.bottom ?? ""}
              </td>
            ))}
            <td className="px-2 py-1.5 text-center font-bold tabular-nums">{bottomTotal}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
