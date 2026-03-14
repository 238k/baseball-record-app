import { describe, expect, it } from "vitest";
import { computeRbi } from "./rbi-logic";
import type { RunnerRow } from "@/app/(main)/games/[id]/input/types";

describe("computeRbi", () => {
  it("returns 0 when no one scores", () => {
    expect(computeRbi("GO", "out", [])).toBe(0);
  });

  it("counts batter scoring (HR, no runners)", () => {
    expect(computeRbi("HR", "scored", [])).toBe(1);
  });

  it("counts runners scoring", () => {
    const rows: RunnerRow[] = [
      { lineupId: "a", playerName: "A", fromBase: "3rd", destination: "scored" },
      { lineupId: "b", playerName: "B", fromBase: "2nd", destination: "3rd" },
    ];
    expect(computeRbi("1B", "1st", rows)).toBe(1);
  });

  it("grand slam = 4 RBI", () => {
    const rows: RunnerRow[] = [
      { lineupId: "a", playerName: "A", fromBase: "1st", destination: "scored" },
      { lineupId: "b", playerName: "B", fromBase: "2nd", destination: "scored" },
      { lineupId: "c", playerName: "C", fromBase: "3rd", destination: "scored" },
    ];
    expect(computeRbi("HR", "scored", rows)).toBe(4);
  });

  it("DP always returns 0 RBI", () => {
    const rows: RunnerRow[] = [
      { lineupId: "a", playerName: "A", fromBase: "3rd", destination: "scored" },
    ];
    expect(computeRbi("DP", "out", rows)).toBe(0);
  });
});
