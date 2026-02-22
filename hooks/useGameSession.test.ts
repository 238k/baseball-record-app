import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useGameSession } from "./useGameSession";

// ---- Mock Supabase client ----

const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
};

const mockRemoveChannel = vi.fn();

type QueryResult = {
  data: unknown;
  error: null;
};

// Chainable mock for supabase queries
function createChainMock(result: QueryResult = { data: null, error: null }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    single: vi.fn().mockResolvedValue(result),
    then: vi.fn((cb: (v: QueryResult) => void) => {
      cb(result);
      return Promise.resolve();
    }),
  };
  return chain;
}

let sessionChain: ReturnType<typeof createChainMock>;
let requestChain: ReturnType<typeof createChainMock>;
let profileChain: ReturnType<typeof createChainMock>;

const mockFrom = vi.fn((table: string) => {
  if (table === "game_input_sessions") return sessionChain;
  if (table === "game_input_requests") return requestChain;
  if (table === "profiles") return profileChain;
  return createChainMock();
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: mockFrom,
    channel: () => mockChannel,
    removeChannel: mockRemoveChannel,
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
      }),
    },
  }),
}));

describe("useGameSession", () => {
  beforeEach(() => {
    sessionChain = createChainMock({ data: null, error: null });
    requestChain = createChainMock({ data: [], error: null });
    profileChain = createChainMock({
      data: { id: "user-2", display_name: "田中" },
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("セッションなしの場合、自分のセッションを作成する", async () => {
    // No existing session → maybeSingle returns null
    sessionChain.maybeSingle.mockResolvedValue({ data: null, error: null });
    // Insert succeeds
    sessionChain.single.mockResolvedValue({
      data: { id: "session-1" },
      error: null,
    });

    const { result } = renderHook(() =>
      useGameSession("game-1", "user-1")
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isMySession).toBe(true);
    expect(sessionChain.insert).toHaveBeenCalledWith({
      game_id: "game-1",
      profile_id: "user-1",
    });
  });

  it("自分のセッションがある場合、isMySession=true になる", async () => {
    sessionChain.maybeSingle.mockResolvedValue({
      data: {
        id: "session-1",
        game_id: "game-1",
        profile_id: "user-1",
        last_active_at: new Date().toISOString(),
      },
      error: null,
    });
    // No pending requests
    requestChain.limit = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    const { result } = renderHook(() =>
      useGameSession("game-1", "user-1")
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isMySession).toBe(true);
  });

  it("他者のセッションの場合、isMySession=false で currentHolder が設定される", async () => {
    sessionChain.maybeSingle.mockResolvedValue({
      data: {
        id: "session-1",
        game_id: "game-1",
        profile_id: "user-2",
        last_active_at: new Date().toISOString(),
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useGameSession("game-1", "user-1")
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isMySession).toBe(false);
    expect(result.current.currentHolder?.display_name).toBe("田中");
  });

  it("requestSession が game_input_requests に insert する", async () => {
    sessionChain.maybeSingle.mockResolvedValue({
      data: {
        id: "session-1",
        game_id: "game-1",
        profile_id: "user-2",
        last_active_at: new Date().toISOString(),
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useGameSession("game-1", "user-1")
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.requestSession();
    });

    expect(requestChain.insert).toHaveBeenCalledWith({
      game_id: "game-1",
      requester_id: "user-1",
      status: "pending",
    });
  });

  it("releaseSession がセッションを削除する", async () => {
    // Other user's session so isMySession stays false (no heartbeat interference)
    sessionChain.maybeSingle.mockResolvedValue({
      data: {
        id: "session-1",
        game_id: "game-1",
        profile_id: "user-2",
        last_active_at: new Date().toISOString(),
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useGameSession("game-1", "user-1")
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isMySession).toBe(false);

    // Now call releaseSession (which deletes any session for this user)
    sessionChain.delete.mockClear();
    await act(async () => {
      await result.current.releaseSession();
    });

    expect(sessionChain.delete).toHaveBeenCalled();
  });

  it("userId が null の場合は loading のまま何もしない", async () => {
    const { result } = renderHook(() =>
      useGameSession("game-1", null)
    );

    // Should remain loading since userId is null
    expect(result.current.loading).toBe(true);
    expect(result.current.isMySession).toBe(false);
  });

  it("Realtime チャネルを subscribe して unmount 時に remove する", async () => {
    sessionChain.maybeSingle.mockResolvedValue({ data: null, error: null });
    sessionChain.single.mockResolvedValue({
      data: { id: "session-1" },
      error: null,
    });

    const { unmount } = renderHook(() =>
      useGameSession("game-1", "user-1")
    );

    // Channel should be subscribed
    expect(mockChannel.on).toHaveBeenCalled();
    expect(mockChannel.subscribe).toHaveBeenCalled();

    unmount();

    expect(mockRemoveChannel).toHaveBeenCalled();
  });
});
