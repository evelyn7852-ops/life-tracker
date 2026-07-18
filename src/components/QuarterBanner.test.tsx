import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { TripRow } from '../lib/tripRepo'

const listTripsMock = vi.fn()
vi.mock('../lib/tripRepo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/tripRepo')>()
  return {
    ...actual,
    listTrips: () => listTripsMock(),
  }
})

import { QuarterBanner } from './QuarterBanner'

function tripRow(overrides: Partial<TripRow> = {}): TripRow {
  return {
    id: 'id-1', year: 2026, slot: '五一', period_hint: null, destination: '目的地', country: '中国',
    trip_type: 'domestic', days: 7, status: 'planned', budget_cny: 5000, budget_stale: false,
    notes: null, seed_key: null, created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('QuarterBanner（V1.7 从首页迁往记录页）', () => {
  beforeEach(() => {
    vi.useFakeTimers().setSystemTime(new Date('2026-07-17T09:00:00'))
    listTripsMock.mockReset().mockResolvedValue([])
  })
  afterEach(() => { vi.useRealTimers() })

  it('当年当季有 planned/booked 行程 → 显示「本季计划：X」', async () => {
    // 2026-07 属 Q3；slot「7月」→Q3 命中
    listTripsMock.mockResolvedValue([
      tripRow({ id: 'q3', year: 2026, slot: '7月', destination: '内蒙古草原', status: 'planned' }),
    ])
    render(<QuarterBanner refreshKey={0} active />)
    await vi.waitFor(() => expect(screen.getByText(/本季计划/)).toBeTruthy())
    expect(screen.getByText(/内蒙古草原/)).toBeTruthy()
  })

  it('本季无命中行程 → 不渲染', async () => {
    listTripsMock.mockResolvedValue([
      tripRow({ id: 'q4', year: 2026, slot: '十一', destination: '别处', status: 'planned' }),
    ])
    render(<QuarterBanner refreshKey={0} active />)
    await vi.waitFor(() => expect(listTripsMock).toHaveBeenCalled())
    expect(screen.queryByText(/本季计划/)).toBeFalsy()
  })

  it('trips 表不存在（listTrips reject）→ 静默，不崩溃、不显示 banner', async () => {
    listTripsMock.mockRejectedValue(new Error('relation "trips" does not exist'))
    render(<QuarterBanner refreshKey={0} active />)
    await vi.waitFor(() => expect(listTripsMock).toHaveBeenCalled())
    expect(screen.queryByText(/本季计划/)).toBeFalsy()
  })

  it('active=false 时不拉取行程', () => {
    render(<QuarterBanner refreshKey={0} active={false} />)
    expect(listTripsMock).not.toHaveBeenCalled()
  })
})
