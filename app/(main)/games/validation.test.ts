import { describe, it, expect } from 'vitest'
import { createFreeGameSchema, updateFreeGameSchema } from './validation'

describe('createFreeGameSchema', () => {
  const valid = {
    homeTeamName: 'ホームチーム',
    visitorTeamName: 'ビジターチーム',
    gameDate: '2026-03-01',
    location: '',
    innings: 7,
    useDh: false,
  }

  it('有効な入力を受け付ける', () => {
    expect(createFreeGameSchema.safeParse(valid).success).toBe(true)
  })

  it('ホームチーム名が空の場合エラー', () => {
    const result = createFreeGameSchema.safeParse({ ...valid, homeTeamName: '' })
    expect(result.success).toBe(false)
  })

  it('ビジターチーム名が空の場合エラー', () => {
    const result = createFreeGameSchema.safeParse({ ...valid, visitorTeamName: '' })
    expect(result.success).toBe(false)
  })

  it('試合日が空の場合エラー', () => {
    const result = createFreeGameSchema.safeParse({ ...valid, gameDate: '' })
    expect(result.success).toBe(false)
  })

  it('イニング数が0の場合エラー', () => {
    const result = createFreeGameSchema.safeParse({ ...valid, innings: 0 })
    expect(result.success).toBe(false)
  })

  it('イニング数が31の場合エラー', () => {
    const result = createFreeGameSchema.safeParse({ ...valid, innings: 31 })
    expect(result.success).toBe(false)
  })
})

describe('updateFreeGameSchema', () => {
  const valid = {
    gameId: 'game-1',
    homeTeamName: 'ホームチーム',
    visitorTeamName: 'ビジターチーム',
    gameDate: '2026-03-01',
    location: '',
    innings: 7,
    useDh: false,
  }

  it('有効な入力を受け付ける', () => {
    expect(updateFreeGameSchema.safeParse(valid).success).toBe(true)
  })

  it('gameId が空の場合エラー', () => {
    const result = updateFreeGameSchema.safeParse({ ...valid, gameId: '' })
    expect(result.success).toBe(false)
  })

  it('ホームチーム名が空の場合エラー', () => {
    const result = updateFreeGameSchema.safeParse({ ...valid, homeTeamName: '' })
    expect(result.success).toBe(false)
  })

  it('ビジターチーム名が空の場合エラー', () => {
    const result = updateFreeGameSchema.safeParse({ ...valid, visitorTeamName: '' })
    expect(result.success).toBe(false)
  })
})
