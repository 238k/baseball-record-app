import { describe, it, expect, vi, beforeEach } from 'vitest'

// next/cache と supabase/server をモック
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createTeamAction, joinTeamAction, updateTeamNameAction } from './actions'
import { createClient } from '@/lib/supabase/server'

// Supabase クライアントのモックビルダー
function makeMockSupabase({
  user = { id: 'user-1' } as { id: string } | null,
  insertResult = { data: { id: 'team-1' }, error: null },
  rpcResult = { data: 'team-1', error: null },
  updateResult = { error: null },
} = {}) {
  const single = vi.fn()
  const selectChain = { single }
  const insertChain = { select: vi.fn().mockReturnValue(selectChain) }
  const updateEqFn = vi.fn().mockResolvedValue(updateResult)
  const updateChain = { eq: updateEqFn }

  single.mockResolvedValue(insertResult)

  const rpc = vi.fn().mockResolvedValue(rpcResult)

  const from = vi.fn((table: string) => {
    if (table === 'teams') {
      return {
        insert: vi.fn().mockReturnValue(insertChain),
        update: vi.fn().mockReturnValue(updateChain),
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
