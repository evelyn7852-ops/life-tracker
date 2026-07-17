import { describe, it, expect, vi, beforeEach } from 'vitest'

// 链式 supabase mock，照 workoutRepo.test.ts 的搭桥风格。
function makeChain(result: { data: unknown; error: unknown; count?: number | null }) {
  const chain: Record<string, unknown> = {}
  const self = () => chain
  chain.select = vi.fn(self)
  chain.eq = vi.fn(self)
  chain.gte = vi.fn(self)
  chain.lt = vi.fn(self)
  chain.order = vi.fn(self)
  chain.limit = vi.fn(self)
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve)
  return chain
}

const fromMock = vi.fn()
vi.mock('./supabase', () => ({ supabase: { from: (...a: unknown[]) => fromMock(...a) } }))

import { countEntries } from './entriesRepo'

beforeEach(() => { fromMock.mockReset() })

describe('countEntries', () => {
  it('用 head+count 查询，不拉行数据，按 ts 范围过滤', async () => {
    const chain = makeChain({ data: null, error: null, count: 42 })
    fromMock.mockReturnValue(chain)
    const n = await countEntries('2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z')
    expect(fromMock).toHaveBeenCalledWith('entries')
    expect(chain.select).toHaveBeenCalledWith('id', { count: 'exact', head: true })
    expect(chain.gte).toHaveBeenCalledWith('ts', '2026-01-01T00:00:00Z')
    expect(chain.lt).toHaveBeenCalledWith('ts', '2027-01-01T00:00:00Z')
    expect(n).toBe(42)
  })

  it('count 为 null 时返回 0', async () => {
    fromMock.mockReturnValue(makeChain({ data: null, error: null, count: null }))
    const n = await countEntries('2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z')
    expect(n).toBe(0)
  })

  it('出错时抛出', async () => {
    fromMock.mockReturnValue(makeChain({ data: null, error: new Error('boom'), count: null }))
    await expect(countEntries('2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z')).rejects.toThrow('boom')
  })
})
