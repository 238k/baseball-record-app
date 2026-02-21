import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemberList } from './MemberList'

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
      delete: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
    })),
  })),
}))

const members = [
  {
    id: 'member-1',
    role: 'admin',
    profiles: { id: 'user-1', display_name: '山田太郎' },
  },
  {
    id: 'member-2',
    role: 'member',
    profiles: { id: 'user-2', display_name: '鈴木次郎' },
  },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MemberList', () => {
  it('全メンバーの表示名を表示する', () => {
    render(
      <MemberList
        members={members}
        currentUserId="user-1"
        isAdmin={false}
        teamId="team-1"
        onChanged={vi.fn()}
      />
    )
    expect(screen.getByText('山田太郎')).toBeInTheDocument()
    expect(screen.getByText('鈴木次郎')).toBeInTheDocument()
  })

  it('現在のユーザーに「あなた」バッジを表示する', () => {
    render(
      <MemberList
        members={members}
        currentUserId="user-1"
        isAdmin={false}
        teamId="team-1"
        onChanged={vi.fn()}
      />
    )
    expect(screen.getByText('あなた')).toBeInTheDocument()
  })

  it('管理者ロールのメンバーに「管理者」バッジを表示する', () => {
    render(
      <MemberList
        members={members}
        currentUserId="user-1"
        isAdmin={false}
        teamId="team-1"
        onChanged={vi.fn()}
      />
    )
    expect(screen.getByText('管理者')).toBeInTheDocument()
    expect(screen.getByText('メンバー')).toBeInTheDocument()
  })

  it('isAdmin=true かつ自分以外のメンバーには操作ボタンが表示される', () => {
    render(
      <MemberList
        members={members}
        currentUserId="user-1"
        isAdmin={true}
        teamId="team-1"
        onChanged={vi.fn()}
      />
    )
    // 鈴木次郎はメンバーなので昇格ボタンが表示される
    expect(screen.getByTitle('管理者に昇格')).toBeInTheDocument()
    expect(screen.getByTitle('チームから削除')).toBeInTheDocument()
  })

  it('isAdmin=false の場合は操作ボタンが表示されない', () => {
    render(
      <MemberList
        members={members}
        currentUserId="user-1"
        isAdmin={false}
        teamId="team-1"
        onChanged={vi.fn()}
      />
    )
    expect(screen.queryByTitle('管理者に昇格')).not.toBeInTheDocument()
    expect(screen.queryByTitle('チームから削除')).not.toBeInTheDocument()
  })

  it('自分自身には操作ボタンが表示されない（管理者でも）', () => {
    render(
      <MemberList
        members={[
          { id: 'member-1', role: 'admin', profiles: { id: 'user-1', display_name: '山田太郎' } },
        ]}
        currentUserId="user-1"
        isAdmin={true}
        teamId="team-1"
        onChanged={vi.fn()}
      />
    )
    expect(screen.queryByTitle('チームから削除')).not.toBeInTheDocument()
  })
})
