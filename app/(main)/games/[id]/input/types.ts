// Shared types for runner destination tracking

export type RunnerDest = "1st" | "2nd" | "3rd" | "scored" | "out" | "stay";

export interface RunnerRow {
  lineupId: string;
  playerName: string;
  fromBase: "batter" | "1st" | "2nd" | "3rd";
  destination: RunnerDest;
}
