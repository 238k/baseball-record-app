import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { JoinTeamDialog } from './JoinTeamDialog'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

const mockJoinTeamAction = vi.fn()
vi.mock('@/app/(main)/team/actions', () => ({
  joinTeamAction: (...args: unknown[]) => mockJoinTeamAction(...args),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('JoinTeamDialog', () => {
  it('「チームに参加」トリガーボタンを表示する', () => {
    render(<JoinTeamDialog />)
    expect(screen.getByText('チームに参加')).toBeInTheDocument()
  })

  it('ボタンをクリックするとダイアログが開く', async () => {
    render(<JoinTeamDialog />)
    fireEvent.click(screen.getByText('チームに参加'))
    await waitFor(() => {
      expect(screen.getByText('招待コードでチームに参加')).toBeInTheDocument()
    })
  })

  it('エラーが返ったときエラーメッセージを表示する', async () => {
    mockJoinTeamAction.mockResolvedValue({ error: '招待コードが見つかりません' })

    render(<JoinTeamDialog />)
    fireEvent.click(screen.getByText('チームに参加'))

    await waitFor(() => screen.getByLabelText('招待コード'))
    fireEvent.change(screen.getByLabelText('招待コード'), {
      target: { value: 'BADCODE1' },
    })
    fireEvent.click(screen.getByText('参加する'))

    await waitFor(() => {
      expect(screen.getByText('招待コードが見つかりません')).toBeInTheDocument()
    })
  })

  it('成功した場合ダイアログが閉じる', async () => {
    mockJoinTeamAction.mockResolvedValue({ ok: true })

    render(<JoinTeamDialog />)
    fireEvent.click(screen.getByText('チームに参加'))

    await waitFor(() => screen.getByLabelText('招待コード'))
    fireEvent.change(screen.getByLabelText('招待コード'), {
      target: { value: 'ABCD1234' },
    })
    fireEvent.click(screen.getByText('参加する'))

    await waitFor(() => {
      expect(screen.queryByText('招待コードでチームに参加')).not.toBeInTheDocument()
    })
  })

  it('joinTeamAction を入力した招待コードで呼び出す', async () => {
    mockJoinTeamAction.mockResolvedValue({ ok: true })

    render(<JoinTeamDialog />)
    fireEvent.click(screen.getByText('チームに参加'))

    await waitFor(() => screen.getByLabelText('招待コード'))
    fireEvent.change(screen.getByLabelText('招待コード'), {
      target: { value: 'MYCODE12' },
    })
    fireEvent.click(screen.getByText('参加する'))

    await waitFor(() => {
      expect(mockJoinTeamAction).toHaveBeenCalledWith('MYCODE12')
    })
  })
})
