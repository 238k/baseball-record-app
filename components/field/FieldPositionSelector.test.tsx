import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FieldPositionSelector } from "./FieldPositionSelector";
import type { LineupEntry } from "@/components/game/LineupEditor";

// Mock framer-motion
/* eslint-disable @typescript-eslint/no-unused-vars */
vi.mock("framer-motion", () => ({
  motion: {
    g: ({
      children,
      animate,
      initial,
      exit,
      transition,
      layoutId,
      style,
      onKeyDown,
      ...props
    }: Record<string, unknown>) => (
      <g
        {...props}
        onKeyDown={onKeyDown as React.KeyboardEventHandler<SVGGElement>}
      >
        {children as React.ReactNode}
      </g>
    ),
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

const createLineup = (useDh = false): LineupEntry[] => {
  const positions = useDh
    ? ["DH", "捕", "一", "二", "三", "遊", "左", "中", "右"]
    : ["投", "捕", "一", "二", "三", "遊", "左", "中", "右"];

  return positions.map((pos, i) => ({
    battingOrder: i + 1,
    playerId: `p${i + 1}`,
    playerName: `選手${i + 1}`,
    position: pos,
  }));
};

describe("FieldPositionSelector", () => {
  it("renders all 9 defensive positions", () => {
    const lineup = createLineup();
    const onSwap = vi.fn();

    render(
      <FieldPositionSelector
        lineup={lineup}
        useDh={false}
        onPositionSwap={onSwap}
      />
    );

    for (const pos of ["投", "捕", "一", "二", "三", "遊", "左", "中", "右"]) {
      expect(screen.getByTestId(`position-${pos}`)).toBeInTheDocument();
    }
  });

  it("renders DH position when useDh is true", () => {
    const lineup = createLineup(true);
    const onSwap = vi.fn();

    render(
      <FieldPositionSelector
        lineup={lineup}
        useDh={true}
        onPositionSwap={onSwap}
      />
    );

    expect(screen.getByTestId("position-DH")).toBeInTheDocument();
    expect(screen.queryByTestId("position-投")).not.toBeInTheDocument();
  });

  it("displays player names for each position", () => {
    const lineup = createLineup();
    const onSwap = vi.fn();

    render(
      <FieldPositionSelector
        lineup={lineup}
        useDh={false}
        onPositionSwap={onSwap}
      />
    );

    expect(screen.getByText("選手1")).toBeInTheDocument();
    expect(screen.getByText("選手9")).toBeInTheDocument();
  });

  it("shows '未設定' for unassigned positions", () => {
    const lineup: LineupEntry[] = [
      {
        battingOrder: 1,
        playerId: null,
        playerName: null,
        position: "投",
      },
    ];
    const onSwap = vi.fn();

    render(
      <FieldPositionSelector
        lineup={lineup}
        useDh={false}
        onPositionSwap={onSwap}
      />
    );

    // Multiple unassigned positions will show 未設定
    const unsetLabels = screen.getAllByText("未設定");
    expect(unsetLabels.length).toBeGreaterThan(0);
  });

  it("calls onPositionSwap when two positions are tapped", () => {
    const lineup = createLineup();
    const onSwap = vi.fn();

    render(
      <FieldPositionSelector
        lineup={lineup}
        useDh={false}
        onPositionSwap={onSwap}
      />
    );

    // Tap first position
    fireEvent.click(screen.getByTestId("position-投"));
    // Tap second position
    fireEvent.click(screen.getByTestId("position-捕"));

    expect(onSwap).toHaveBeenCalledWith("投", "捕");
  });

  it("deselects when the same position is tapped twice", () => {
    const lineup = createLineup();
    const onSwap = vi.fn();

    render(
      <FieldPositionSelector
        lineup={lineup}
        useDh={false}
        onPositionSwap={onSwap}
      />
    );

    // Tap position to select
    fireEvent.click(screen.getByTestId("position-投"));
    // Tap same position to deselect
    fireEvent.click(screen.getByTestId("position-投"));
    // Tap another position — should be a new selection, not a swap
    fireEvent.click(screen.getByTestId("position-捕"));

    expect(onSwap).not.toHaveBeenCalled();
  });

  it("has accessible button roles with position labels", () => {
    const lineup = createLineup();
    const onSwap = vi.fn();

    render(
      <FieldPositionSelector
        lineup={lineup}
        useDh={false}
        onPositionSwap={onSwap}
      />
    );

    const btn = screen.getByRole("button", { name: /投 - 選手1/ });
    expect(btn).toBeInTheDocument();
  });
});
