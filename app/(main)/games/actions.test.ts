import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createGameAction, createFreeGameAction, saveLineupAction, startGameAction, recordStealAction, substitutePlayerAction, changePositionAction, updateGameAction, updateFreeGameAction, deleteGameAction, undoLastAtBatAction, recordRunnerAdvanceAction, updateGameDhAction, finishGameAction } from './actions'
import { getPitchingStatsDelta } from './pitching-stats'
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
  gameSelectResult = { data: { status: 'scheduled' }, error: null } as { data: unknown; error: unknown },
  lineupCountResult = { count: 2, error: null } as { count: number | null; error: unknown },
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

  // For game status select
  const gameSelectSingle = vi.fn().mockResolvedValue(gameSelectResult)
  const gameSelectEq = vi.fn().mockReturnValue({ single: gameSelectSingle })
  const gameSelectFn = vi.fn().mockReturnValue({ eq: gameSelectEq })

  // For lineup count (startGameAction)
  const lineupCountEqFn = vi.fn().mockResolvedValue(lineupCountResult)
  const lineupCountSelectFn = vi.fn().mockReturnValue({ eq: lineupCountEqFn })

  const from = vi.fn((table: string) => {
    if (table === 'games') {
      return {
        insert: vi.fn().mockReturnValue(insertSelectChain),
        update: updateFn,
        select: gameSelectFn,
      }
    }
    if (table === 'lineups') {
      return {
        insert: vi.fn().mockReturnValue(lineupInsertChain),
        delete: deleteFn,
        select: lineupCountSelectFn,
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

// ─── getPitchingStatsDelta ──────────────────────────────────────────────────

describe('getPitchingStatsDelta', () => {
  it('単打: hits=1, outs=0', () => {
    const result = getPitchingStatsDelta('1B', [
      { lineupId: 'l1', event: 'stay', toBase: '1st' },
    ])
    expect(result).toEqual({
      outs: 0, hits: 1, runs: 0, earnedRuns: 0, walks: 0, strikeouts: 0,
    })
  })

  it('二塁打: hits=1', () => {
    const result = getPitchingStatsDelta('2B', [
      { lineupId: 'l1', event: 'stay', toBase: '2nd' },
    ])
    expect(result.hits).toBe(1)
  })

  it('三塁打: hits=1', () => {
    const result = getPitchingStatsDelta('3B', [
      { lineupId: 'l1', event: 'stay', toBase: '3rd' },
    ])
    expect(result.hits).toBe(1)
  })

  it('本塁打: hits=1, runs=1（打者生還）', () => {
    const result = getPitchingStatsDelta('HR', [
      { lineupId: 'l1', event: 'scored' },
    ])
    expect(result).toEqual({
      outs: 0, hits: 1, runs: 1, earnedRuns: 1, walks: 0, strikeouts: 0,
    })
  })

  it('満塁本塁打: hits=1, runs=4', () => {
    const result = getPitchingStatsDelta('HR', [
      { lineupId: 'r1', event: 'scored' },
      { lineupId: 'r2', event: 'scored' },
      { lineupId: 'r3', event: 'scored' },
      { lineupId: 'l1', event: 'scored' },
    ])
    expect(result).toEqual({
      outs: 0, hits: 1, runs: 4, earnedRuns: 4, walks: 0, strikeouts: 0,
    })
  })

  it('四球: walks=1', () => {
    const result = getPitchingStatsDelta('BB', [
      { lineupId: 'l1', event: 'stay', toBase: '1st' },
    ])
    expect(result).toEqual({
      outs: 0, hits: 0, runs: 0, earnedRuns: 0, walks: 1, strikeouts: 0,
    })
  })

  it('敬遠: walks=1', () => {
    const result = getPitchingStatsDelta('IBB', [
      { lineupId: 'l1', event: 'stay', toBase: '1st' },
    ])
    expect(result.walks).toBe(1)
  })

  it('死球: 全て0', () => {
    const result = getPitchingStatsDelta('HBP', [
      { lineupId: 'l1', event: 'stay', toBase: '1st' },
    ])
    expect(result).toEqual({
      outs: 0, hits: 0, runs: 0, earnedRuns: 0, walks: 0, strikeouts: 0,
    })
  })

  it('空振り三振: outs=1, strikeouts=1', () => {
    const result = getPitchingStatsDelta('K', [
      { lineupId: 'l1', event: 'out' },
    ])
    expect(result).toEqual({
      outs: 1, hits: 0, runs: 0, earnedRuns: 0, walks: 0, strikeouts: 1,
    })
  })

  it('見逃し三振: outs=1, strikeouts=1', () => {
    const result = getPitchingStatsDelta('KK', [
      { lineupId: 'l1', event: 'out' },
    ])
    expect(result).toEqual({
      outs: 1, hits: 0, runs: 0, earnedRuns: 0, walks: 0, strikeouts: 1,
    })
  })

  it('ゴロアウト: outs=1', () => {
    const result = getPitchingStatsDelta('GO', [
      { lineupId: 'l1', event: 'out' },
    ])
    expect(result).toEqual({
      outs: 1, hits: 0, runs: 0, earnedRuns: 0, walks: 0, strikeouts: 0,
    })
  })

  it('フライアウト: outs=1', () => {
    const result = getPitchingStatsDelta('FO', [
      { lineupId: 'l1', event: 'out' },
    ])
    expect(result.outs).toBe(1)
  })

  it('ライナーアウト: outs=1', () => {
    const result = getPitchingStatsDelta('LO', [
      { lineupId: 'l1', event: 'out' },
    ])
    expect(result.outs).toBe(1)
  })

  it('併殺打: outs=2（打者+走者）', () => {
    const result = getPitchingStatsDelta('DP', [
      { lineupId: 'l1', event: 'out' },
      { lineupId: 'r1', event: 'out' },
    ])
    expect(result).toEqual({
      outs: 2, hits: 0, runs: 0, earnedRuns: 0, walks: 0, strikeouts: 0,
    })
  })

  it('犠牲フライ: outs=1, runs=1', () => {
    const result = getPitchingStatsDelta('SF', [
      { lineupId: 'l1', event: 'out' },
      { lineupId: 'r1', event: 'scored' },
    ])
    expect(result).toEqual({
      outs: 1, hits: 0, runs: 1, earnedRuns: 1, walks: 0, strikeouts: 0,
    })
  })

  it('犠打: outs=1', () => {
    const result = getPitchingStatsDelta('SH', [
      { lineupId: 'l1', event: 'out' },
      { lineupId: 'r1', event: 'stay', toBase: '2nd' },
    ])
    expect(result.outs).toBe(1)
  })

  it('フィルダースチョイス: outs=1（走者アウト、打者セーフ）', () => {
    const result = getPitchingStatsDelta('FC', [
      { lineupId: 'l1', event: 'stay', toBase: '1st' },
      { lineupId: 'r1', event: 'out' },
    ])
    expect(result).toEqual({
      outs: 1, hits: 0, runs: 0, earnedRuns: 0, walks: 0, strikeouts: 0,
    })
  })

  it('エラー: 全て0（走者移動なし）', () => {
    const result = getPitchingStatsDelta('E', [
      { lineupId: 'l1', event: 'stay', toBase: '1st' },
    ])
    expect(result).toEqual({
      outs: 0, hits: 0, runs: 0, earnedRuns: 0, walks: 0, strikeouts: 0,
    })
  })

  it('ゴロアウトで走者が生還: outs=1, runs=1', () => {
    const result = getPitchingStatsDelta('GO', [
      { lineupId: 'l1', event: 'out' },
      { lineupId: 'r1', event: 'scored' },
    ])
    expect(result).toEqual({
      outs: 1, hits: 0, runs: 1, earnedRuns: 1, walks: 0, strikeouts: 0,
    })
  })
})

// ─── recordStealAction ──────────────────────────────────────────────────────

describe('recordStealAction', () => {
  function makeStealMockSupabase({
    user = { id: 'user-1' } as { id: string } | null,
    lastAtBat = { id: 'ab-1' } as { id: string } | null,
    lastAtBatError = null as unknown,
    insertResult = { error: null } as { error: unknown },
  } = {}) {
    const singleFn = vi.fn().mockResolvedValue({
      data: lastAtBat,
      error: lastAtBatError,
    })
    const limitFn = vi.fn().mockReturnValue({ single: singleFn })
    const orderFn = vi.fn().mockReturnValue({ limit: limitFn })
    const selectEqFn = vi.fn().mockReturnValue({ order: orderFn })
    const selectFn = vi.fn().mockReturnValue({ eq: selectEqFn })

    const insertFn = vi.fn().mockResolvedValue(insertResult)

    const from = vi.fn((table: string) => {
      if (table === 'at_bats') {
        return { select: selectFn }
      }
      if (table === 'runner_events') {
        return { insert: insertFn }
      }
      return {}
    })

    return {
      mock: {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user } }),
        },
        from,
      },
      insertFn,
    }
  }

  const baseInput = {
    gameId: 'game-1',
    lineupId: 'lineup-1',
    eventType: 'stolen_base' as const,
    fromBase: '1st' as const,
  }

  it('未ログインの場合エラーを返す', async () => {
    const { mock } = makeStealMockSupabase({ user: null })
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock)
    const result = await recordStealAction(baseInput)
    expect(result).toEqual({ error: 'ログインが必要です' })
  })

  it('打席がない場合エラーを返す', async () => {
    const { mock } = makeStealMockSupabase({ lastAtBat: null, lastAtBatError: { message: 'not found' } })
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock)
    const result = await recordStealAction(baseInput)
    expect(result).toEqual({ error: '打席が記録されていないため盗塁を記録できません' })
  })

  it('盗塁成功: runner_events に stolen_base を INSERT', async () => {
    const { mock, insertFn } = makeStealMockSupabase()
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock)
    const result = await recordStealAction(baseInput)
    expect(result).toEqual({ ok: true })
    expect(insertFn).toHaveBeenCalledWith({
      at_bat_id: 'ab-1',
      lineup_id: 'lineup-1',
      event_type: 'stolen_base',
    })
  })

  it('盗塁死: runner_events に caught_stealing を INSERT', async () => {
    const { mock, insertFn } = makeStealMockSupabase()
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock)
    const result = await recordStealAction({
      ...baseInput,
      eventType: 'caught_stealing',
    })
    expect(result).toEqual({ ok: true })
    expect(insertFn).toHaveBeenCalledWith({
      at_bat_id: 'ab-1',
      lineup_id: 'lineup-1',
      event_type: 'caught_stealing',
    })
  })

  it('ホームスチール成功: stolen_base + scored の2件を INSERT', async () => {
    const { mock, insertFn } = makeStealMockSupabase()
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock)
    const result = await recordStealAction({
      ...baseInput,
      fromBase: '3rd',
      eventType: 'stolen_base',
    })
    expect(result).toEqual({ ok: true })
    expect(insertFn).toHaveBeenCalledTimes(2)
    expect(insertFn).toHaveBeenCalledWith({
      at_bat_id: 'ab-1',
      lineup_id: 'lineup-1',
      event_type: 'stolen_base',
    })
    expect(insertFn).toHaveBeenCalledWith({
      at_bat_id: 'ab-1',
      lineup_id: 'lineup-1',
      event_type: 'scored',
    })
  })

  it('盗塁死（3塁）: caught_stealing のみ INSERT（scored は INSERT しない）', async () => {
    const { mock, insertFn } = makeStealMockSupabase()
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock)
    const result = await recordStealAction({
      ...baseInput,
      fromBase: '3rd',
      eventType: 'caught_stealing',
    })
    expect(result).toEqual({ ok: true })
    expect(insertFn).toHaveBeenCalledTimes(1)
    expect(insertFn).toHaveBeenCalledWith({
      at_bat_id: 'ab-1',
      lineup_id: 'lineup-1',
      event_type: 'caught_stealing',
    })
  })

  it('runner_events INSERT エラーの場合エラーを返す', async () => {
    const { mock } = makeStealMockSupabase({
      insertResult: { error: { message: 'insert error' } },
    })
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock)
    const result = await recordStealAction(baseInput)
    expect(result).toEqual({ error: '盗塁の記録に失敗しました' })
  })
})

