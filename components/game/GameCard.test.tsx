import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GameCard } from "./GameCard";

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
  status: "scheduled" as const,
};

describe("GameCard", () => {
  it("renders opponent name for team games", () => {
    render(<GameCard game={baseGame} />);
    expect(screen.getByText("vs テストタイガース")).toBeInTheDocument();
  });

  it("shows free mode badge and team names for free mode games", () => {
    render(
      <GameCard
        game={{
          ...baseGame,
          is_free_mode: true,
          home_team_name: "レッドスターズ",
          visitor_team_name: "ブルーウェーブ",
        }}
      />
    );
    expect(screen.getByText("フリー")).toBeInTheDocument();
    expect(screen.getByText("レッドスターズ vs ブルーウェーブ")).toBeInTheDocument();
  });

  it("shows free mode score as home - visitor", () => {
    render(
      <GameCard
        game={{
          ...baseGame,
          status: "finished",
          is_free_mode: true,
          home_team_name: "レッドスターズ",
          visitor_team_name: "ブルーウェーブ",
        }}
        score={{ home: 5, visitor: 2 }}
      />
    );
    expect(screen.getByText("5 - 2")).toBeInTheDocument();
  });

  it("finished games do not show record/edit button", () => {
    render(
      <GameCard
        game={{
          ...baseGame,
          status: "finished",
        }}
        score={{ home: 5, visitor: 2 }}
      />
    );
    expect(screen.queryByText("記録")).not.toBeInTheDocument();
    expect(screen.queryByText("編集")).not.toBeInTheDocument();
    // Spectate button should still be visible
    expect(screen.getByText("観戦")).toBeInTheDocument();
  });

  it("does not show home/visitor label for free mode games", () => {
    render(
      <GameCard
        game={{
          ...baseGame,
          is_free_mode: true,
          home_team_name: "チームA",
          visitor_team_name: "チームB",
        }}
      />
    );
    expect(screen.queryByText(/ホーム/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ビジター/)).not.toBeInTheDocument();
  });
});
