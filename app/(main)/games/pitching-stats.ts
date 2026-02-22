interface RunnerDestination {
  lineupId: string;
  event: "scored" | "out" | "stay";
  toBase?: "1st" | "2nd" | "3rd";
}

const HIT_RESULTS = new Set(["1B", "2B", "3B", "HR"]);
const WALK_RESULTS = new Set(["BB", "IBB"]);
const STRIKEOUT_RESULTS = new Set(["K", "KK"]);

export interface PitchingStatsDelta {
  outs: number;
  hits: number;
  runs: number;
  earnedRuns: number;
  walks: number;
  strikeouts: number;
}

export function getPitchingStatsDelta(
  result: string,
  runnerDestinations: RunnerDestination[]
): PitchingStatsDelta {
  const outs = runnerDestinations.filter((d) => d.event === "out").length;
  const runs = runnerDestinations.filter((d) => d.event === "scored").length;

  return {
    outs,
    hits: HIT_RESULTS.has(result) ? 1 : 0,
    runs,
    earnedRuns: runs, // Cannot distinguish unearned runs without error tracking
    walks: WALK_RESULTS.has(result) ? 1 : 0,
    strikeouts: STRIKEOUT_RESULTS.has(result) ? 1 : 0,
  };
}