// ─── substitutePlayerAction ──────────────────────────────────────────────────

describe('substitutePlayerAction', () => {
  const baseInput = {
    gameId: 'game-1',
    battingOrder: 3,
    teamSide: 'home' as const,
    newPlayerId: 'player-new',
    newPlayerName: '代打太郎',
    newPosition: '左',
    currentInning: 5,
    type: 'pinch_hitter' as const,
  }

  function makeSubMock({
    user = { id: 'user-1' } as { id: string } | null,
    gameStatus = 'in_progress',
    insertResult = { data: { id: 'new-lineup-1' }, error: null } as { data: unknown; error: unknown },
  } = {}) {
    // game status check: from('games').select('status').eq('id', gameId).single()
    const gameSingle = vi.fn().mockResolvedValue({ data: { status: gameStatus }, error: null })
    const gameEq = vi.fn().mockReturnValue({ single: gameSingle })
    const gameSelectFn = vi.fn().mockReturnValue({ eq: gameEq })

    // lineup insert: from('lineups').insert({...}).select('id').single()
    const single = vi.fn().mockResolvedValue(insertResult)
    const selectFn = vi.fn().mockReturnValue({ single })
    const insertFn = vi.fn().mockReturnValue({ select: selectFn })

    const from = vi.fn((table: string) => {
      if (table === 'games') return { select: gameSelectFn }
      if (table === 'lineups') return { insert: insertFn }
      return {}
    })

    return {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
      from,
    }
  }

  it('未ログインの場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeSubMock({ user: null }))
    const result = await substitutePlayerAction(baseInput)
    expect(result).toEqual({ error: 'ログインが必要です' })
  })

  it('選手名が空の場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeSubMock())
    const result = await substitutePlayerAction({ ...baseInput, newPlayerName: '  ' })
    expect(result).toEqual({ error: '交代選手の名前を入力してください' })
  })

  it('代打: lineups に新規レコードを INSERT する', async () => {
    const mock = makeSubMock()
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock)
    const result = await substitutePlayerAction(baseInput)
    expect(result).toEqual({ ok: true })
    expect(mock.from).toHaveBeenCalledWith('lineups')
  })

  it('試合が進行中でない場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeSubMock({ gameStatus: 'scheduled' }))
    const result = await substitutePlayerAction(baseInput)
    expect(result).toEqual({ error: '試合が進行中ではありません' })
  })

  it('代走: lineups INSERT + runners_after を更新する', async () => {
    // game status check
    const gameSingle = vi.fn().mockResolvedValue({ data: { status: 'in_progress' }, error: null })
    const gameEq = vi.fn().mockReturnValue({ single: gameSingle })
    const gameSelectFn = vi.fn().mockReturnValue({ eq: gameEq })

    const updateEqFn = vi.fn().mockResolvedValue({ error: null })
    const updateFn = vi.fn().mockReturnValue({ eq: updateEqFn })

    const atBatSingle = vi.fn().mockResolvedValue({
      data: { id: 'ab-1', runners_after: [{ base: '1st', lineup_id: 'old-lineup' }] },
      error: null,
    })
    const atBatLimit = vi.fn().mockReturnValue({ single: atBatSingle })
    const atBatOrder = vi.fn().mockReturnValue({ limit: atBatLimit })
    const atBatEq = vi.fn().mockReturnValue({ order: atBatOrder })
    const atBatSelect = vi.fn().mockReturnValue({ eq: atBatEq })

    const lineupSingle = vi.fn().mockResolvedValue({ data: { id: 'new-lineup-1' }, error: null })
    const lineupSelectFn = vi.fn().mockReturnValue({ single: lineupSingle })
    const lineupInsertFn = vi.fn().mockReturnValue({ select: lineupSelectFn })

    const from = vi.fn((table: string) => {
      if (table === 'games') return { select: gameSelectFn }
      if (table === 'lineups') return { insert: lineupInsertFn }
      if (table === 'at_bats') return { select: atBatSelect, update: updateFn }
      return {}
    })

    const mock = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from,
    }
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock)

    const result = await substitutePlayerAction({
      ...baseInput,
      type: 'pinch_runner',
      replacedLineupId: 'old-lineup',
    })
    expect(result).toEqual({ ok: true })
    // Verify at_bats update was called
    expect(updateFn).toHaveBeenCalled()
  })

  it('INSERT エラーの場合エラーを返す', async () => {
    const mock = makeSubMock({
      insertResult: { data: null, error: { message: 'insert error' } },
    })
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock)
    const result = await substitutePlayerAction(baseInput)
    expect(result).toEqual({ error: '選手交代に失敗しました' })
  })
})

