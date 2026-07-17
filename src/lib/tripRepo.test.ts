import { describe, it, expect, vi, beforeEach } from 'vitest'

// 链式 supabase mock，照 entriesRepo/workoutRepo 的搭桥风格。
function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  const self = () => chain
  chain.select = vi.fn(self)
  chain.insert = vi.fn(self)
  chain.update = vi.fn(self)
  chain.delete = vi.fn(self)
  chain.eq = vi.fn(self)
  chain.order = vi.fn(self)
  chain.single = vi.fn(async () => result)
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve)
  return chain
}

const fromMock = vi.fn()
vi.mock('./supabase', () => ({ supabase: { from: (...a: unknown[]) => fromMock(...a) } }))

import {
  listTrips, insertTrip, updateTrip, deleteTrip,
  seedKeyFor, seedTripsIfEmpty, countYearConflicts, slotToQuarter, currentQuarterTrips,
  type TripRow,
} from './tripRepo'

function tripRow(overrides: Partial<TripRow> = {}): TripRow {
  return {
    id: 't1', year: 2026, slot: '五一', period_hint: null, destination: '目的地', country: '中国',
    trip_type: 'domestic', days: 7, status: 'planned', budget_cny: 5000, budget_stale: false,
    notes: null, seed_key: null, created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

beforeEach(() => { fromMock.mockReset() })

describe('listTrips / insertTrip / updateTrip / deleteTrip', () => {
  it('listTrips 查询 trips 表，按年份升序', async () => {
    const chain = makeChain({ data: [tripRow()], error: null })
    fromMock.mockReturnValue(chain)
    const rows = await listTrips()
    expect(fromMock).toHaveBeenCalledWith('trips')
    expect(chain.order).toHaveBeenCalledWith('year', { ascending: true })
    expect(rows).toEqual([tripRow()])
  })

  it('listTrips 出错时抛出', async () => {
    fromMock.mockReturnValue(makeChain({ data: null, error: new Error('boom') }))
    await expect(listTrips()).rejects.toThrow('boom')
  })

  it('insertTrip 插入并返回带 id 的行', async () => {
    const draft = {
      year: 2026, slot: '五一', period_hint: null, destination: '目的地', country: '中国',
      trip_type: 'domestic', days: 7, status: 'planned' as const, budget_cny: 5000, budget_stale: false,
      notes: null, seed_key: null,
    }
    const chain = makeChain({ data: tripRow(), error: null })
    fromMock.mockReturnValue(chain)
    const row = await insertTrip(draft)
    expect(chain.insert).toHaveBeenCalledWith(draft)
    expect(row).toEqual(tripRow())
  })

  it('updateTrip 按 id 更新', async () => {
    const chain = makeChain({ data: tripRow({ destination: '新目的地' }), error: null })
    fromMock.mockReturnValue(chain)
    const row = await updateTrip('t1', { destination: '新目的地' })
    expect(chain.update).toHaveBeenCalledWith({ destination: '新目的地' })
    expect(chain.eq).toHaveBeenCalledWith('id', 't1')
    expect(row.destination).toBe('新目的地')
  })

  it('deleteTrip 按 id 删除', async () => {
    const chain = makeChain({ data: null, error: null })
    fromMock.mockReturnValue(chain)
    await deleteTrip('t1')
    expect(chain.delete).toHaveBeenCalled()
    expect(chain.eq).toHaveBeenCalledWith('id', 't1')
  })
})

describe('seedKeyFor', () => {
  it('由 年份-时段-目的地 拼接', () => {
    expect(seedKeyFor({ year: 2026, slot: '五一', destination: '泰国·曼谷+普吉岛' })).toBe('2026-五一-泰国·曼谷+普吉岛')
  })
})

describe('seedTripsIfEmpty', () => {
  it('用户已有行程时跳过导入，不调用 insert', async () => {
    const listChain = makeChain({ data: [tripRow()], error: null })
    fromMock.mockReturnValue(listChain)
    await seedTripsIfEmpty()
    expect(fromMock).toHaveBeenCalledTimes(1) // 只查询了一次，没有第二次 insert
    expect(listChain.insert).not.toHaveBeenCalled()
  })

  it('用户无行程时，整批导入 152 条，字段按 travelPlan.json 映射', async () => {
    const listChain = makeChain({ data: [], error: null })
    const insertChain = makeChain({ data: null, error: null })
    fromMock.mockReturnValueOnce(listChain).mockReturnValueOnce(insertChain)

    await seedTripsIfEmpty()

    expect(insertChain.insert).toHaveBeenCalledTimes(1)
    const rows = (insertChain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0] as Array<Record<string, unknown>>
    expect(rows.length).toBe(152)

    // json 第一条：type→trip_type，status 'done' 原样映射为 'done'，seed_key 拼接正确
    const first = rows[0]
    expect(first.trip_type).toBe('intl')
    expect(first.type).toBeUndefined()
    expect(first.status).toBe('done')
    expect(first.destination).toBe('泰国·曼谷+普吉岛')
    expect(first.seed_key).toBe('2026-五一-泰国·曼谷+普吉岛')

    // json 里 status 全部只有 done/planned，没有 booked
    const statuses = new Set(rows.map((r) => r.status))
    expect(statuses.has('booked')).toBe(false)

    // budget_cny 为 null 的条目原样保留 null，budget_stale 透传
    const staleRow = rows.find((r) => r.budget_stale === true)
    expect(staleRow).toBeTruthy()
    expect(staleRow!.budget_cny).toBeNull()
  })

  it('并发导致的唯一约束冲突（23505）静默吞掉，不抛出', async () => {
    const listChain = makeChain({ data: [], error: null })
    const insertChain = makeChain({ data: null, error: { code: '23505', message: 'duplicate key' } })
    fromMock.mockReturnValueOnce(listChain).mockReturnValueOnce(insertChain)
    await expect(seedTripsIfEmpty()).resolves.toBeUndefined()
  })

  it('其它插入错误正常抛出', async () => {
    const listChain = makeChain({ data: [], error: null })
    const insertChain = makeChain({ data: null, error: { code: '500', message: 'boom' } })
    fromMock.mockReturnValueOnce(listChain).mockReturnValueOnce(insertChain)
    await expect(seedTripsIfEmpty()).rejects.toMatchObject({ code: '500' })
  })
})

describe('countYearConflicts', () => {
  it('统计目标年份下除自身外的行程数', () => {
    const trips = [
      tripRow({ id: 't1', year: 2026 }),
      tripRow({ id: 't2', year: 2027 }),
      tripRow({ id: 't3', year: 2027 }),
    ]
    expect(countYearConflicts(trips, 't1', 2027)).toBe(2)
    expect(countYearConflicts(trips, 't2', 2027)).toBe(1) // 排除自身
    expect(countYearConflicts(trips, 't1', 2030)).toBe(0)
  })
})

describe('slotToQuarter', () => {
  it('固定假期名映射', () => {
    expect(slotToQuarter('五一')).toBe(2)
    expect(slotToQuarter('十一')).toBe(4)
    expect(slotToQuarter('圣诞')).toBe(4)
  })

  it('月份文案粗略映射', () => {
    expect(slotToQuarter('3月')).toBe(1)
    expect(slotToQuarter('4月下旬')).toBe(2)
    expect(slotToQuarter('6-7月')).toBe(2)
    expect(slotToQuarter('11-12月')).toBe(4)
    expect(slotToQuarter('1月')).toBe(1)
  })

  it('无法识别返回 null', () => {
    expect(slotToQuarter('国庆前后')).toBeNull()
  })
})

describe('currentQuarterTrips', () => {
  it('返回今年当季状态为 planned/booked 的行程', () => {
    const now = new Date('2026-07-17T00:00:00')
    const trips = [
      tripRow({ id: 't1', year: 2026, slot: '7月', status: 'planned' }), // Q3 命中
      tripRow({ id: 't2', year: 2026, slot: '7月', status: 'booked' }),  // Q3 命中
      tripRow({ id: 't3', year: 2026, slot: '7月', status: 'done' }),    // 已完成不提醒
      tripRow({ id: 't4', year: 2026, slot: '十一', status: 'planned' }), // Q4 不命中
      tripRow({ id: 't5', year: 2027, slot: '7月', status: 'planned' }), // 年份不命中
    ]
    const result = currentQuarterTrips(trips, now)
    expect(result.map((t) => t.id)).toEqual(['t1', 't2'])
  })

  it('当季无行程时返回空数组', () => {
    const now = new Date('2026-07-17T00:00:00')
    expect(currentQuarterTrips([tripRow({ year: 2026, slot: '十一' })], now)).toEqual([])
  })
})
