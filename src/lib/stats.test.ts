import { describe, it, expect } from 'vitest'
import { computeStreak, countByDomain, moodSparkline } from './stats'
import type { Entry } from './types'

function journalEntry(ts: string, mood?: string): Entry {
  return {
    id: ts, ts, domain: 'journal', raw_text: '',
    data: mood ? { mood } : {}, parse_source: 'manual', tags: [],
  }
}

describe('computeStreak 连续记录天数', () => {
  it('空数组 → 0', () => {
    expect(computeStreak([], new Date(2026, 6, 17))).toBe(0)
  })

  it('今天有记录，昨天/前天也有 → 3', () => {
    const dates = ['2026-07-17', '2026-07-16', '2026-07-15']
    expect(computeStreak(dates, new Date(2026, 6, 17))).toBe(3)
  })

  it('今天还没记，但昨天连续 → 不清零，按截至昨天算', () => {
    const dates = ['2026-07-16', '2026-07-15', '2026-07-14']
    expect(computeStreak(dates, new Date(2026, 6, 17))).toBe(3)
  })

  it('今天没记且昨天也没记（断链）→ 0', () => {
    const dates = ['2026-07-10']
    expect(computeStreak(dates, new Date(2026, 6, 17))).toBe(0)
  })

  it('中间有缺口 → 只算最近连续段', () => {
    const dates = ['2026-07-17', '2026-07-16', '2026-07-14', '2026-07-13']
    expect(computeStreak(dates, new Date(2026, 6, 17))).toBe(2)
  })

  it('跨月边界连续', () => {
    const dates = ['2026-08-01', '2026-07-31', '2026-07-30']
    expect(computeStreak(dates, new Date(2026, 7, 1))).toBe(3)
  })

  it('跨年边界连续', () => {
    const dates = ['2027-01-01', '2026-12-31', '2026-12-30']
    expect(computeStreak(dates, new Date(2027, 0, 1))).toBe(3)
  })

  it('重复日期只算一次', () => {
    const dates = ['2026-07-17', '2026-07-17', '2026-07-16']
    expect(computeStreak(dates, new Date(2026, 6, 17))).toBe(2)
  })

  it('乱序输入也能正确计算', () => {
    const dates = ['2026-07-15', '2026-07-17', '2026-07-16']
    expect(computeStreak(dates, new Date(2026, 6, 17))).toBe(3)
  })
})

describe('countByDomain 按域计数', () => {
  it('空数组 → 各域为 0', () => {
    const result = countByDomain([])
    expect(result).toEqual({ food: 0, workout: 0, travel: 0, reading: 0, journal: 0, learning: 0 })
  })

  it('混合域条目 → 各自计数', () => {
    const entries: Entry[] = [
      { id: '1', ts: '2026-07-01T00:00:00Z', domain: 'food', raw_text: '', data: { meal: '早', items: [] }, parse_source: 'manual', tags: [] },
      { id: '2', ts: '2026-07-02T00:00:00Z', domain: 'food', raw_text: '', data: { meal: '午', items: [] }, parse_source: 'manual', tags: [] },
      { id: '3', ts: '2026-07-03T00:00:00Z', domain: 'workout', raw_text: '', data: { type: '力量' }, parse_source: 'manual', tags: [] },
      journalEntry('2026-07-04T00:00:00Z', '😊'),
    ]
    const result = countByDomain(entries)
    expect(result.food).toBe(2)
    expect(result.workout).toBe(1)
    expect(result.journal).toBe(1)
    expect(result.travel).toBe(0)
    expect(result.reading).toBe(0)
    expect(result.learning).toBe(0)
  })
})

describe('moodSparkline 近 N 天情绪', () => {
  it('无 journal 记录 → 全部为 null', () => {
    const result = moodSparkline([], 3, new Date(2026, 6, 17))
    expect(result).toEqual([null, null, null])
  })

  it('每天各一条 → 按日期顺序（旧→新）取 mood', () => {
    const entries = [
      journalEntry('2026-07-15T09:00:00', '😐'),
      journalEntry('2026-07-16T09:00:00', '🥳'),
      journalEntry('2026-07-17T09:00:00', '😊'),
    ]
    const result = moodSparkline(entries, 3, new Date(2026, 6, 17))
    expect(result).toEqual(['😐', '🥳', '😊'])
  })

  it('缺失某天 → 该位置为 null', () => {
    const entries = [
      journalEntry('2026-07-15T09:00:00', '😐'),
      journalEntry('2026-07-17T09:00:00', '😊'),
    ]
    const result = moodSparkline(entries, 3, new Date(2026, 6, 17))
    expect(result).toEqual(['😐', null, '😊'])
  })

  it('同一天多条 mood → 取最新（ts 最大）的一条', () => {
    const entries = [
      journalEntry('2026-07-17T08:00:00', '😐'),
      journalEntry('2026-07-17T20:00:00', '😢'),
    ]
    const result = moodSparkline(entries, 1, new Date(2026, 6, 17))
    expect(result).toEqual(['😢'])
  })

  it('journal 条目没有 mood 字段 → 忽略，不覆盖该日', () => {
    const entries = [
      { id: 'a', ts: '2026-07-17T08:00:00', domain: 'journal' as const, raw_text: '写了点东西', data: {}, parse_source: 'manual' as const, tags: [] },
    ]
    const result = moodSparkline(entries, 1, new Date(2026, 6, 17))
    expect(result).toEqual([null])
  })

  it('非 journal 域条目忽略', () => {
    const entries: Entry[] = [
      { id: 'a', ts: '2026-07-17T08:00:00', domain: 'food', raw_text: '', data: { meal: '早', items: [] }, parse_source: 'manual', tags: [] },
    ]
    const result = moodSparkline(entries, 1, new Date(2026, 6, 17))
    expect(result).toEqual([null])
  })
})