// ─── changePositionAction ────────────────────────────────────────────────────

describe('changePositionAction', () => {
  function makePosChangeMock({
    user = { id: 'user-1' } as { id: string } | null,
    gameStatus = 'in_progress',
    lineupVerifyResult = { data: [{ id: 'l-1' }, { id: 'l-2' }], error: null } as { data: unknown; error: unknown },
    updateResult = { error: null } as { error: unknown },
  } = {}) {
    // game status check: from('games').select('status').eq('id', gameId).single()
    const gameSingle = vi.fn().mockResolvedValue({ data: { status: gameStatus }, error: null })
    const gameEq = vi.fn().mockReturnValue({ single: gameSingle })
    const gameSelectFn = vi.fn().mockReturnValue({ eq: gameEq })

    // lineup ownership check: from('lineups').select('id').eq('game_id',...).in('id',...)
    const lineupInFn = vi.fn().mockResolvedValue(lineupVerifyResult)
    const lineupEqFn = vi.fn().mockReturnValue({ in: lineupInFn })
    const lineupSelectFn = vi.fn().mockReturnValue({ eq: lineupEqFn })

    // lineup update: from('lineups').update({position}).eq('id', lineupId)
    const updateEqFn = vi.fn().mockResolvedValue(updateResult)
    const updateFn = vi.fn().mockReturnValue({ eq: updateEqFn })

    const from = vi.fn((table: string) => {
      if (table === 'games') return { select: gameSelectFn }
      if (table === 'lineups') return { select: lineupSelectFn, update: updateFn }
      return {}
    })

    return {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
      from,
    }
  }

  it('未ログインの場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makePosChangeMock({ user: null }))
    const result = await changePositionAction({ gameId: 'game-1', changes: [{ lineupId: 'l-1', newPosition: '一' }] })
    expect(result).toEqual({ error: 'ログインが必要です' })
  })

  it('変更が空の場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makePosChangeMock())
    const result = await changePositionAction({ gameId: 'game-1', changes: [] })
    expect(result).toEqual({ error: '変更する守備位置を選択してください' })
  })

  it('試合が進行中でない場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makePosChangeMock({ gameStatus: 'scheduled' }))
    const result = await changePositionAction({
      gameId: 'game-1',
      changes: [{ lineupId: 'l-1', newPosition: '一' }],
    })
    expect(result).toEqual({ error: '試合が進行中ではありません' })
  })

  it('不正なラインナップIDが含まれる場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makePosChangeMock({ lineupVerifyResult: { data: [{ id: 'l-1' }], error: null } })
    )
    const result = await changePositionAction({
      gameId: 'game-1',
      changes: [
        { lineupId: 'l-1', newPosition: '一' },
        { lineupId: 'l-invalid', newPosition: '二' },
      ],
    })
    expect(result).toEqual({ error: '不正なラインナップIDが含まれています' })
  })

  it('守備位置を更新する', async () => {
    const mock = makePosChangeMock()
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock)
    const result = await changePositionAction({
      gameId: 'game-1',
      changes: [
        { lineupId: 'l-1', newPosition: '一' },
        { lineupId: 'l-2', newPosition: '二' },
      ],
    })
    expect(result).toEqual({ ok: true })
    expect(mock.from).toHaveBeenCalledWith('lineups')
  })

  it('UPDATE エラーの場合エラーを返す', async () => {
    const mock = makePosChangeMock({
      lineupVerifyResult: { data: [{ id: 'l-1' }], error: null },
      updateResult: { error: { message: 'update error' } },
    })
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock)
    const result = await changePositionAction({
      gameId: 'game-1',
      changes: [{ lineupId: 'l-1', newPosition: '一' }],
    })
    expect(result).toEqual({ error: '守備変更に失敗しました' })
  })
})

