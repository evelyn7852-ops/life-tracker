import { describe, it, expect } from 'vitest'
import { monthMatrix, isSameMonth, isSameDay } from './calendarGrid'

describe('monthMatrix 月历网格（周日起始，固定 6 周）', () => {
  it('2026年7月（1日为周三）→ 首格为 6月28日（周日）', () => {
    const weeks = monthMatrix(2026, 6) // month: 0-indexed，6 = 七月
    expect(weeks.length).toBe(6)
    weeks.forEach((w) => expect(w.length).toBe(7))
    const first = weeks[0][0]
    expect(first.getFullYear()).toBe(2026)
    expect(first.getMonth()).toBe(5)
    expect(first.getDate()).toBe(28)
    expect(first.getDay()).toBe(0)
  })

  it('末格为 8月8日', () => {
    const weeks = monthMatrix(2026, 6)
    const last = weeks[5][6]
    expect(last.getFullYear()).toBe(2026)
    expect(last.getMonth()).toBe(7)
    expect(last.getDate()).toBe(8)
  })

  it('网格连续无跳跃', () => {
    const weeks = monthMatrix(2026, 6)
    const flat = weeks.flat()
    for (let i = 1; i < flat.length; i++) {
      const diffDays = (flat[i].getTime() - flat[i - 1].getTime()) / 86400000
      expect(diffDays).toBe(1)
    }
  })
})

describe('isSameMonth', () => {
  it('同年同月 → true', () => expect(isSameMonth(new Date(2026, 6, 15), 2026, 6)).toBe(true))
  it('填充日属于上月 → false', () => expect(isSameMonth(new Date(2026, 5, 28), 2026, 6)).toBe(false))
})

describe('isSameDay', () => {
  it('同年月日（不同时分）→ true', () => {
    expect(isSameDay(new Date(2026, 6, 9, 1, 0), new Date(2026, 6, 9, 23, 0))).toBe(true)
  })
  it('不同日 → false', () => expect(isSameDay(new Date(2026, 6, 9), new Date(2026, 6, 10))).toBe(false))
})
