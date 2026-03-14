import { describe, expect, it } from "vitest";
import {
  getDefaultDestinations,
  getDefaultBatterDest,
  isRunnerForced,
  getDestOptionsForBase,
} from "./runner-logic";
import type { BaseRunners, LineupPlayer } from "@/hooks/useGameState";

function makePlayer(id: string, name: string): LineupPlayer {
  return {
    id,
    batting_order: 1,
    player_id: null,
    player_name: name,
    player_number: null,
    position: null,
    team_side: "home",
    inning_from: 1,
  };
}

const empty: BaseRunners = { first: null, second: null, third: null };

describe("getDefaultDestinations", () => {
  it("returns empty array when no runners", () => {
    expect(getDefaultDestinations("1B", empty)).toEqual([]);
  });

  it("advances runner on 1st to 2nd on single", () => {
    const runners: BaseRunners = { first: makePlayer("a", "A"), second: null, third: null };
    const rows = getDefaultDestinations("1B", runners);
    expect(rows).toHaveLength(1);
    expect(rows[0].destination).toBe("2nd");
  });

  it("scores all runners on HR", () => {
    const runners: BaseRunners = {
      first: makePlayer("a", "A"),
      second: makePlayer("b", "B"),
      third: makePlayer("c", "C"),
    };
    const rows = getDefaultDestinations("HR", runners);
    expect(rows.every((r) => r.destination === "scored")).toBe(true);
  });

  it("forces runner on 3rd to score on BB with bases loaded", () => {
    const runners: BaseRunners = {
      first: makePlayer("a", "A"),
      second: makePlayer("b", "B"),
      third: makePlayer("c", "C"),
    };
    const rows = getDefaultDestinations("BB", runners);
    const third = rows.find((r) => r.fromBase === "3rd");
    expect(third?.destination).toBe("scored");
  });

  it("runner on 3rd stays on BB without bases loaded", () => {
    const runners: BaseRunners = { first: null, second: null, third: makePlayer("c", "C") };
    const rows = getDefaultDestinations("BB", runners);
    expect(rows[0].destination).toBe("stay");
  });

  it("DP puts runner on 1st out", () => {
    const runners: BaseRunners = { first: makePlayer("a", "A"), second: null, third: null };
    const rows = getDefaultDestinations("DP", runners);
    expect(rows[0].destination).toBe("out");
  });

  it("SH advances runner on 1st to 2nd", () => {
    const runners: BaseRunners = { first: makePlayer("a", "A"), second: null, third: null };
    const rows = getDefaultDestinations("SH", runners);
    expect(rows[0].destination).toBe("2nd");
  });
});

describe("getDefaultBatterDest", () => {
  it("HR → scored", () => expect(getDefaultBatterDest("HR")).toBe("scored"));
  it("3B → 3rd", () => expect(getDefaultBatterDest("3B")).toBe("3rd"));
  it("2B → 2nd", () => expect(getDefaultBatterDest("2B")).toBe("2nd"));
  it("1B → 1st", () => expect(getDefaultBatterDest("1B")).toBe("1st"));
  it("BB → 1st", () => expect(getDefaultBatterDest("BB")).toBe("1st"));
  it("K → out", () => expect(getDefaultBatterDest("K")).toBe("out"));
  it("GO → out", () => expect(getDefaultBatterDest("GO")).toBe("out"));
  it("E → 1st", () => expect(getDefaultBatterDest("E")).toBe("1st"));
  it("FC → 1st", () => expect(getDefaultBatterDest("FC")).toBe("1st"));
});

describe("isRunnerForced", () => {
  it("HR forces all runners", () => {
    expect(isRunnerForced("1st", "HR", empty)).toBe(true);
    expect(isRunnerForced("2nd", "HR", empty)).toBe(true);
    expect(isRunnerForced("3rd", "HR", empty)).toBe(true);
  });

  it("BB forces 1st base runner", () => {
    expect(isRunnerForced("1st", "BB", empty)).toBe(true);
  });

  it("BB does not force 2nd if 1st is empty", () => {
    expect(isRunnerForced("2nd", "BB", empty)).toBe(false);
  });

  it("BB forces 2nd if 1st is occupied", () => {
    const runners: BaseRunners = { first: makePlayer("a", "A"), second: null, third: null };
    expect(isRunnerForced("2nd", "BB", runners)).toBe(true);
  });

  it("2B forces 2nd base runner", () => {
    expect(isRunnerForced("2nd", "2B", empty)).toBe(true);
  });

  it("strikeout does not force anyone", () => {
    expect(isRunnerForced("1st", "K", empty)).toBe(false);
  });
});

describe("getDestOptionsForBase", () => {
  it("batter has no stay option", () => {
    const opts = getDestOptionsForBase("batter");
    expect(opts.find((o) => o.value === "stay")).toBeUndefined();
  });

  it("3rd base has stay, scored, out", () => {
    const opts = getDestOptionsForBase("3rd");
    expect(opts.map((o) => o.value)).toEqual(["stay", "scored", "out"]);
  });

  it("forceAdvance removes stay", () => {
    const opts = getDestOptionsForBase("1st", { forceAdvance: true });
    expect(opts.find((o) => o.value === "stay")).toBeUndefined();
  });
});