// ─── updateGameAction ─────────────────────────────────────────────────────────

describe('updateGameAction', () => {
  const baseInput = {
    gameId: 'game-1',
    opponentName: '新しい相手',
    gameDate: '2026-03-01',
    location: '新球場',
    isHome: false,
    innings: 7,
    useDh: true,
  }

  function makeUpdateGameMock({
    user = { id: 'user-1' } as { id: string } | null,
    selectResult = { data: { status: 'scheduled' }, error: null } as { data: unknown; error: unknown },
    updateResult = { error: null } as { error: unknown },
  } = {}) {
    const selectSingle = vi.fn().mockResolvedValue(selectResult)
    const selectEq = vi.fn().mockReturnValue({ single: selectSingle })
    const selectFn = vi.fn().mockReturnValue({ eq: selectEq })

    const updateEqFn = vi.fn().mockResolvedValue(updateResult)
    const updateFn = vi.fn().mockReturnValue({ eq: updateEqFn })

    const from = vi.fn(() => ({
      select: selectFn,
      update: updateFn,
    }))

    return {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
      from,
    }
  }

  it('未ログインの場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeUpdateGameMock({ user: null }))
    const result = await updateGameAction(baseInput)
    expect(result).toEqual({ error: 'ログインが必要です' })
  })

  it('相手チーム名が空白の場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeUpdateGameMock())
    const result = await updateGameAction({ ...baseInput, opponentName: '  ' })
    expect(result).toEqual({ error: '相手チーム名を入力してください' })
  })

  it('試合日が空の場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeUpdateGameMock())
    const result = await updateGameAction({ ...baseInput, gameDate: '' })
    expect(result).toEqual({ error: '試合日を入力してください' })
  })

  it('scheduled 以外の試合はエラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeUpdateGameMock({ selectResult: { data: { status: 'in_progress' }, error: null } })
    )
    const result = await updateGameAction(baseInput)
    expect(result).toEqual({ error: '試合前の試合のみ編集できます' })
  })

  it('正常に更新できた場合 ok: true を返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeUpdateGameMock())
    const result = await updateGameAction(baseInput)
    expect(result).toEqual({ ok: true })
  })

  it('UPDATE エラーの場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeUpdateGameMock({ updateResult: { error: { message: 'update error' } } })
    )
    const result = await updateGameAction(baseInput)
    expect(result).toEqual({ error: '試合の更新に失敗しました' })
  })
})

