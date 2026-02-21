import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditTeamNameDialog } from './EditTeamNameDialog'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

const mockUpdateTeamNameAction = vi.fn()
vi.mock('@/app/(main)/team/actions', () => ({
  updateTeamNameAction: (...args: unknown[]) => mockUpdateTeamNameAction(...args),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('EditTeamNameDialog', () => {
  const defaultProps = { teamId: 'team-1', currentName: 'Tigers' }

  it('「編集」トリガーボタンを表示する', () => {
    render(<EditTeamNameDialog {...defaultProps} />)
    expect(screen.getByText('編集')).toBeInTheDocument()
  })

  it('ボタンをクリックするとダイアログが開く', async () => {
    render(<EditTeamNameDialog {...defaultProps} />)
    fireEvent.click(screen.getByText('編集'))
    await waitFor(() => {
      expect(screen.getByText('チーム名を変更')).toBeInTheDocument()
    })
  })

  it('ダイアログを開くと現在のチーム名がインプットに入っている', async () => {
    render(<EditTeamNameDialog {...defaultProps} />)
    fireEvent.click(screen.getByText('編集'))
    await waitFor(() => screen.getByLabelText('チーム名'))
    expect(screen.getByLabelText('チーム名')).toHaveValue('Tigers')
  })

  it('エラーが返ったときエラーメッセージを表示する', async () => {
    mockUpdateTeamNameAction.mockResolvedValue({ error: '更新に失敗しました' })

    render(<EditTeamNameDialog {...defaultProps} />)
    fireEvent.click(screen.getByText('編集'))
    await waitFor(() => screen.getByLabelText('チーム名'))
    fireEvent.change(screen.getByLabelText('チーム名'), { target: { value: 'NewName' } })
    fireEvent.click(screen.getByText('更新する'))

    await waitFor(() => {
      expect(screen.getByText('更新に失敗しました')).toBeInTheDocument()
    })
  })

  it('成功した場合ダイアログが閉じる', async () => {
    mockUpdateTeamNameAction.mockResolvedValue({ ok: true })

    render(<EditTeamNameDialog {...defaultProps} />)
    fireEvent.click(screen.getByText('編集'))
    await waitFor(() => screen.getByLabelText('チーム名'))
    fireEvent.change(screen.getByLabelText('チーム名'), { target: { value: 'NewName' } })
    fireEvent.click(screen.getByText('更新する'))

    await waitFor(() => {
      expect(screen.queryByText('チーム名を変更')).not.toBeInTheDocument()
    })
  })

  it('updateTeamNameAction を teamId と新しいチーム名で呼び出す', async () => {
    mockUpdateTeamNameAction.mockResolvedValue({ ok: true })

    render(<EditTeamNameDialog {...defaultProps} />)
    fireEvent.click(screen.getByText('編集'))
    await waitFor(() => screen.getByLabelText('チーム名'))
    fireEvent.change(screen.getByLabelText('チーム名'), { target: { value: 'Braves' } })
    fireEvent.click(screen.getByText('更新する'))

    await waitFor(() => {
      expect(mockUpdateTeamNameAction).toHaveBeenCalledWith('team-1', 'Braves')
    })
  })
})
