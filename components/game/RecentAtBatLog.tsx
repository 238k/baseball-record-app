"use client";

import type { RecentAtBat } from "@/hooks/useRealtimeGame";

// Result code to Japanese label mapping
const RESULT_LABELS: Record<string, string> = {
  "1B": "単打",
  "2B": "二塁打",
  "3B": "三塁打",
  HR: "本塁打",
  BB: "四球",
  IBB: "故意四球",
  HBP: "死球",
  K: "三振(空)",
  KK: "三振(見)",
  GO: "ゴロ",
  FO: "フライ",
  LO: "ライナー",
  DP: "併殺打",
  SF: "犠飛",
  SH: "犠打",
  FC: "FC",
  E: "エラー",
};

const PITCH_LABELS: Record<string, string> = {
  ball: "ボール",
  swinging: "空振り",
  looking: "見逃し",
  foul: "ファウル",
};

export interface LiveAtBat {
  inning: number;
  inning_half: string;
  playerName: string;
  pitches: string[];
}

interface RecentAtBatLogProps {
  recentAtBats: RecentAtBat[];
  liveAtBat?: LiveAtBat | null;
}

export function RecentAtBatLog({ recentAtBats, liveAtBat }: RecentAtBatLogProps) {
  if (!liveAtBat && recentAtBats.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        まだ打席記録がありません
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {liveAtBat && (
        <div className="py-1.5 border-b space-y-1">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs min-w-12">
                {liveAtBat.inning}回{liveAtBat.inning_half === "top" ? "表" : "裏"}
              </span>
              <span className="font-medium">{liveAtBat.playerName}</span>
            </div>
            <span className="text-muted-foreground text-xs">打席中</span>
          </div>
          {liveAtBat.pitches.length > 0 && (
            <div className="text-xs text-muted-foreground pl-14">
              {liveAtBat.pitches.map((p, i) => (
                <div key={i}>
                  {i + 1}球目: {PITCH_LABELS[p] ?? p}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {recentAtBats.map((ab) => {
        const halfLabel = ab.inning_half === "top" ? "表" : "裏";
        const resultLabel = RESULT_LABELS[ab.result] ?? ab.result;
        const rbiText = ab.rbi > 0 ? `（${ab.rbi}打点）` : "";

        return (
          <div
            key={ab.id}
            className="py-1.5 border-b last:border-b-0 space-y-1"
          >
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs min-w-12">
                  {ab.inning}回{halfLabel}
                </span>
                <span className="font-medium">{ab.playerName}</span>
              </div>
              <span>
                {resultLabel}
                {rbiText}
              </span>
            </div>
            {ab.pitches.length > 0 && (
              <div className="text-xs text-muted-foreground pl-14">
                {ab.pitches.map((p, i) => (
                  <div key={i}>
                    {i + 1}球目: {PITCH_LABELS[p] ?? p}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
