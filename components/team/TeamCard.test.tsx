import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TeamCard } from './TeamCard'

// next/link をシンプルな <a> タグにモック
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

describe('TeamCard', () => {
  const adminTeam = { id: 'team-1', name: 'Tigers', role: 'admin' }
  const memberTeam = { id: 'team-2', name: 'Giants', role: 'member' }

  it('チーム名を表示する', () => {
    render(<TeamCard team={adminTeam} />)
    expect(screen.getByText('Tigers')).toBeInTheDocument()
  })

  it('管理者ロールの場合「管理者」バッジを表示する', () => {
    render(<TeamCard team={adminTeam} />)
    expect(screen.getByText('管理者')).toBeInTheDocument()
  })

  it('メンバーロールの場合「メンバー」バッジを表示する', () => {
    render(<TeamCard team={memberTeam} />)
    expect(screen.getByText('メンバー')).toBeInTheDocument()
  })

  it('「チームを管理」ボタンへのリンクが正しいパスを持つ', () => {
    render(<TeamCard team={adminTeam} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/team/team-1')
  })

  it('「チームを管理」テキストを表示する', () => {
    render(<TeamCard team={adminTeam} />)
    expect(screen.getByText('チームを管理')).toBeInTheDocument()
  })
})
