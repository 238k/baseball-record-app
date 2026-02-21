"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Undo2 } from "lucide-react";

type PitchResult = "ball" | "swinging" | "looking" | "foul";

interface PitchCounterProps {
  pitchLog: PitchResult[];
  onPitch: (result: PitchResult) => void;
  onUndo: () => void;
  disabled?: boolean;
}

function countFromLog(log: PitchResult[]) {
  let balls = 0;
  let strikes = 0;
  let fouls = 0;
  for (const p of log) {
    if (p === "ball") {
      balls++;
    } else if (p === "swinging" || p === "looking") {
      strikes++;
    } else if (p === "foul") {
      fouls++;
      if (strikes < 2) strikes++;
    }
  }
  return { balls, strikes, fouls };
}

export function PitchCounter({
  pitchLog,
  onPitch,
  onUndo,
  disabled,
}: PitchCounterProps) {
  const { balls, strikes, fouls } = countFromLog(pitchLog);
  const countFull = balls >= 4 || strikes >= 3;

  return (
    <div className="space-y-3">
      {/* Count display */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium w-4">B</span>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full ${
                i < balls
                  ? "bg-green-500"
                  : "bg-muted border border-border"
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium w-4">S</span>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full ${
                i < strikes
                  ? "bg-yellow-500"
                  : "bg-muted border border-border"
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium w-4">F</span>
          <Badge variant="secondary" className="tabular-nums">
            {fouls}
          </Badge>
        </div>
        <Badge variant="outline" className="ml-auto tabular-nums">
          {pitchLog.length}球
        </Badge>
      </div>

      {/* Pitch buttons */}
      <div className="flex gap-2">
        <Button
          size="lg"
          variant="outline"
          className="flex-1 min-h-14 text-base"
          disabled={disabled || countFull}
          onClick={() => onPitch("ball")}
        >
          ボール
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="flex-1 min-h-14 text-base"
          disabled={disabled || countFull}
          onClick={() => onPitch("swinging")}
        >
          空振り
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="flex-1 min-h-14 text-base"
          disabled={disabled || countFull}
          onClick={() => onPitch("looking")}
        >
          見逃し
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="flex-1 min-h-14 text-base"
          disabled={disabled || countFull}
          onClick={() => onPitch("foul")}
        >
          ファウル
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="min-h-14"
          disabled={disabled || pitchLog.length === 0}
          onClick={onUndo}
        >
          <Undo2 className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

export { countFromLog };
export type { PitchResult };