// ─── deleteGameAction ─────────────────────────────────────────────────────────

describe('deleteGameAction', () => {
  function makeDeleteGameMock({
    user = { id: 'user-1' } as { id: string } | null,
    selectResult = { data: { status: 'scheduled' }, error: null } as { data: unknown; error: unknown },
    deleteResult = { error: null } as { error: unknown },
  } = {}) {
    const selectSingle = vi.fn().mockResolvedValue(selectResult)
    const selectEq = vi.fn().mockReturnValue({ single: selectSingle })
    const selectFn = vi.fn().mockReturnValue({ eq: selectEq })

    const deleteEqFn = vi.fn().mockResolvedValue(deleteResult)
    const deleteFn = vi.fn().mockReturnValue({ eq: deleteEqFn })

    const from = vi.fn(() => ({
      select: selectFn,
      delete: deleteFn,
    }))

    return {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
      from,
    }
  }

  it('未ログインの場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeDeleteGameMock({ user: null }))
    const result = await deleteGameAction('game-1')
    expect(result).toEqual({ error: 'ログインが必要です' })
  })

  it('scheduled 以外の試合はエラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeDeleteGameMock({ selectResult: { data: { status: 'finished' }, error: null } })
    )
    const result = await deleteGameAction('game-1')
    expect(result).toEqual({ error: '試合前の試合のみ削除できます' })
  })

  it('正常に削除できた場合 ok: true を返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeDeleteGameMock())
    const result = await deleteGameAction('game-1')
    expect(result).toEqual({ ok: true })
  })

  it('DELETE エラーの場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeDeleteGameMock({ deleteResult: { error: { message: 'delete error' } } })
    )
    const result = await deleteGameAction('game-1')
    expect(result).toEqual({ error: '試合の削除に失敗しました' })
  })
})

// ─── undoLastAtBatAction ──────────────────────────────────────────────────────

