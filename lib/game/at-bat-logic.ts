import type { RunnerDest, RunnerRow } from "@/app/(main)/games/[id]/input/types";

/**
 * Count total outs resulting from an at-bat (batter + runners tagged out).
 */
export function countOutsFromResult(
  _result: string,
  batterDest: RunnerDest,
  runnerRows: RunnerRow[]
): number {
  let outs = 0;
  if (batterDest === "out") outs++;
  for (const r of runnerRows) {
    if (r.destination === "out") outs++;
  }
  return outs;
}
