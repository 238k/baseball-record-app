import type { RunnerDest, RunnerRow } from "@/app/(main)/games/[id]/input/types";

/**
 * Compute RBI from at-bat result and runner/batter destinations.
 */
export function computeRbi(
  result: string,
  batterDest: RunnerDest,
  runnerRows: RunnerRow[]
): number {
  const runnerScored = runnerRows.filter((r) => r.destination === "scored").length;
  const batterScored = batterDest === "scored" ? 1 : 0;
  const total = runnerScored + batterScored;

  // No RBI on DP
  if (result === "DP") return 0;

  return total;
}
