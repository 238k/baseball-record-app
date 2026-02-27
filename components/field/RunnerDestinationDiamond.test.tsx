import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RunnerDestinationDiamond } from "./RunnerDestinationDiamond";
import type { RunnerDest, RunnerRow } from "@/app/(main)/games/[id]/input/types";

// Mock framer-motion to render plain SVG elements
/* eslint-disable @typescript-eslint/no-unused-vars */
vi.mock("framer-motion", () => ({
  motion: {
    g: ({
      children,
      animate,
      initial,
      exit,
      transition,
      ...props
    }: Record<string, unknown>) => <g {...props}>{children as React.ReactNode}</g>,
    circle: ({
      children,
      animate,
      initial,
      exit,
      transition,
      ...props
    }: Record<string, unknown>) => (
      <circle {...props}>{children as React.ReactNode}</circle>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
/* eslint-enable @typescript-eslint/no-unused-vars */

const defaultBatter = {
  lineupId: "batter-1",
  playerName: "打者太郎",
  destination: "1st" as RunnerDest,
};

const makeRunner = (overrides: Partial<RunnerRow> = {}): RunnerRow => ({
  lineupId: "runner-1",
  playerName: "走者一郎",
  fromBase: "1st",
  destination: "2nd",
  ...overrides,
});

// Returns all destinations as valid by default
const allDestsFor = (fromBase: "batter" | "1st" | "2nd" | "3rd"): RunnerDest[] => {
  switch (fromBase) {
    case "3rd":
      return ["scored", "out", "stay"];
    case "2nd":
      return ["3rd", "scored", "out", "stay"];
    case "1st":
      return ["2nd", "3rd", "scored", "out", "stay"];
    case "batter":
      return ["1st", "2nd", "3rd", "scored", "out"];
  }
};

describe("RunnerDestinationDiamond", () => {
  it("renders runner dots at correct positions", () => {
    const runners: RunnerRow[] = [
      makeRunner({ lineupId: "r1", playerName: "走者一", fromBase: "1st", destination: "2nd" }),
      makeRunner({ lineupId: "r2", playerName: "走者二", fromBase: "2nd", destination: "3rd" }),
    ];

    render(
      <RunnerDestinationDiamond
        runnerRows={runners}
        batter={defaultBatter}
        getDestOptions={allDestsFor}
        onRunnerDestChange={vi.fn()}
        onBatterDestChange={vi.fn()}
      />
    );

    expect(screen.getByTestId("dot-runner-r1")).toBeInTheDocument();
    expect(screen.getByTestId("dot-runner-r2")).toBeInTheDocument();
    expect(screen.getByTestId("dot-batter")).toBeInTheDocument();
  });

  it("shows ghost dots for runners that have moved from origin", () => {
    const runners: RunnerRow[] = [
      makeRunner({ lineupId: "r1", fromBase: "1st", destination: "scored" }),
    ];

    render(
      <RunnerDestinationDiamond
        runnerRows={runners}
        batter={defaultBatter}
        getDestOptions={allDestsFor}
        onRunnerDestChange={vi.fn()}
        onBatterDestChange={vi.fn()}
      />
    );

    expect(screen.getByTestId("ghost-runner-r1")).toBeInTheDocument();
  });

  it("does not show ghost dots for runners that stay", () => {
    const runners: RunnerRow[] = [
      makeRunner({ lineupId: "r1", fromBase: "1st", destination: "stay" }),
    ];

    render(
      <RunnerDestinationDiamond
        runnerRows={runners}
        batter={{ ...defaultBatter, destination: "stay" as RunnerDest }}
        getDestOptions={allDestsFor}
        onRunnerDestChange={vi.fn()}
        onBatterDestChange={vi.fn()}
      />
    );

    expect(screen.queryByTestId("ghost-runner-r1")).not.toBeInTheDocument();
  });

  it("shows pulse ring when a runner is selected", () => {
    const runners: RunnerRow[] = [
      makeRunner({ lineupId: "r1", fromBase: "1st", destination: "2nd" }),
    ];

    render(
      <RunnerDestinationDiamond
        runnerRows={runners}
        batter={defaultBatter}
        getDestOptions={allDestsFor}
        onRunnerDestChange={vi.fn()}
        onBatterDestChange={vi.fn()}
      />
    );

    // Initially no pulse
    expect(screen.queryByTestId("pulse-runner-r1")).not.toBeInTheDocument();

    // Click the runner dot
    fireEvent.click(screen.getByTestId("dot-runner-r1"));

    // Pulse ring appears
    expect(screen.getByTestId("pulse-runner-r1")).toBeInTheDocument();
  });

  it("shows destination zones when a runner is selected", () => {
    const runners: RunnerRow[] = [
      makeRunner({ lineupId: "r1", fromBase: "1st", destination: "stay" }),
    ];

    render(
      <RunnerDestinationDiamond
        runnerRows={runners}
        batter={defaultBatter}
        getDestOptions={allDestsFor}
        onRunnerDestChange={vi.fn()}
        onBatterDestChange={vi.fn()}
      />
    );

    // Zones not visible initially
    expect(screen.queryByTestId("zone-scored")).not.toBeInTheDocument();
    expect(screen.queryByTestId("zone-out")).not.toBeInTheDocument();

    // Select runner
    fireEvent.click(screen.getByTestId("dot-runner-r1"));

    // Zones become visible
    expect(screen.getByTestId("zone-scored")).toBeInTheDocument();
    expect(screen.getByTestId("zone-out")).toBeInTheDocument();
  });

  it("calls onRunnerDestChange when tapping a valid destination zone", () => {
    const onRunnerDestChange = vi.fn();
    const runners: RunnerRow[] = [
      makeRunner({ lineupId: "r1", fromBase: "1st", destination: "stay" }),
    ];

    render(
      <RunnerDestinationDiamond
        runnerRows={runners}
        batter={defaultBatter}
        getDestOptions={allDestsFor}
        onRunnerDestChange={onRunnerDestChange}
        onBatterDestChange={vi.fn()}
      />
    );

    // Select runner
    fireEvent.click(screen.getByTestId("dot-runner-r1"));

    // Tap scored zone
    fireEvent.click(screen.getByTestId("zone-scored"));

    expect(onRunnerDestChange).toHaveBeenCalledWith("r1", "scored");
  });

  it("calls onBatterDestChange when batter is selected and destination tapped", () => {
    const onBatterDestChange = vi.fn();

    render(
      <RunnerDestinationDiamond
        runnerRows={[]}
        batter={defaultBatter}
        getDestOptions={allDestsFor}
        onRunnerDestChange={vi.fn()}
        onBatterDestChange={onBatterDestChange}
      />
    );

    // Select batter
    fireEvent.click(screen.getByTestId("dot-batter"));

    // Tap scored zone
    fireEvent.click(screen.getByTestId("zone-scored"));

    expect(onBatterDestChange).toHaveBeenCalledWith("scored");
  });

  it("does not call callback when tapping an invalid zone", () => {
    const onRunnerDestChange = vi.fn();
    // 3rd base runner can only go to: scored, out, stay
    const runners: RunnerRow[] = [
      makeRunner({ lineupId: "r1", fromBase: "3rd", destination: "stay" }),
    ];

    const restrictedDests = (fromBase: "batter" | "1st" | "2nd" | "3rd"): RunnerDest[] => {
      if (fromBase === "3rd") return ["scored", "out"];
      return allDestsFor(fromBase);
    };

    render(
      <RunnerDestinationDiamond
        runnerRows={runners}
        batter={defaultBatter}
        getDestOptions={restrictedDests}
        onRunnerDestChange={onRunnerDestChange}
        onBatterDestChange={vi.fn()}
      />
    );

    // Select runner
    fireEvent.click(screen.getByTestId("dot-runner-r1"));

    // zone-2nd should not be rendered (not in valid dests)
    expect(screen.queryByTestId("zone-2nd")).not.toBeInTheDocument();

    expect(onRunnerDestChange).not.toHaveBeenCalled();
  });

  it("deselects when clicking the same runner again", () => {
    const runners: RunnerRow[] = [
      makeRunner({ lineupId: "r1", fromBase: "1st", destination: "2nd" }),
    ];

    render(
      <RunnerDestinationDiamond
        runnerRows={runners}
        batter={defaultBatter}
        getDestOptions={allDestsFor}
        onRunnerDestChange={vi.fn()}
        onBatterDestChange={vi.fn()}
      />
    );

    // Select
    fireEvent.click(screen.getByTestId("dot-runner-r1"));
    expect(screen.getByTestId("pulse-runner-r1")).toBeInTheDocument();

    // Deselect
    fireEvent.click(screen.getByTestId("dot-runner-r1"));
    expect(screen.queryByTestId("pulse-runner-r1")).not.toBeInTheDocument();
  });

  it("deselects when clicking background", () => {
    const runners: RunnerRow[] = [
      makeRunner({ lineupId: "r1", fromBase: "1st", destination: "2nd" }),
    ];

    render(
      <RunnerDestinationDiamond
        runnerRows={runners}
        batter={defaultBatter}
        getDestOptions={allDestsFor}
        onRunnerDestChange={vi.fn()}
        onBatterDestChange={vi.fn()}
      />
    );

    // Select
    fireEvent.click(screen.getByTestId("dot-runner-r1"));
    expect(screen.getByTestId("pulse-runner-r1")).toBeInTheDocument();

    // Click background
    fireEvent.click(screen.getByTestId("diamond-background"));
    expect(screen.queryByTestId("pulse-runner-r1")).not.toBeInTheDocument();
  });

  it("renders multiple runners that score in stacked positions", () => {
    // Both runners scored — they should both be at scored zone
    const runners: RunnerRow[] = [
      makeRunner({ lineupId: "r1", playerName: "走者一", fromBase: "1st", destination: "scored" }),
      makeRunner({ lineupId: "r2", playerName: "走者二", fromBase: "2nd", destination: "scored" }),
      makeRunner({ lineupId: "r3", playerName: "走者三", fromBase: "3rd", destination: "scored" }),
    ];

    render(
      <RunnerDestinationDiamond
        runnerRows={runners}
        batter={{ ...defaultBatter, destination: "scored" }}
        getDestOptions={allDestsFor}
        onRunnerDestChange={vi.fn()}
        onBatterDestChange={vi.fn()}
      />
    );

    // All dots should be present
    expect(screen.getByTestId("dot-runner-r1")).toBeInTheDocument();
    expect(screen.getByTestId("dot-runner-r2")).toBeInTheDocument();
    expect(screen.getByTestId("dot-runner-r3")).toBeInTheDocument();
    expect(screen.getByTestId("dot-batter")).toBeInTheDocument();
  });

  it("excludes bases already occupied by another runner from valid destinations", () => {
    // Runner on 1st → 2nd, batter should not see 2nd (collision)
    const runners: RunnerRow[] = [
      makeRunner({ lineupId: "r1", fromBase: "1st", destination: "2nd" }),
    ];

    render(
      <RunnerDestinationDiamond
        runnerRows={runners}
        batter={{ ...defaultBatter, destination: "out" }}
        getDestOptions={allDestsFor}
        onRunnerDestChange={vi.fn()}
        onBatterDestChange={vi.fn()}
      />
    );

    // Select batter
    fireEvent.click(screen.getByTestId("dot-batter"));

    // zone-2nd should NOT appear because r1 occupies 2nd
    expect(screen.queryByTestId("zone-2nd")).not.toBeInTheDocument();

    // zone-1st should appear (runner moved away)
    expect(screen.getByTestId("zone-1st")).toBeInTheDocument();
  });

  it("excludes bases occupied by batter from runner destinations", () => {
    // Batter goes to 2nd, runner on 1st should not be able to go to 2nd
    const runners: RunnerRow[] = [
      makeRunner({ lineupId: "r1", fromBase: "1st", destination: "stay" }),
    ];

    render(
      <RunnerDestinationDiamond
        runnerRows={runners}
        batter={{ ...defaultBatter, destination: "2nd" }}
        getDestOptions={allDestsFor}
        onRunnerDestChange={vi.fn()}
        onBatterDestChange={vi.fn()}
      />
    );

    // Select runner
    fireEvent.click(screen.getByTestId("dot-runner-r1"));

    // zone-2nd should NOT appear because batter occupies 2nd
    expect(screen.queryByTestId("zone-2nd")).not.toBeInTheDocument();

    // zone-3rd should appear
    expect(screen.getByTestId("zone-3rd")).toBeInTheDocument();
  });

  it("allows scored and out zones even when others are there", () => {
    const runners: RunnerRow[] = [
      makeRunner({ lineupId: "r1", fromBase: "3rd", destination: "scored" }),
      makeRunner({ lineupId: "r2", fromBase: "2nd", destination: "stay" }),
    ];

    render(
      <RunnerDestinationDiamond
        runnerRows={runners}
        batter={defaultBatter}
        getDestOptions={allDestsFor}
        onRunnerDestChange={vi.fn()}
        onBatterDestChange={vi.fn()}
      />
    );

    // Select r2
    fireEvent.click(screen.getByTestId("dot-runner-r2"));

    // scored zone should be available even though r1 is already scored
    expect(screen.getByTestId("zone-scored")).toBeInTheDocument();
  });

  it("prevents runner from passing a runner ahead (no-passing rule)", () => {
    // Runner on 3rd stays → runner on 1st cannot score (would pass 3rd runner)
    const runners: RunnerRow[] = [
      makeRunner({ lineupId: "r3", fromBase: "3rd", destination: "stay" }),
      makeRunner({ lineupId: "r1", fromBase: "1st", destination: "stay" }),
    ];

    render(
      <RunnerDestinationDiamond
        runnerRows={runners}
        batter={{ ...defaultBatter, destination: "out" }}
        getDestOptions={allDestsFor}
        onRunnerDestChange={vi.fn()}
        onBatterDestChange={vi.fn()}
      />
    );

    // Select runner on 1st
    fireEvent.click(screen.getByTestId("dot-runner-r1"));

    // scored should NOT appear: 3rd runner at order 3, so max for 1st runner = 3-1 = 2
    expect(screen.queryByTestId("zone-scored")).not.toBeInTheDocument();

    // 2nd is valid (order 2 <= max 2)
    expect(screen.getByTestId("zone-2nd")).toBeInTheDocument();

    // 3rd is blocked by collision (r3 is there)
    expect(screen.queryByTestId("zone-3rd")).not.toBeInTheDocument();
  });

  it("prevents batter from passing a runner on 1st who stays", () => {
    // Runner on 1st stays → batter cannot go to 1st or beyond
    const runners: RunnerRow[] = [
      makeRunner({ lineupId: "r1", fromBase: "1st", destination: "stay" }),
    ];

    render(
      <RunnerDestinationDiamond
        runnerRows={runners}
        batter={{ ...defaultBatter, destination: "out" }}
        getDestOptions={allDestsFor}
        onRunnerDestChange={vi.fn()}
        onBatterDestChange={vi.fn()}
      />
    );

    // Select batter
    fireEvent.click(screen.getByTestId("dot-batter"));

    // 1st blocked by collision, 2nd/3rd/scored blocked by no-passing (max = 1-1 = 0)
    expect(screen.queryByTestId("zone-1st")).not.toBeInTheDocument();
    expect(screen.queryByTestId("zone-2nd")).not.toBeInTheDocument();
    expect(screen.queryByTestId("zone-3rd")).not.toBeInTheDocument();
    expect(screen.queryByTestId("zone-scored")).not.toBeInTheDocument();

    // out is always available
    expect(screen.getByTestId("zone-out")).toBeInTheDocument();
  });

  it("allows passing when the runner ahead is out", () => {
    // Runner on 3rd is out → runner on 1st can score
    const runners: RunnerRow[] = [
      makeRunner({ lineupId: "r3", fromBase: "3rd", destination: "out" }),
      makeRunner({ lineupId: "r1", fromBase: "1st", destination: "stay" }),
    ];

    render(
      <RunnerDestinationDiamond
        runnerRows={runners}
        batter={{ ...defaultBatter, destination: "out" }}
        getDestOptions={allDestsFor}
        onRunnerDestChange={vi.fn()}
        onBatterDestChange={vi.fn()}
      />
    );

    // Select runner on 1st
    fireEvent.click(screen.getByTestId("dot-runner-r1"));

    // scored should be available (r3 is out, no blocking)
    expect(screen.getByTestId("zone-scored")).toBeInTheDocument();
    expect(screen.getByTestId("zone-3rd")).toBeInTheDocument();
  });

  it("chains no-passing correctly across multiple runners", () => {
    // 3rd→scored, 2nd→3rd: runner on 1st max = 3-1 = 2
    const runners: RunnerRow[] = [
      makeRunner({ lineupId: "r3", fromBase: "3rd", destination: "scored" }),
      makeRunner({ lineupId: "r2", fromBase: "2nd", destination: "3rd" }),
      makeRunner({ lineupId: "r1", fromBase: "1st", destination: "stay" }),
    ];

    render(
      <RunnerDestinationDiamond
        runnerRows={runners}
        batter={{ ...defaultBatter, destination: "out" }}
        getDestOptions={allDestsFor}
        onRunnerDestChange={vi.fn()}
        onBatterDestChange={vi.fn()}
      />
    );

    // Select runner on 1st
    fireEvent.click(screen.getByTestId("dot-runner-r1"));

    // max order = min(scored(4), 3rd(3)) - 1 = 2, so 2nd ok, 3rd/scored blocked
    expect(screen.getByTestId("zone-2nd")).toBeInTheDocument();
    expect(screen.queryByTestId("zone-3rd")).not.toBeInTheDocument();
    expect(screen.queryByTestId("zone-scored")).not.toBeInTheDocument();
  });
});
