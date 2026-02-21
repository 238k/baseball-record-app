import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('単一のクラスをそのまま返す', () => {
    expect(cn('foo')).toBe('foo')
  })

  it('複数のクラスをスペース区切りで結合する', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('falsyな値を無視する', () => {
    expect(cn('foo', undefined, null, false, 'bar')).toBe('foo bar')
  })

  it('条件付きクラスを正しく処理する', () => {
    expect(cn({ active: true, hidden: false })).toBe('active')
  })

  it('Tailwindの競合クラスを後勝ちでマージする', () => {
    expect(cn('p-4', 'p-8')).toBe('p-8')
  })

  it('Tailwindのtext-colorの競合を解決する', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('引数なしで空文字を返す', () => {
    expect(cn()).toBe('')
  })
})
