import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { updateProfileAction } from './actions'
import { createClient } from '@/lib/supabase/server'

function makeMock({
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

beforeEach(() => {
  vi.clearAllMocks()
})

describe('updateProfileAction', () => {
  it('未ログインの場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeMock({ user: null }))
    const result = await updateProfileAction({ displayName: 'テスト' })
    expect(result).toEqual({ error: 'ログインが必要です' })
  })

  it('表示名が空白の場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeMock())
    const result = await updateProfileAction({ displayName: '   ' })
    expect(result).toEqual({ error: '表示名を入力してください' })
  })

  it('正常に更新できた場合 ok: true を返す', async () => {
    const mock = makeMock()
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock)
    const result = await updateProfileAction({ displayName: '新しい名前' })
    expect(result).toEqual({ ok: true })
    expect(mock.from).toHaveBeenCalledWith('profiles')
  })

  it('UPDATE エラーの場合エラーを返す', async () => {
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMock({ updateResult: { error: { message: 'update error' } } })
    )
    const result = await updateProfileAction({ displayName: 'テスト' })
    expect(result).toEqual({ error: 'プロフィールの更新に失敗しました' })
  })
})
