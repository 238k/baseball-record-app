import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TodayGameCard } from "./TodayGameCard";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const baseGame = {
  id: "game-1",
  opponent_name: "テストタイガース",
  game_date: "2026-02-25",
  is_home: true,
  location: "テスト球場",
};

describe("TodayGameCard", () => {
  it("shows '記録' for in_progress and '編集' for scheduled", () => {
    const { unmount } = render(<TodayGameCard game={{ ...baseGame, status: "in_progress" }} />);
    expect(screen.getByText("記録")).toBeInTheDocument();
    expect(screen.getByText("観戦")).toBeInTheDocument();
    unmount();

    render(<TodayGameCard game={{ ...baseGame, status: "scheduled" }} />);
    expect(screen.getByText("編集")).toBeInTheDocument();
  });

  it("links record button to /input and spectate to /games/[id]", () => {
    render(<TodayGameCard game={{ ...baseGame, status: "in_progress" }} />);

    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "/games/game-1/input");
    expect(links[1]).toHaveAttribute("href", "/games/game-1");
  });

  it("disables spectate button for scheduled games without lineup", () => {
    render(<TodayGameCard game={{ ...baseGame, status: "scheduled" }} hasLineup={false} />);

    const spectateButton = screen.getByText("観戦").closest("button");
    expect(spectateButton).toBeDisabled();
  });

  it("enables spectate button for scheduled games with lineup", () => {
    render(<TodayGameCard game={{ ...baseGame, status: "scheduled" }} hasLineup={true} />);

    const spectateButton = screen.getByText("観戦").closest("button");
    expect(spectateButton).not.toBeDisabled();
  });

  it("renders LIVE badge for in_progress games", () => {
    render(
      <TodayGameCard
        game={{ ...baseGame, status: "in_progress" }}
        score={{ home: 3, visitor: 1 }}
      />
    );

    expect(screen.getByText("LIVE")).toBeInTheDocument();
    expect(screen.getByText("3 - 1")).toBeInTheDocument();
  });

  it("shows location when provided", () => {
    render(<TodayGameCard game={{ ...baseGame, status: "scheduled" }} />);
    expect(screen.getByText(/テスト球場/)).toBeInTheDocument();
  });

  it("shows visitor label for away games", () => {
    render(
      <TodayGameCard
        game={{ ...baseGame, is_home: false, status: "scheduled" }}
      />
    );
    expect(screen.getByText(/ビジター/)).toBeInTheDocument();
  });

  it("shows free mode badge and team names for free mode games", () => {
    render(
      <TodayGameCard
        game={{
          ...baseGame,
          status: "scheduled",
          is_free_mode: true,
          home_team_name: "レッドスターズ",
          visitor_team_name: "ブルーウェーブ",
        }}
      />
    );
    expect(screen.getByText("フリー")).toBeInTheDocument();
    expect(screen.getByText("レッドスターズ vs ブルーウェーブ")).toBeInTheDocument();
  });

  it("finished games do not show record/edit button", () => {
    render(
      <TodayGameCard
        game={{ ...baseGame, status: "finished" }}
        score={{ home: 5, visitor: 2 }}
      />
    );
    expect(screen.queryByText("記録")).not.toBeInTheDocument();
    expect(screen.queryByText("編集")).not.toBeInTheDocument();
    // Spectate button should still be visible
    expect(screen.getByText("観戦")).toBeInTheDocument();
  });

  it("shows free mode score as home - visitor", () => {
    render(
      <TodayGameCard
        game={{
          ...baseGame,
          status: "in_progress",
          is_free_mode: true,
          home_team_name: "レッドスターズ",
          visitor_team_name: "ブルーウェーブ",
        }}
        score={{ home: 5, visitor: 2 }}
      />
    );
    expect(screen.getByText("5 - 2")).toBeInTheDocument();
  });
});
