import { describe, it, expect } from 'vitest'
import { weekdayZh, formatClock } from './dateFormat'

describe('weekdayZh', () => {
  it('2026-07-18 是周六 → 「六」', () => {
    expect(weekdayZh(new Date(2026, 6, 18))).toBe('六')
  })

  it('2026-07-19 是周日 → 「日」', () => {
    expect(weekdayZh(new Date(2026, 6, 19))).toBe('日')
  })
})

describe('formatClock', () => {
  it('补零到两位', () => {
    expect(formatClock(new Date(2026, 0, 1, 9, 5))).toBe('09:05')
  })

  it('两位不补零', () => {
    expect(formatClock(new Date(2026, 0, 1, 23, 45))).toBe('23:45')
  })
})
