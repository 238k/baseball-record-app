import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GameDetailClient } from "./GameDetailClient";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock useRealtimeGame
const mockReload = vi.fn();
const defaultState = {
  game: null as ReturnType<typeof makeGameInfo> | null,
  myTeamName: "テストチーム",
  lineups: [],
  currentInning: 1,
  currentHalf: "top" as const,
  currentOuts: 0,
  currentBatterOrder: 1,
  baseRunners: { first: null, second: null, third: null },
  score: { home: 0, visitor: 0 },
  loading: false,
  error: null,
  inningScores: [],
  inputHolder: null,
  recentAtBats: [],
  currentPitchLog: [],
  reload: mockReload,
};

let mockState = { ...defaultState };

vi.mock("@/hooks/useRealtimeGame", () => ({
  useRealtimeGame: () => mockState,
}));

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [] }),
        }),
      }),
    }),
  }),
}));

function makeGameInfo(status: string) {
  return {
    id: "game-1",
    team_id: "team-1",
    opponent_name: "対戦相手",
    is_home: true,
    status,
    innings: 9,
    use_dh: false,
    game_date: "2026-02-25",
    location: "テスト球場",
  };
}

const baseProps = {
  gameId: "game-1",
  teamName: "テストチーム",
  opponentName: "対戦相手",
  isHome: true,
  innings: 9,
  useDh: false,
  gameDate: "2026-02-25",
  location: "テスト球場",
  initialStatus: "in_progress",
};

describe("GameDetailClient", () => {
  beforeEach(() => {
    mockState = { ...defaultState };
    mockReload.mockClear();
  });

  it("shows loading spinner when loading", () => {
    mockState = { ...defaultState, loading: true };
    render(<GameDetailClient {...baseProps} />);
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeTruthy();
  });

  it("shows error message on error", () => {
    mockState = { ...defaultState, error: "テストエラー" };
    render(<GameDetailClient {...baseProps} />);
    expect(screen.getByText("テストエラー")).toBeInTheDocument();
  });

  it("renders in_progress view with LIVE badge and record button", () => {
    mockState = {
      ...defaultState,
      game: makeGameInfo("in_progress"),
      score: { home: 3, visitor: 1 },
    };
    render(<GameDetailClient {...baseProps} initialStatus="in_progress" />);

    expect(screen.getByText("LIVE")).toBeInTheDocument();
    expect(screen.getByText("記録を入力する")).toBeInTheDocument();
    const recordLink = screen.getByText("記録を入力する").closest("a");
    expect(recordLink).toHaveAttribute("href", "/games/game-1/input");
  });

  it("renders finished view with all tabs including stats", () => {
    mockState = {
      ...defaultState,
      game: makeGameInfo("finished"),
    };
    render(<GameDetailClient {...baseProps} initialStatus="finished" />);

    expect(screen.getByText("速報")).toBeInTheDocument();
    expect(screen.getByText("オーダー")).toBeInTheDocument();
    expect(screen.getByText("打者成績")).toBeInTheDocument();
    expect(screen.getByText("投手成績")).toBeInTheDocument();
  });

  it("shows game metadata", () => {
    mockState = {
      ...defaultState,
      game: makeGameInfo("in_progress"),
    };
    render(<GameDetailClient {...baseProps} />);

    expect(screen.getByText(/2026-02-25/)).toBeInTheDocument();
    expect(screen.getByText(/ホーム/)).toBeInTheDocument();
    expect(screen.getByText(/9回制/)).toBeInTheDocument();
    expect(screen.getByText("テスト球場")).toBeInTheDocument();
  });

  it("renders same UI for scheduled games (scoreboard, field, record button)", () => {
    mockState = {
      ...defaultState,
      game: makeGameInfo("scheduled"),
    };
    render(<GameDetailClient {...baseProps} initialStatus="scheduled" />);

    expect(screen.getByText("記録を入力する")).toBeInTheDocument();
    expect(screen.getByText("直近の記録")).toBeInTheDocument();
  });

  it("does not show stats tabs for scheduled games", () => {
    mockState = {
      ...defaultState,
      game: makeGameInfo("scheduled"),
    };
    render(<GameDetailClient {...baseProps} initialStatus="scheduled" />);

    expect(screen.getByText("速報")).toBeInTheDocument();
    expect(screen.getByText("オーダー")).toBeInTheDocument();
    expect(screen.queryByText("打者成績")).not.toBeInTheDocument();
    expect(screen.queryByText("投手成績")).not.toBeInTheDocument();
  });

  it("shows live tab as default with live content visible", () => {
    mockState = {
      ...defaultState,
      game: makeGameInfo("in_progress"),
    };
    render(<GameDetailClient {...baseProps} />);

    // 速報 tab is default — live content is visible
    expect(screen.getByText("速報")).toBeInTheDocument();
    expect(screen.getByText("直近の記録")).toBeInTheDocument();

    // オーダー tab trigger exists
    const lineupTab = screen.getByText("オーダー");
    expect(lineupTab).toBeInTheDocument();
    expect(lineupTab.getAttribute("data-state")).toBe("inactive");
  });
});
