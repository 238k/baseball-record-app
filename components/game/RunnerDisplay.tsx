"use client";

import type { BaseRunners } from "@/hooks/useGameState";

interface RunnerDisplayProps {
  baseRunners: BaseRunners;
}

export function RunnerDisplay({ baseRunners }: RunnerDisplayProps) {
  const bases = [
    { key: "first" as const, label: "1塁", runner: baseRunners.first },
    { key: "second" as const, label: "2塁", runner: baseRunners.second },
    { key: "third" as const, label: "3塁", runner: baseRunners.third },
  ];

  return (
    <div className="flex gap-2">
      {bases.map((b) => (
        <div
          key={b.key}
          className={`px-3 py-1.5 rounded-md text-sm font-medium border ${
            b.runner
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-muted-foreground border-border"
          }`}
        >
          {b.label}
          {b.runner && (
            <span className="ml-1 text-xs">
              {b.runner.player_name}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