describe('undoLastAtBatAction', () => {
  function makeUndoMock({
    user = { id: 'user-1' } as { id: string } | null,
    gameStatus = 'in_progress',
    lastAtBat = { id: 'ab-1', inning: 3, inning_half: 'top', batting_order: 4, lineup_id: 'lineup-1', result: '1B' } as {
      id: string; inning: number; inning_half: string; batting_order: number; lineup_id: string; result: string | null
    } | null,
    runnerEvents = [] as { lineup_id: string; event_type: string }[],
    deleteResult = { error: null } as { error: unknown },
    pitcherRecords = [{ id: 'pr-1', lineup_id: 'pitcher-1', outs_recorded: 3, hits: 2, runs: 1, earned_runs: 1, walks: 0, strikeouts: 1 }] as unknown[],
  } = {}) {
    // game select
    const gameSingle = vi.fn().mockResolvedValue({ data: { status: gameStatus }, error: null })
    const gameEq = vi.fn().mockReturnValue({ single: gameSingle })
    const gameSelectFn = vi.fn().mockReturnValue({ eq: gameEq })

    // at_bats select (latest)
    const abSingle = vi.fn().mockResolvedValue({ data: lastAtBat, error: lastAtBat ? null : { message: 'not found' } })
    const abLimit = vi.fn().mockReturnValue({ single: abSingle })
    const abOrder = vi.fn().mockReturnValue({ limit: abLimit })
    const abEq = vi.fn().mockReturnValue({ order: abOrder })
    const abSelectFn = vi.fn().mockReturnValue({ eq: abEq })

    // runner_events select
    const reEq = vi.fn().mockResolvedValue({ data: runnerEvents, error: null })
    const reSelectFn = vi.fn().mockReturnValue({ eq: reEq })

    // delete
    const deleteEqFn = vi.fn().mockResolvedValue(deleteResult)
    const deleteFn = vi.fn().mockReturnValue({ eq: deleteEqFn })

    // pitching_records select + update
    const prIsNull = vi.fn().mockResolvedValue({ data: pitcherRecords, error: null })
    const prEq = vi.fn().mockReturnValue({ is: prIsNull })
    const prSelectFn = vi.fn().mockReturnValue({ eq: prEq })

    const prUpdateEq = vi.fn().mockResolvedValue({ error: null })
    const prUpdateFn = vi.fn().mockReturnValue({ eq: prUpdateEq })

    // lineups select (for fielding team)
    const luEq2 = vi.fn().mockResolvedValue({ data: [{ id: 'pitcher-1' }], error: null })
    const luEq = vi.fn().mockReturnValue({ eq: luEq2 })
    const luSelectFn = vi.fn().mockReturnValue({ eq: luEq })

    const from = vi.fn((table: string) => {
      if (table === 'games') return { select: gameSelectFn }
      if (table === 'at_bats') return { select: abSelectFn, delete: deleteFn }
      if (table === 'runner_events') return { select: reSelectFn }
      if (table === 'pitching_records') return { select: prSelectFn, update: prUpdateFn }
      if (table === 'lineups') return { select: luSelectFn }
      return {}
    })

    return {
      mock: {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
        from,
      },
      deleteFn,
    }
  }

  it('未ログインの場合エラーを返す', async () => {
    const { mock } = makeUndoMock({ user: null })
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock)
    const result = await undoLastAtBatAction('game-1')
    expect(result).toEqual({ error: 'ログインが必要です' })
  })

  it('試合が進行中でない場合エラーを返す', async () => {
    const { mock } = makeUndoMock({ gameStatus: 'scheduled' })
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock)
    const result = await undoLastAtBatAction('game-1')
    expect(result).toEqual({ error: '試合が進行中ではありません' })
  })

  it('打席がない場合エラーを返す', async () => {
    const { mock } = makeUndoMock({ lastAtBat: null })
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock)
    const result = await undoLastAtBatAction('game-1')
    expect(result).toEqual({ error: '取り消す打席がありません' })
  })

  it('正常に取り消せた場合 ok + undone 情報を返す', async () => {
    const { mock } = makeUndoMock()
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock)
    const result = await undoLastAtBatAction('game-1')
    expect(result).toEqual({
      ok: true,
      undone: { inning: 3, inningHalf: 'top', battingOrder: 4, result: '1B' },
    })
  })

  it('DELETE エラーの場合エラーを返す', async () => {
    const { mock } = makeUndoMock({ deleteResult: { error: { message: 'delete error' } } })
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock)
    const result = await undoLastAtBatAction('game-1')
    expect(result).toEqual({ error: '打席の取り消しに失敗しました' })
  })
})

// ─── recordRunnerAdvanceAction ────────────────────────────────────────────────

