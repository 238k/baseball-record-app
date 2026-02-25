import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TodayGameCard } from "./TodayGameCard";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
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
  it("renders '入力中' badge and 'オーダー入力' button for scheduled games without lineup", () => {
    render(<TodayGameCard game={{ ...baseGame, status: "scheduled" }} hasLineup={false} />);

    expect(screen.getByText("入力中")).toBeInTheDocument();
    expect(screen.getByText("オーダー入力")).toBeInTheDocument();

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/games/game-1/lineup");
  });

  it("renders '準備完了' badge and '観戦する' button for scheduled games with lineup", () => {
    render(<TodayGameCard game={{ ...baseGame, status: "scheduled" }} hasLineup={true} />);

    expect(screen.getByText("準備完了")).toBeInTheDocument();
    expect(screen.getByText("観戦する")).toBeInTheDocument();

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/games/game-1");
  });

  it("renders LIVE badge and '観戦する' button for in_progress games", () => {
    render(
      <TodayGameCard
        game={{ ...baseGame, status: "in_progress" }}
        score={{ home: 3, visitor: 1 }}
      />
    );

    expect(screen.getByText("LIVE")).toBeInTheDocument();
    expect(screen.getByText("観戦する")).toBeInTheDocument();
    expect(screen.getByText("3 - 1")).toBeInTheDocument();

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/games/game-1");
  });

  it("renders '試合結果' button for finished games", () => {
    render(
      <TodayGameCard
        game={{ ...baseGame, status: "finished" }}
        score={{ home: 5, visitor: 2 }}
      />
    );

    expect(screen.getByText("試合結果")).toBeInTheDocument();
    expect(screen.getByText("5 - 2")).toBeInTheDocument();

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/games/game-1");
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
});
