import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createGameAction, saveLineupAction, startGameAction } from './actions'
import { createClient } from '@/lib/supabase/server'

// ─── Mock helpers ────────────────────────────────────────────────────────────

function makeMockSupabase({
  user = { id: 'user-1' } as { id: string } | null,
  insertResult = { data: { id: 'game-1' }, error: null } as {
    data: unknown
    error: unknown
  },
  deleteResult = { error: null } as { error: unknown },
  updateResult = { error: null } as { error: unknown },
  lineupInsertResult = {
    data: [
      { id: 'lineup-h1', team_side: 'home', batting_order: 1 },
      { id: 'lineup-v1', team_side: 'visitor', batting_order: 1 },
    ],
    error: null,
  } as { data: unknown; error: unknown },
  pitchingInsertResult = { error: null } as { error: unknown },
} = {}) {
  const single = vi.fn().mockResolvedValue(insertResult)
  const selectChain = { single }
  const insertSelectChain = { select: vi.fn().mockReturnValue(selectChain) }

  // For lineup inserts that return data with .select()
  const lineupInsertSelectChain = vi
    .fn()
    .mockResolvedValue(lineupInsertResult)
  const lineupInsertChain = {
    select: lineupInsertSelectChain,
  }

  // For pitching_records inserts (no select)
  const pitchingInsertFn = vi.fn().mockResolvedValue(pitchingInsertResult)

  // For delete chains
  const deleteEqFn = vi.fn().mockResolvedValue(deleteResult)
  const deleteFn = vi.fn().mockReturnValue({ eq: deleteEqFn })

  // For update chains
  const updateEqFn = vi.fn().mockResolvedValue(updateResult)
  const updateFn = vi.fn().mockReturnValue({ eq: updateEqFn })

  const from = vi.fn((table: string) => {
    if (table === 'games') {
      return {
        insert: vi.fn().mockReturnValue(insertSelectChain),
        update: updateFn,
      }
    }
    if (table === 'lineups') {
      return {
        insert: vi.fn().mockReturnValue(lineupInsertChain),
        delete: deleteFn,
      }
    }
    if (table === 'pitching_records') {
      return {
        insert: pitchingInsertFn,
        delete: deleteFn,
      }
    }
    return {}
  })

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    from,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── createGameAction ────────────────────────────────────────────────────────

describe('createGameAction', () => {
  it('未ログインの場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockSupabase({ user: null })
    )
    const result = await createGameAction({
      teamId: 'team-1',
      opponentName: '相手チーム',
      gameDate: '2026-02-21',
      location: '',
      isHome: true,
      innings: 9,
      useDh: false,
    })
    expect(result).toEqual({ error: 'ログインが必要です' })
  })

  it('相手チーム名が空白の場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockSupabase()
    )
    const result = await createGameAction({
      teamId: 'team-1',
      opponentName: '   ',
      gameDate: '2026-02-21',
      location: '',
      isHome: true,
      innings: 9,
      useDh: false,
    })
    expect(result).toEqual({ error: '相手チーム名を入力してください' })
  })

  it('試合日が空の場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockSupabase()
    )
    const result = await createGameAction({
      teamId: 'team-1',
      opponentName: '相手チーム',
      gameDate: '',
      location: '',
      isHome: true,
      innings: 9,
      useDh: false,
    })
    expect(result).toEqual({ error: '試合日を入力してください' })
  })

  it('DB エラーが発生した場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockSupabase({
        insertResult: { data: null, error: { message: 'db error' } },
      })
    )
    const result = await createGameAction({
      teamId: 'team-1',
      opponentName: '相手チーム',
      gameDate: '2026-02-21',
      location: '',
      isHome: true,
      innings: 9,
      useDh: false,
    })
    expect(result).toEqual({ error: '試合の作成に失敗しました' })
  })

  it('正常に作成された場合 gameId を返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockSupabase({
        insertResult: { data: { id: 'new-game' }, error: null },
      })
    )
    const result = await createGameAction({
      teamId: 'team-1',
      opponentName: '相手チーム',
      gameDate: '2026-02-21',
      location: '○○球場',
      isHome: true,
      innings: 7,
      useDh: false,
    })
    expect(result).toEqual({ gameId: 'new-game' })
  })
})

// ─── saveLineupAction ────────────────────────────────────────────────────────

describe('saveLineupAction', () => {
  const baseInput = {
    gameId: 'game-1',
    homeLineup: [
      {
        battingOrder: 1,
        playerId: 'p-1',
        playerName: '山田太郎',
        position: '投',
      },
    ],
    visitorLineup: [
      {
        battingOrder: 1,
        playerId: null,
        playerName: '相手選手1',
        position: '投',
      },
    ],
    homePitcherOrder: 1,
    visitorPitcherOrder: 1,
  }

  it('未ログインの場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockSupabase({ user: null })
    )
    const result = await saveLineupAction(baseInput)
    expect(result).toEqual({ error: 'ログインが必要です' })
  })

  it('lineup の insert エラーの場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockSupabase({
        lineupInsertResult: {
          data: null,
          error: { message: 'insert error' },
        },
      })
    )
    const result = await saveLineupAction(baseInput)
    expect(result).toEqual({ error: 'オーダーの保存に失敗しました: insert error' })
  })

  it('正常に保存された場合 ok: true を返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockSupabase()
    )
    const result = await saveLineupAction(baseInput)
    expect(result).toEqual({ ok: true })
  })
})

// ─── startGameAction ─────────────────────────────────────────────────────────

describe('startGameAction', () => {
  it('未ログインの場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockSupabase({ user: null })
    )
    const result = await startGameAction('game-1')
    expect(result).toEqual({ error: 'ログインが必要です' })
  })

  it('DB エラーが発生した場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockSupabase({
        updateResult: { error: { message: 'update error' } },
      })
    )
    const result = await startGameAction('game-1')
    expect(result).toEqual({ error: '試合の開始に失敗しました' })
  })

  it('正常に開始できた場合 ok: true を返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockSupabase()
    )
    const result = await startGameAction('game-1')
    expect(result).toEqual({ ok: true })
  })
})
