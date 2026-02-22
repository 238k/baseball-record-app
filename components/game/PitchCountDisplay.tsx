import { Badge } from "@/components/ui/badge";
import { countFromLog, type PitchResult } from "./PitchCounter";

interface PitchCountDisplayProps {
  pitchLog: PitchResult[];
}

export function PitchCountDisplay({ pitchLog }: PitchCountDisplayProps) {
  const { balls, strikes } = countFromLog(pitchLog);

  return (
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
      <Badge variant="outline" className="ml-auto tabular-nums">
        {pitchLog.length}球
      </Badge>
    </div>
  );
}
