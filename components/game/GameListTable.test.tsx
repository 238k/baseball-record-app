import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GameListTable } from "./GameListTable";

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

describe("GameListTable", () => {
  it("renders table headers", () => {
    render(
      <GameListTable games={[]} scoreMap={{}} lineupSet={new Set()} />
    );
    expect(screen.getByText("日付")).toBeInTheDocument();
    expect(screen.getByText("対戦")).toBeInTheDocument();
    expect(screen.getByText("スコア")).toBeInTheDocument();
    expect(screen.getByText("状態")).toBeInTheDocument();
    expect(screen.getByText("操作")).toBeInTheDocument();
  });

  it("renders game date and opponent name", () => {
    render(
      <GameListTable
        games={[baseGame]}
        scoreMap={{}}
        lineupSet={new Set()}
      />
    );
    expect(screen.getByText("2026-02-25")).toBeInTheDocument();
    expect(screen.getByText("vs テストタイガース")).toBeInTheDocument();
    expect(screen.getByText("ホーム")).toBeInTheDocument();
  });

  it("shows free mode badge and team names for free mode games", () => {
    render(
      <GameListTable
        games={[{
          ...baseGame,
          is_free_mode: true,
          home_team_name: "レッドスターズ",
          visitor_team_name: "ブルーウェーブ",
        }]}
        scoreMap={{}}
        lineupSet={new Set()}
      />
    );
    expect(screen.getByText("フリー")).toBeInTheDocument();
    expect(screen.getByText("レッドスターズ vs ブルーウェーブ")).toBeInTheDocument();
  });

  it("shows score for finished games", () => {
    render(
      <GameListTable
        games={[{ ...baseGame, status: "finished" }]}
        scoreMap={{ "game-1": { home: 5, visitor: 2 } }}
        lineupSet={new Set()}
      />
    );
    expect(screen.getByText("5 - 2")).toBeInTheDocument();
    expect(screen.getByText("試合終了")).toBeInTheDocument();
  });

  it("shows dash when no score available", () => {
    render(
      <GameListTable
        games={[baseGame]}
        scoreMap={{}}
        lineupSet={new Set()}
      />
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows LIVE badge for in_progress games", () => {
    render(
      <GameListTable
        games={[{ ...baseGame, status: "in_progress" }]}
        scoreMap={{}}
        lineupSet={new Set()}
      />
    );
    expect(screen.getByText("LIVE")).toBeInTheDocument();
    expect(screen.getByText("記録")).toBeInTheDocument();
  });

  it("shows 準備完了 badge when lineup exists", () => {
    render(
      <GameListTable
        games={[baseGame]}
        scoreMap={{}}
        lineupSet={new Set(["game-1"])}
      />
    );
    expect(screen.getByText("準備完了")).toBeInTheDocument();
  });

  it("shows 編集 button for scheduled games", () => {
    render(
      <GameListTable
        games={[baseGame]}
        scoreMap={{}}
        lineupSet={new Set()}
      />
    );
    expect(screen.getByText("編集")).toBeInTheDocument();
  });

  it("finished games do not show record/edit button", () => {
    render(
      <GameListTable
        games={[{ ...baseGame, status: "finished" }]}
        scoreMap={{ "game-1": { home: 3, visitor: 1 } }}
        lineupSet={new Set()}
      />
    );
    expect(screen.queryByText("記録")).not.toBeInTheDocument();
    expect(screen.queryByText("編集")).not.toBeInTheDocument();
    expect(screen.getByText("詳細")).toBeInTheDocument();
  });

  it("disables detail button for scheduled games without lineup", () => {
    render(
      <GameListTable
        games={[baseGame]}
        scoreMap={{}}
        lineupSet={new Set()}
      />
    );
    const detailButton = screen.getByText("詳細").closest("button");
    expect(detailButton).toBeDisabled();
  });

  it("renders multiple games in rows", () => {
    const games = [
      { ...baseGame, id: "game-1", game_date: "2026-03-01" },
      { ...baseGame, id: "game-2", game_date: "2026-02-28", status: "finished" },
    ];
    render(
      <GameListTable
        games={games}
        scoreMap={{ "game-2": { home: 4, visitor: 3 } }}
        lineupSet={new Set()}
      />
    );
    expect(screen.getByText("2026-03-01")).toBeInTheDocument();
    expect(screen.getByText("2026-02-28")).toBeInTheDocument();
    expect(screen.getByText("4 - 3")).toBeInTheDocument();
  });
});
