import { describe, it, expect } from 'vitest'
import { dayOfYear, quoteForDate, todayQuote, type Quote } from './quote'
import quotesData from '../data/quotes.json'

describe('dayOfYear', () => {
  it('1月1日 = 1', () => {
    expect(dayOfYear(new Date(2026, 0, 1))).toBe(1)
  })
  it('非闰年12月31日 = 365', () => {
    expect(dayOfYear(new Date(2026, 11, 31))).toBe(365)
  })
  it('闰年12月31日 = 366', () => {
    expect(dayOfYear(new Date(2024, 11, 31))).toBe(366)
  })
})

describe('quoteForDate', () => {
  const quotes: Quote[] = [{ text: 'a', author: 'A' }, { text: 'b', author: 'B' }, { text: 'c', author: 'C' }]

  it('按 dayOfYear 取模轮换', () => {
    expect(quoteForDate(new Date(2026, 0, 1), quotes)).toEqual(quotes[1 % 3])
    expect(quoteForDate(new Date(2026, 0, 4), quotes)).toEqual(quotes[4 % 3])
  })

  it('同一天固定返回同一句', () => {
    const d = new Date(2026, 6, 9)
    expect(quoteForDate(d, quotes)).toEqual(quoteForDate(new Date(d), quotes))
  })

  it('quotes 为空抛错', () => {
    expect(() => quoteForDate(new Date(), [])).toThrow()
  })
})

describe('todayQuote / quotes.json', () => {
  it('quotes.json 至少 90 条', () => {
    expect((quotesData as Quote[]).length).toBeGreaterThanOrEqual(90)
  })

  it('每条含非空 text 和 author', () => {
    for (const q of quotesData as Quote[]) {
      expect(typeof q.text).toBe('string')
      expect(q.text.length).toBeGreaterThan(0)
      expect(typeof q.author).toBe('string')
      expect(q.author.length).toBeGreaterThan(0)
    }
  })

  it('返回 quotes.json 中的一条，且随日期确定', () => {
    const q = todayQuote(new Date(2026, 6, 9))
    expect(quotesData as Quote[]).toContainEqual(q)
    expect(todayQuote(new Date(2026, 6, 9))).toEqual(q)
  })
})
