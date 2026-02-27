import { describe, it, expect, vi, beforeEach } from 'vitest'

// next/cache と supabase/server をモック
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createTeamAction, joinTeamAction, updateTeamNameAction, ensureDefaultTeam } from './actions'
import { createClient } from '@/lib/supabase/server'

// Supabase クライアントのモックビルダー
function makeMockSupabase({
  user = { id: 'user-1' } as { id: string } | null,
  insertResult = { data: { id: 'team-1' }, error: null },
  rpcResult = { data: 'team-1', error: null },
  updateResult = { error: null },
  profileDefaultTeamId = null as string | null,
} = {}) {
  const single = vi.fn()
  const selectChain = { single }
  const insertChain = { select: vi.fn().mockReturnValue(selectChain) }
  const updateEqFn = vi.fn().mockResolvedValue(updateResult)
  const updateChain = { eq: updateEqFn }

  single.mockResolvedValue(insertResult)

  const rpc = vi.fn().mockResolvedValue(rpcResult)

  // profiles テーブル用モック
  const profileUpdateEqFn = vi.fn().mockResolvedValue({ error: null })
  const profileSelectSingle = vi.fn().mockResolvedValue({
    data: { default_team_id: profileDefaultTeamId },
    error: null,
  })
  const profileSelectEqFn = vi.fn().mockReturnValue({ single: profileSelectSingle })
  const profileSelectFn = vi.fn().mockReturnValue({ eq: profileSelectEqFn })

  const from = vi.fn((table: string) => {
    if (table === 'teams') {
      return {
        insert: vi.fn().mockReturnValue(insertChain),
        update: vi.fn().mockReturnValue(updateChain),
      }
    }
    if (table === 'profiles') {
      return {
        select: profileSelectFn,
        update: vi.fn().mockReturnValue({ eq: profileUpdateEqFn }),
      }
    }
    return {}
  })

  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({}),
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    from,
    rpc,
    _profileUpdateEqFn: profileUpdateEqFn,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── createTeamAction ────────────────────────────────────────────────────────

describe('createTeamAction', () => {
  it('未ログインの場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockSupabase({ user: null })
    )
    const result = await createTeamAction('Tigers')
    expect(result).toEqual({ error: 'ログインが必要です' })
  })

  it('チーム名が空白の場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockSupabase()
    )
    const result = await createTeamAction('   ')
    expect(result).toEqual({ error: 'チーム名を入力してください' })
  })

  it('DB エラーが発生した場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockSupabase({ insertResult: { data: null, error: { message: 'db error' } } })
    )
    const result = await createTeamAction('Tigers')
    expect(result).toEqual({ error: 'チームの作成に失敗しました' })
  })

  it('正常に作成された場合 teamId を返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockSupabase({ insertResult: { data: { id: 'new-team' }, error: null } })
    )
    const result = await createTeamAction('Tigers')
    expect(result).toEqual({ teamId: 'new-team' })
  })

  it('チーム名の前後の空白をトリムして保存する', async () => {
    const mock = makeMockSupabase({ insertResult: { data: { id: 'team-x' }, error: null } })
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock)
    await createTeamAction('  Braves  ')
    // from() が最初に呼ばれたときの返り値の insert を確認する
    const fromMock = mock.from as ReturnType<typeof vi.fn>
    const teamsReturnValue = fromMock.mock.results[0].value
    expect(teamsReturnValue.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Braves' })
    )
  })
})

// ─── joinTeamAction ──────────────────────────────────────────────────────────

describe('joinTeamAction', () => {
  it('未ログインの場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockSupabase({ user: null })
    )
    const result = await joinTeamAction('ABCD1234')
    expect(result).toEqual({ error: 'ログインが必要です' })
  })

  it('招待コードが空白の場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockSupabase()
    )
    const result = await joinTeamAction('   ')
    expect(result).toEqual({ error: '招待コードを入力してください' })
  })

  it('招待コードが見つからない場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockSupabase({ rpcResult: { data: null, error: { message: 'team_not_found' } } })
    )
    const result = await joinTeamAction('INVALID')
    expect(result).toEqual({ error: '招待コードが見つかりません' })
  })

  it('すでにメンバーの場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockSupabase({ rpcResult: { data: null, error: { message: 'already_member' } } })
    )
    const result = await joinTeamAction('ABCD1234')
    expect(result).toEqual({ error: 'すでにこのチームのメンバーです' })
  })

  it('その他の参加エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockSupabase({ rpcResult: { data: null, error: { message: 'unexpected error' } } })
    )
    const result = await joinTeamAction('ABCD1234')
    expect(result).toEqual({ error: '参加に失敗しました' })
  })

  it('正常に参加できた場合 ok: true を返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockSupabase()
    )
    const result = await joinTeamAction('ABCD1234')
    expect(result).toEqual({ ok: true })
  })
})

// ─── ensureDefaultTeam ───────────────────────────────────────────────────────

describe('ensureDefaultTeam', () => {
  it('default_team_id が null の場合、指定チームをデフォルトに設定する', async () => {
    const mock = makeMockSupabase({ profileDefaultTeamId: null })
    await ensureDefaultTeam(mock as never, 'user-1', 'team-new')
    // profiles.update が呼ばれたことを確認
    expect(mock._profileUpdateEqFn).toHaveBeenCalled()
  })

  it('default_team_id が既に設定されている場合、更新しない', async () => {
    const mock = makeMockSupabase({ profileDefaultTeamId: 'team-existing' })
    await ensureDefaultTeam(mock as never, 'user-1', 'team-new')
    // profiles の update は呼ばれない（from('profiles') は select のみ）
    // from が 1 回だけ呼ばれる（select のみ、update は呼ばれない）
    const profilesCalls = (mock.from as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: string[]) => c[0] === 'profiles'
    )
    expect(profilesCalls).toHaveLength(1) // select のみ
  })
})

// ─── updateTeamNameAction ────────────────────────────────────────────────────

describe('updateTeamNameAction', () => {
  it('未ログインの場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockSupabase({ user: null })
    )
    const result = await updateTeamNameAction('team-1', 'New Name')
    expect(result).toEqual({ error: 'ログインが必要です' })
  })

  it('チーム名が空白の場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockSupabase()
    )
    const result = await updateTeamNameAction('team-1', '   ')
    expect(result).toEqual({ error: 'チーム名を入力してください' })
  })

  it('DB エラーが発生した場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockSupabase({ updateResult: { error: { message: 'db error' } } })
    )
    const result = await updateTeamNameAction('team-1', 'New Name')
    expect(result).toEqual({ error: '更新に失敗しました' })
  })

  it('正常に更新できた場合 ok: true を返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockSupabase()
    )
    const result = await updateTeamNameAction('team-1', 'New Name')
    expect(result).toEqual({ ok: true })
  })
})
