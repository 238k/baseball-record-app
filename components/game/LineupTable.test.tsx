import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LineupTable, type LineupRow } from "./LineupTable";

const makeRow = (overrides: Partial<LineupRow> & { batting_order: number }): LineupRow => ({
  id: `row-${overrides.batting_order}`,
  team_side: "home",
  player_name: `選手${overrides.batting_order}`,
  position: "一",
  inning_from: 1,
  ...overrides,
});

describe("LineupTable", () => {
  it("renders lineup rows with batting order, name, and position", () => {
    const lineup: LineupRow[] = [
      makeRow({ batting_order: 1, player_name: "田中太郎", position: "遊" }),
      makeRow({ batting_order: 2, player_name: "鈴木次郎", position: "二" }),
    ];

    render(<LineupTable title="テストチーム" lineup={lineup} />);

    expect(screen.getByText("テストチーム")).toBeInTheDocument();
    expect(screen.getByText("田中太郎")).toBeInTheDocument();
    expect(screen.getByText("鈴木次郎")).toBeInTheDocument();
    expect(screen.getByText("遊")).toBeInTheDocument();
    expect(screen.getByText("二")).toBeInTheDocument();
  });

  it("renders DH pitcher row when provided", () => {
    const lineup: LineupRow[] = [
      makeRow({ batting_order: 1, position: "DH", player_name: "打者A" }),
    ];
    const dhPitcher: LineupRow = makeRow({
      batting_order: 1,
      position: "投",
      player_name: "投手B",
    });

    render(
      <LineupTable title="DH制チーム" lineup={lineup} dhPitcher={dhPitcher} />
    );

    expect(screen.getByText("打者A")).toBeInTheDocument();
    expect(screen.getByText("投手B")).toBeInTheDocument();
    expect(screen.getByText("先発")).toBeInTheDocument();
  });

  it("does not render DH pitcher row when not provided", () => {
    const lineup: LineupRow[] = [
      makeRow({ batting_order: 1, position: "投", player_name: "投手C" }),
    ];

    render(<LineupTable title="通常チーム" lineup={lineup} />);

    expect(screen.getByText("投手C")).toBeInTheDocument();
    expect(screen.queryByText("先発")).not.toBeInTheDocument();
  });

  it("displays dash for null player_name and position", () => {
    const lineup: LineupRow[] = [
      makeRow({ batting_order: 1, player_name: null, position: null }),
    ];

    render(<LineupTable title="テスト" lineup={lineup} />);

    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBe(2);
  });
});