describe('recordRunnerAdvanceAction', () => {
  function makeAdvanceMock({
    user = { id: 'user-1' } as { id: string } | null,
    gameStatus = 'in_progress',
    lastAtBat = { id: 'ab-1', runners_after: [{ base: '1st', lineup_id: 'lineup-r1' }] } as {
      id: string; runners_after: unknown
    } | null,
    insertResult = { error: null } as { error: unknown },
    updateResult = { error: null } as { error: unknown },
  } = {}) {
    // game select
    const gameSingle = vi.fn().mockResolvedValue({ data: { status: gameStatus }, error: null })
    const gameEq = vi.fn().mockReturnValue({ single: gameSingle })
    const gameSelectFn = vi.fn().mockReturnValue({ eq: gameEq })

    // at_bats select (latest)
    const abSingle = vi.fn().mockResolvedValue({ data: lastAtBat, error: lastAtBat ? null : { message: 'not found' } })
    const abLimit = vi.fn().mockReturnValue({ single: abSingle })
    const abOrder = vi.fn().mockReturnValue({ limit: abLimit })
    const abEq = vi.fn().mockReturnValue({ order: abOrder })
    const abSelectFn = vi.fn().mockReturnValue({ eq: abEq })

    // at_bats update
    const abUpdateEq = vi.fn().mockResolvedValue(updateResult)
    const abUpdateFn = vi.fn().mockReturnValue({ eq: abUpdateEq })

    const insertFn = vi.fn().mockResolvedValue(insertResult)

    const from = vi.fn((table: string) => {
      if (table === 'games') return { select: gameSelectFn }
      if (table === 'at_bats') return { select: abSelectFn, update: abUpdateFn }
      if (table === 'runner_events') return { insert: insertFn }
      return {}
    })

    return {
      mock: {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
        from,
      },
      insertFn,
    }
  }

  const baseInput = {
    gameId: 'game-1',
    eventType: 'wild_pitch' as const,
    advances: [{ lineupId: 'lineup-r1', fromBase: '1st' as const, toBase: '2nd' as const }],
  }

  it('未ログインの場合エラーを返す', async () => {
    const { mock } = makeAdvanceMock({ user: null })
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock)
    const result = await recordRunnerAdvanceAction(baseInput)
    expect(result).toEqual({ error: 'ログインが必要です' })
  })

  it('試合が進行中でない場合エラーを返す', async () => {
    const { mock } = makeAdvanceMock({ gameStatus: 'finished' })
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock)
    const result = await recordRunnerAdvanceAction(baseInput)
    expect(result).toEqual({ error: '試合が進行中ではありません' })
  })

  it('打席がない場合エラーを返す', async () => {
    const { mock } = makeAdvanceMock({ lastAtBat: null })
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock)
    const result = await recordRunnerAdvanceAction(baseInput)
    expect(result).toEqual({ error: '打席が記録されていないためイベントを記録できません' })
  })

  it('WP: runner_events に wild_pitch を INSERT', async () => {
    const { mock, insertFn } = makeAdvanceMock()
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock)
    const result = await recordRunnerAdvanceAction(baseInput)
    expect(result).toEqual({ ok: true })
    expect(insertFn).toHaveBeenCalledWith({
      at_bat_id: 'ab-1',
      lineup_id: 'lineup-r1',
      event_type: 'wild_pitch',
    })
  })

  it('ホーム進塁: event + scored の2件を INSERT', async () => {
    const { mock, insertFn } = makeAdvanceMock()
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock)
    const result = await recordRunnerAdvanceAction({
      gameId: 'game-1',
      eventType: 'passed_ball',
      advances: [{ lineupId: 'lineup-r1', fromBase: '3rd', toBase: 'home' }],
    })
    expect(result).toEqual({ ok: true })
    expect(insertFn).toHaveBeenCalledTimes(2)
    expect(insertFn).toHaveBeenCalledWith({
      at_bat_id: 'ab-1',
      lineup_id: 'lineup-r1',
      event_type: 'passed_ball',
    })
    expect(insertFn).toHaveBeenCalledWith({
      at_bat_id: 'ab-1',
      lineup_id: 'lineup-r1',
      event_type: 'scored',
    })
  })

  it('INSERT エラーの場合エラーを返す', async () => {
    const { mock } = makeAdvanceMock({ insertResult: { error: { message: 'insert error' } } })
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock)
    const result = await recordRunnerAdvanceAction(baseInput)
    expect(result).toEqual({ error: '走者進塁の記録に失敗しました' })
  })
})

// ─── createFreeGameAction ─────────────────────────────────────────────────────

describe('createFreeGameAction', () => {
  it('未ログインの場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockSupabase({ user: null })
    )
    const result = await createFreeGameAction({
      homeTeamName: 'ホームチーム',
      visitorTeamName: 'ビジターチーム',
      gameDate: '2026-03-01',
      location: '',
      innings: 7,
      useDh: false,
    })
    expect(result).toEqual({ error: 'ログインが必要です' })
  })

  it('ホームチーム名が空の場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockSupabase()
    )
    const result = await createFreeGameAction({
      homeTeamName: '',
      visitorTeamName: 'ビジターチーム',
      gameDate: '2026-03-01',
      location: '',
      innings: 7,
      useDh: false,
    })
    expect(result).toEqual({ error: 'ホームチーム名を入力してください' })
  })

  it('ビジターチーム名が空の場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockSupabase()
    )
    const result = await createFreeGameAction({
      homeTeamName: 'ホームチーム',
      visitorTeamName: '',
      gameDate: '2026-03-01',
      location: '',
      innings: 7,
      useDh: false,
    })
    expect(result).toEqual({ error: 'ビジターチーム名を入力してください' })
  })

  it('DB エラーが発生した場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockSupabase({
        insertResult: { data: null, error: { message: 'db error' } },
      })
    )
    const result = await createFreeGameAction({
      homeTeamName: 'ホームチーム',
      visitorTeamName: 'ビジターチーム',
      gameDate: '2026-03-01',
      location: '',
      innings: 7,
      useDh: false,
    })
    expect(result).toEqual({ error: '試合の作成に失敗しました' })
  })

  it('正常に作成された場合 gameId を返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockSupabase({
        insertResult: { data: { id: 'free-game-1' }, error: null },
      })
    )
    const result = await createFreeGameAction({
      homeTeamName: 'ホームチーム',
      visitorTeamName: 'ビジターチーム',
      gameDate: '2026-03-01',
      location: '球場',
      innings: 7,
      useDh: false,
    })
    expect(result).toEqual({ gameId: 'free-game-1' })
  })
})

// ─── updateFreeGameAction ─────────────────────────────────────────────────────

