import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FieldRunnerDisplay } from "./FieldRunnerDisplay";
import type { BaseRunners, LineupPlayer } from "@/hooks/useGameState";

// Mock framer-motion to render plain SVG elements
/* eslint-disable @typescript-eslint/no-unused-vars */
vi.mock("framer-motion", () => ({
  motion: {
    rect: ({ children, animate, initial, exit, transition, ...props }: Record<string, unknown>) => (
      <rect {...props}>{children as React.ReactNode}</rect>
    ),
  },
}));
/* eslint-enable @typescript-eslint/no-unused-vars */

const makePlayer = (overrides: Partial<LineupPlayer> = {}): LineupPlayer => ({
  id: "lineup-1",
  batting_order: 1,
  player_id: "player-1",
  player_name: "田中太郎",
  player_number: "1",
  position: "投",
  team_side: "home",
  inning_from: 1,
  ...overrides,
});

describe("FieldRunnerDisplay", () => {
  it("renders diamond with no runners", () => {
    const baseRunners: BaseRunners = {
      first: null,
      second: null,
      third: null,
    };

    render(<FieldRunnerDisplay baseRunners={baseRunners} />);

    expect(screen.getByTestId("baseball-field-svg")).toBeInTheDocument();
    expect(screen.getByTestId("base-highlight-first")).toBeInTheDocument();
    expect(screen.getByTestId("base-highlight-second")).toBeInTheDocument();
    expect(screen.getByTestId("base-highlight-third")).toBeInTheDocument();
  });

  it("renders base highlights for occupied bases", () => {
    const baseRunners: BaseRunners = {
      first: makePlayer({ id: "l1" }),
      second: null,
      third: makePlayer({ id: "l3" }),
    };

    render(<FieldRunnerDisplay baseRunners={baseRunners} />);

    expect(screen.getByTestId("base-highlight-first")).toBeInTheDocument();
    expect(screen.getByTestId("base-highlight-second")).toBeInTheDocument();
    expect(screen.getByTestId("base-highlight-third")).toBeInTheDocument();
  });

  it("renders highlights for all bases when loaded", () => {
    const baseRunners: BaseRunners = {
      first: makePlayer({ id: "l1" }),
      second: makePlayer({ id: "l2" }),
      third: makePlayer({ id: "l3" }),
    };

    render(<FieldRunnerDisplay baseRunners={baseRunners} />);

    expect(screen.getByTestId("base-highlight-first")).toBeInTheDocument();
    expect(screen.getByTestId("base-highlight-second")).toBeInTheDocument();
    expect(screen.getByTestId("base-highlight-third")).toBeInTheDocument();
  });

  it("does not show pitcher's mound in diamond variant", () => {
    const baseRunners: BaseRunners = {
      first: null,
      second: null,
      third: null,
    };

    render(<FieldRunnerDisplay baseRunners={baseRunners} />);

    expect(screen.queryByTestId("pitchers-mound")).not.toBeInTheDocument();
  });

  it("applies className prop", () => {
    const baseRunners: BaseRunners = {
      first: null,
      second: null,
      third: null,
    };

    render(<FieldRunnerDisplay baseRunners={baseRunners} className="w-48" />);

    const svg = screen.getByTestId("baseball-field-svg");
    expect(svg).toHaveClass("w-48");
  });
});
