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

interface InningEntry {
  type: "live";
  liveAtBat: LiveAtBat;
}

interface AtBatEntry {
  type: "atbat";
  atBat: RecentAtBat;
}

type Entry = InningEntry | AtBatEntry;

interface InningGroup {
  key: string;
  label: string;
  entries: Entry[];
}

function groupByInning(
  recentAtBats: RecentAtBat[],
  liveAtBat?: LiveAtBat | null
): InningGroup[] {
  const groups: InningGroup[] = [];
  const groupMap = new Map<string, InningGroup>();

  // Live at-bat first
  if (liveAtBat) {
    const key = `${liveAtBat.inning}-${liveAtBat.inning_half}`;
    const label = `${liveAtBat.inning}回${liveAtBat.inning_half === "top" ? "表" : "裏"}`;
    const group: InningGroup = { key, label, entries: [{ type: "live", liveAtBat }] };
    groups.push(group);
    groupMap.set(key, group);
  }

  for (const ab of recentAtBats) {
    const key = `${ab.inning}-${ab.inning_half}`;
    const existing = groupMap.get(key);
    if (existing) {
      existing.entries.push({ type: "atbat", atBat: ab });
    } else {
      const label = `${ab.inning}回${ab.inning_half === "top" ? "表" : "裏"}`;
      const group: InningGroup = { key, label, entries: [{ type: "atbat", atBat: ab }] };
      groups.push(group);
      groupMap.set(key, group);
    }
  }

  return groups;
}

export function RecentAtBatLog({ recentAtBats, liveAtBat }: RecentAtBatLogProps) {
  if (!liveAtBat && recentAtBats.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        まだ打席記録がありません
      </p>
    );
  }

  const groups = groupByInning(recentAtBats, liveAtBat);

  return (
    <div className="divide-y">
      {groups.map((group) => (
        <div key={group.key} className="py-2">
          <div className="text-xs text-muted-foreground mb-1">{group.label}</div>
          <div className="space-y-1 pl-2">
            {group.entries.map((entry) => {
              if (entry.type === "live") {
                const { liveAtBat: live } = entry;
                return (
                  <div key="live" className="space-y-0.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{live.playerName}</span>
                      <span className="text-muted-foreground text-xs">打席中</span>
                    </div>
                    {live.pitches.length > 0 && (
                      <div className="text-xs text-muted-foreground pl-2">
                        {[...live.pitches].reverse().map((p, ri) => {
                          const ballNum = live.pitches.length - ri;
                          return (
                            <div key={ri}>
                              {ballNum}球目: {PITCH_LABELS[p] ?? p}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              const { atBat: ab } = entry;
              const resultLabel = RESULT_LABELS[ab.result] ?? ab.result;
              const rbiText = ab.rbi > 0 ? `（${ab.rbi}打点）` : "";

              return (
                <div key={ab.id} className="space-y-0.5">
                  <div className="text-sm font-medium">{ab.playerName}</div>
                  <div className="text-xs pl-2">
                    <span className="font-medium">
                      打席結果: {resultLabel}
                      {rbiText}
                    </span>
                  </div>
                  {ab.pitches.length > 0 && (
                    <div className="text-xs text-muted-foreground pl-2">
                      {[...ab.pitches].reverse().map((p, ri) => {
                        const ballNum = ab.pitches.length - ri;
                        return (
                          <div key={ri}>
                            {ballNum}球目: {PITCH_LABELS[p] ?? p}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
