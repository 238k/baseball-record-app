"use client";

interface ScoreBoardProps {
  myTeamName: string;
  opponentName: string;
  isHome: boolean;
  score: { home: number; visitor: number };
  currentInning: number;
  currentHalf: "top" | "bottom";
}

export function ScoreBoard({
  myTeamName,
  opponentName,
  isHome,
  score,
  currentInning,
  currentHalf,
}: ScoreBoardProps) {
  const myScore = isHome ? score.home : score.visitor;
  const opponentScore = isHome ? score.visitor : score.home;
  const halfLabel = currentHalf === "top" ? "表" : "裏";

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-muted rounded-lg">
      <div className="flex items-center gap-3 text-lg font-bold">
        <span>{myTeamName}</span>
        <span className="text-2xl tabular-nums">
          {myScore} - {opponentScore}
        </span>
        <span>{opponentName}</span>
      </div>
      <div className="text-lg font-medium">
        {currentInning}回{halfLabel}
      </div>
    </div>
  );
}
