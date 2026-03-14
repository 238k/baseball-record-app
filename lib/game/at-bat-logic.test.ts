import { describe, expect, it } from "vitest";
import { countOutsFromResult } from "./at-bat-logic";
import type { RunnerRow } from "@/app/(main)/games/[id]/input/types";

describe("countOutsFromResult", () => {
  it("returns 0 when no outs", () => {
    expect(countOutsFromResult("1B", "1st", [])).toBe(0);
  });

  it("counts batter out", () => {
    expect(countOutsFromResult("GO", "out", [])).toBe(1);
  });

  it("counts runner out", () => {
    const rows: RunnerRow[] = [
      { lineupId: "a", playerName: "A", fromBase: "1st", destination: "out" },
    ];
    expect(countOutsFromResult("FC", "1st", rows)).toBe(1);
  });

  it("counts DP (batter + runner out)", () => {
    const rows: RunnerRow[] = [
      { lineupId: "a", playerName: "A", fromBase: "1st", destination: "out" },
    ];
    expect(countOutsFromResult("DP", "out", rows)).toBe(2);
  });
});