describe('updateFreeGameAction', () => {
  it('未ログインの場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockSupabase({ user: null })
    )
    const result = await updateFreeGameAction({
      gameId: 'game-1',
      homeTeamName: 'ホーム',
      visitorTeamName: 'ビジター',
      gameDate: '2026-03-01',
      location: '',
      innings: 7,
      useDh: false,
    })
    expect(result).toEqual({ error: 'ログインが必要です' })
  })

  it('フリーモードでない試合の場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockSupabase({
        gameSelectResult: { data: { status: 'scheduled', is_free_mode: false }, error: null },
      })
    )
    const result = await updateFreeGameAction({
      gameId: 'game-1',
      homeTeamName: 'ホーム',
      visitorTeamName: 'ビジター',
      gameDate: '2026-03-01',
      location: '',
      innings: 7,
      useDh: false,
    })
    expect(result).toEqual({ error: 'フリーモードの試合ではありません' })
  })

  it('試合中の試合は編集できない', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockSupabase({
        gameSelectResult: { data: { status: 'in_progress', is_free_mode: true }, error: null },
      })
    )
    const result = await updateFreeGameAction({
      gameId: 'game-1',
      homeTeamName: 'ホーム',
      visitorTeamName: 'ビジター',
      gameDate: '2026-03-01',
      location: '',
      innings: 7,
      useDh: false,
    })
    expect(result).toEqual({ error: '試合前の試合のみ編集できます' })
  })

  it('正常に更新された場合 ok を返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockSupabase({
        gameSelectResult: { data: { status: 'scheduled', is_free_mode: true }, error: null },
      })
    )
    const result = await updateFreeGameAction({
      gameId: 'game-1',
      homeTeamName: 'ホーム変更後',
      visitorTeamName: 'ビジター変更後',
      gameDate: '2026-03-01',
      location: '球場',
      innings: 7,
      useDh: false,
    })
    expect(result).toEqual({ ok: true })
  })
})

// ─── updateGameDhAction ──────────────────────────────────────────────────────

describe('updateGameDhAction', () => {
  function makeDhMock({
    user = { id: 'user-1' } as { id: string } | null,
    gameSelectResult = { data: { status: 'scheduled' }, error: null } as { data: unknown; error: unknown },
    updateResult = { error: null } as { error: unknown },
  } = {}) {
    // game status check: from('games').select('status').eq('id', gameId).single()
    const gameSingle = vi.fn().mockResolvedValue(gameSelectResult)
    const gameEq = vi.fn().mockReturnValue({ single: gameSingle })
    const gameSelectFn = vi.fn().mockReturnValue({ eq: gameEq })

    // game update: from('games').update({use_dh}).eq('id', gameId)
    const updateEqFn = vi.fn().mockResolvedValue(updateResult)
    const updateFn = vi.fn().mockReturnValue({ eq: updateEqFn })

    const from = vi.fn(() => ({
      select: gameSelectFn,
      update: updateFn,
    }))

    return {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
      from,
    }
  }

  it('未ログインの場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeDhMock({ user: null }))
    const result = await updateGameDhAction('game-1', true)
    expect(result).toEqual({ error: 'ログインが必要です' })
  })

  it('試合が見つからない場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeDhMock({ gameSelectResult: { data: null, error: null } })
    )
    const result = await updateGameDhAction('game-1', true)
    expect(result).toEqual({ error: '試合が見つかりません' })
  })

  it('scheduled 以外の試合はエラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeDhMock({ gameSelectResult: { data: { status: 'in_progress' }, error: null } })
    )
    const result = await updateGameDhAction('game-1', true)
    expect(result).toEqual({ error: '試合前の試合のみDH制を変更できます' })
  })

  it('UPDATE エラーの場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeDhMock({ updateResult: { error: { message: 'update error' } } })
    )
    const result = await updateGameDhAction('game-1', true)
    expect(result).toEqual({ error: 'DH制の変更に失敗しました' })
  })

  it('正常に変更できた場合 ok: true を返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeDhMock())
    const result = await updateGameDhAction('game-1', true)
    expect(result).toEqual({ ok: true })
  })
})

// ─── finishGameAction ────────────────────────────────────────────────────────

describe('finishGameAction', () => {
  function makeFinishMock({
    user = { id: 'user-1' } as { id: string } | null,
    rpcResult = { error: null } as { error: unknown },
  } = {}) {
    return {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
      from: vi.fn(),
      rpc: vi.fn().mockResolvedValue(rpcResult),
    }
  }

  it('未ログインの場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeFinishMock({ user: null }))
    const result = await finishGameAction('game-1')
    expect(result).toEqual({ error: 'ログインが必要です' })
  })

  it('RPC エラー（not in progress）の場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeFinishMock({ rpcResult: { error: { message: 'Game is not in progress' } } })
    )
    const result = await finishGameAction('game-1')
    expect(result).toEqual({ error: '試合が進行中ではありません' })
  })

  it('RPC エラー（その他）の場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeFinishMock({ rpcResult: { error: { message: 'some other error' } } })
    )
    const result = await finishGameAction('game-1')
    expect(result).toEqual({ error: '試合の終了に失敗しました' })
  })

  it('正常に終了できた場合 ok: true を返す', async () => {
    const mock = makeFinishMock()
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock)
    const result = await finishGameAction('game-1')
    expect(result).toEqual({ ok: true })
    expect(mock.rpc).toHaveBeenCalledWith('finish_game', { p_game_id: 'game-1' })
  })

  it('試合IDが空の場合エラーを返す', async () => {
    const result = await finishGameAction('')
    expect(result).toEqual({ error: '試合IDが不正です' })
  })
})
