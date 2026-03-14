import type { BaseRunners } from "@/hooks/useGameState";
import type { RunnerDest, RunnerRow } from "@/app/(main)/games/[id]/input/types";

/**
 * Calculate default runner destinations for a given at-bat result.
 */
export function getDefaultDestinations(
  result: string,
  runners: BaseRunners
): RunnerRow[] {
  const rows: RunnerRow[] = [];

  // 3rd base runner
  if (runners.third) {
    let dest: RunnerDest = "stay";
    if (["1B", "2B", "3B", "HR", "SH", "SF"].includes(result)) dest = "scored";
    else if (["BB", "IBB", "HBP"].includes(result) && runners.first && runners.second)
      dest = "scored";
    rows.push({
      lineupId: runners.third.id,
      playerName: runners.third.player_name ?? "—",
      fromBase: "3rd",
      destination: dest,
    });
  }

  // 2nd base runner
  if (runners.second) {
    let dest: RunnerDest = "stay";
    if (["2B", "3B", "HR"].includes(result)) dest = "scored";
    else if (result === "1B") dest = "3rd";
    else if (result === "SH") dest = "3rd";
    else if (result === "DP") dest = "stay";
    else if (["BB", "IBB", "HBP"].includes(result) && runners.first) dest = "3rd";
    rows.push({
      lineupId: runners.second.id,
      playerName: runners.second.player_name ?? "—",
      fromBase: "2nd",
      destination: dest,
    });
  }

  // 1st base runner
  if (runners.first) {
    let dest: RunnerDest = "stay";
    if (["3B", "HR"].includes(result)) dest = "scored";
    else if (result === "2B") dest = "3rd";
    else if (result === "1B") dest = "2nd";
    else if (result === "SH") dest = "2nd";
    else if (result === "DP") dest = "out";
    else if (["BB", "IBB", "HBP"].includes(result)) dest = "2nd";
    rows.push({
      lineupId: runners.first.id,
      playerName: runners.first.player_name ?? "—",
      fromBase: "1st",
      destination: dest,
    });
  }

  return rows;
}

/**
 * Calculate default batter destination for a given result.
 */
export function getDefaultBatterDest(result: string): RunnerDest {
  if (result === "HR") return "scored";
  if (result === "3B") return "3rd";
  if (result === "2B") return "2nd";
  if (["1B", "BB", "IBB", "HBP", "E", "FC"].includes(result)) return "1st";
  return "out";
}

/**
 * Check if a runner is forced to advance given the at-bat result and current base runners.
 */
export function isRunnerForced(
  fromBase: "1st" | "2nd" | "3rd",
  result: string,
  runners: BaseRunners
): boolean {
  if (result === "HR") return true;

  if (["BB", "IBB", "HBP", "1B", "E", "FC"].includes(result)) {
    if (fromBase === "1st") return true;
    if (fromBase === "2nd") return !!runners.first;
    if (fromBase === "3rd") return !!runners.first && !!runners.second;
  }

  if (result === "2B") {
    if (fromBase === "2nd") return true;
    if (fromBase === "3rd") return !!runners.second;
  }

  if (result === "3B") {
    if (fromBase === "3rd") return true;
  }

  return false;
}

/**
 * Get available destination options for a runner on a given base.
 */
export function getDestOptionsForBase(
  fromBase: "batter" | "1st" | "2nd" | "3rd",
  opts?: { forceAdvance?: boolean }
): { value: RunnerDest; label: string }[] {
  const forceAdvance = opts?.forceAdvance ?? false;

  let options: { value: RunnerDest; label: string }[];
  switch (fromBase) {
    case "3rd":
      options = [
        { value: "stay", label: "そのまま" },
        { value: "scored", label: "得点" },
        { value: "out", label: "OUT" },
      ];
      break;
    case "2nd":
      options = [
        { value: "stay", label: "そのまま" },
        { value: "3rd", label: "→3塁" },
        { value: "scored", label: "得点" },
        { value: "out", label: "OUT" },
      ];
      break;
    case "1st":
      options = [
        { value: "stay", label: "そのまま" },
        { value: "2nd", label: "→2塁" },
        { value: "3rd", label: "→3塁" },
        { value: "scored", label: "得点" },
        { value: "out", label: "OUT" },
      ];
      break;
    case "batter":
      options = [
        { value: "1st", label: "→1塁" },
        { value: "2nd", label: "→2塁" },
        { value: "3rd", label: "→3塁" },
        { value: "scored", label: "得点" },
        { value: "out", label: "OUT" },
      ];
      break;
  }

  if (forceAdvance) {
    options = options.filter((o) => o.value !== "stay");
  }

  return options;
}
