import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createGameAction, saveLineupAction, startGameAction, recordStealAction, substitutePlayerAction, changePositionAction } from './actions'
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
    insertResult = { data: { id: 'new-lineup-1' }, error: null } as { data: unknown; error: unknown },
  } = {}) {
    const single = vi.fn().mockResolvedValue(insertResult)
    const selectFn = vi.fn().mockReturnValue({ single })
    const insertFn = vi.fn().mockReturnValue({ select: selectFn })

    const from = vi.fn(() => ({
      insert: insertFn,
    }))

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

  it('代走: lineups INSERT + runners_after を更新する', async () => {
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
    updateResult = { error: null } as { error: unknown },
  } = {}) {
    const updateEqFn = vi.fn().mockResolvedValue(updateResult)
    const updateFn = vi.fn().mockReturnValue({ eq: updateEqFn })

    const from = vi.fn(() => ({
      update: updateFn,
    }))

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
    const mock = makePosChangeMock({ updateResult: { error: { message: 'update error' } } })
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock)
    const result = await changePositionAction({
      gameId: 'game-1',
      changes: [{ lineupId: 'l-1', newPosition: '一' }],
    })
    expect(result).toEqual({ error: '守備変更に失敗しました' })
  })
})
