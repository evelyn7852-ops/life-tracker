import { describe, it, expect } from 'vitest'
import { formatBudget, groupTripsByYear, orderGroupsCurrentFirst, type Trip } from './travelPlan'

function trip(overrides: Partial<Trip>): Trip {
  return {
    year: 2026, slot: '五一', period_hint: '', destination: '目的地', country: '中国',
    type: 'domestic', days: 7, status: 'planned', budget_cny: 5000, budget_stale: false, notes: '',
    ...overrides,
  }
}

describe('groupTripsByYear', () => {
  it('按年分组，年份升序', () => {
    const trips = [trip({ year: 2028 }), trip({ year: 2026 }), trip({ year: 2026, slot: '十一' }), trip({ year: 2027 })]
    const groups = groupTripsByYear(trips)
    expect(groups.map((g) => g.year)).toEqual([2026, 2027, 2028])
    expect(groups[0].trips.length).toBe(2)
  })

  it('空数组返回空分组', () => {
    expect(groupTripsByYear([])).toEqual([])
  })
})

describe('orderGroupsCurrentFirst', () => {
  it('当前年置顶，其余年份仍按升序排列', () => {
    const groups = groupTripsByYear([
      trip({ year: 2026 }), trip({ year: 2027 }), trip({ year: 2028 }), trip({ year: 2029 }),
    ])
    const ordered = orderGroupsCurrentFirst(groups, 2028)
    expect(ordered.map((g) => g.year)).toEqual([2028, 2026, 2027, 2029])
  })

  it('当前年不在数据里时不改变顺序', () => {
    const groups = groupTripsByYear([trip({ year: 2026 }), trip({ year: 2027 })])
    const ordered = orderGroupsCurrentFirst(groups, 2099)
    expect(ordered.map((g) => g.year)).toEqual([2026, 2027])
  })
})

describe('formatBudget', () => {
  it('有预算且不过期 → ¥格式', () => {
    expect(formatBudget(18000, false)).toBe('¥18,000')
  })

  it('预算为 null → 预算待估', () => {
    expect(formatBudget(null, false)).toBe('预算待估')
  })

  it('预算过期（budget_stale） → 预算待估，即使有数字', () => {
    expect(formatBudget(9999, true)).toBe('预算待估')
  })
})
