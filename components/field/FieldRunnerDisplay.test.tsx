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
    g: ({ children, animate, initial, exit, transition, ...props }: Record<string, unknown>) => (
      <g {...props}>{children as React.ReactNode}</g>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
    expect(screen.queryByTestId("runner-first")).not.toBeInTheDocument();
    expect(screen.queryByTestId("runner-second")).not.toBeInTheDocument();
    expect(screen.queryByTestId("runner-third")).not.toBeInTheDocument();
  });

  it("renders runner on first base", () => {
    const baseRunners: BaseRunners = {
      first: makePlayer({ id: "l1", player_name: "鈴木一朗", player_number: "51" }),
      second: null,
      third: null,
    };

    render(<FieldRunnerDisplay baseRunners={baseRunners} />);

    expect(screen.getByTestId("runner-first")).toBeInTheDocument();
    expect(screen.getByText("鈴木一朗")).toBeInTheDocument();
    expect(screen.getByText("51")).toBeInTheDocument();
  });

  it("renders runners on all bases", () => {
    const baseRunners: BaseRunners = {
      first: makePlayer({ id: "l1", player_name: "選手A", player_number: "1" }),
      second: makePlayer({ id: "l2", player_name: "選手B", player_number: "2" }),
      third: makePlayer({ id: "l3", player_name: "選手C", player_number: "3" }),
    };

    render(<FieldRunnerDisplay baseRunners={baseRunners} />);

    expect(screen.getByTestId("runner-first")).toBeInTheDocument();
    expect(screen.getByTestId("runner-second")).toBeInTheDocument();
    expect(screen.getByTestId("runner-third")).toBeInTheDocument();
    expect(screen.getByText("選手A")).toBeInTheDocument();
    expect(screen.getByText("選手B")).toBeInTheDocument();
    expect(screen.getByText("選手C")).toBeInTheDocument();
  });

  it("renders base highlights for all bases", () => {
    const baseRunners: BaseRunners = {
      first: makePlayer({ id: "l1" }),
      second: null,
      third: null,
    };

    render(<FieldRunnerDisplay baseRunners={baseRunners} />);

    expect(screen.getByTestId("base-highlight-first")).toBeInTheDocument();
    expect(screen.getByTestId("base-highlight-second")).toBeInTheDocument();
    expect(screen.getByTestId("base-highlight-third")).toBeInTheDocument();
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
