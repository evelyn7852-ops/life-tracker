import { describe, it, expect, vi, beforeEach } from 'vitest'

// 链式 supabase mock：每个 from() 返回一个可继续 .eq/.gte/.lte/.order/.select 的对象，
// 最终 await 时 resolve 到预置的 result。照 entriesRepo 的调用风格搭桥。
function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  const self = () => chain
  chain.select = vi.fn(self)
  chain.insert = vi.fn(self)
  chain.update = vi.fn(self)
  chain.delete = vi.fn(self)
  chain.eq = vi.fn(self)
  chain.gte = vi.fn(self)
  chain.lte = vi.fn(self)
  chain.order = vi.fn(self)
  chain.single = vi.fn(async () => result)
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve)
  return chain
}

const fromMock = vi.fn()
vi.mock('./supabase', () => ({ supabase: { from: (...a: unknown[]) => fromMock(...a) } }))

const insertEntryMock = vi.fn()
vi.mock('./entriesRepo', () => ({ insertEntry: (d: unknown) => insertEntryMock(d) }))

import { listWorkouts, insertWorkout, updateWorkout, deleteWorkout, archiveWorkout } from './workoutRepo'
import type { Workout } from './types'

const sampleWorkout: Workout = {
  id: 'w1',
  date: '2026-07-11',
  template_id: 'push-day',
  title: '力量·推日',
  blocks: [
    { exerciseId: 'bench-press', sets: 4, reps: 6, restSec: 120 },
    { exerciseId: 'incline-bench-press', sets: 3, reps: 8, restSec: 90 },
  ],
  status: 'planned',
  performed: null,
  created_at: '2026-07-11T00:00:00Z',
}

beforeEach(() => {
  fromMock.mockReset()
  insertEntryMock.mockReset()
})

describe('workoutRepo', () => {
  it('listWorkouts 查询 workouts 表并支持日期范围', async () => {
    const chain = makeChain({ data: [sampleWorkout], error: null })
    fromMock.mockReturnValue(chain)
    const rows = await listWorkouts({ fromDate: '2026-07-05', toDate: '2026-07-11' })
    expect(fromMock).toHaveBeenCalledWith('workouts')
    expect(chain.gte).toHaveBeenCalledWith('date', '2026-07-05')
    expect(chain.lte).toHaveBeenCalledWith('date', '2026-07-11')
    expect(rows).toEqual([sampleWorkout])
  })

  it('listWorkouts 出错时抛出', async () => {
    fromMock.mockReturnValue(makeChain({ data: null, error: new Error('boom') }))
    await expect(listWorkouts()).rejects.toThrow('boom')
  })

  it('insertWorkout 插入并返回带 id 的行', async () => {
    const chain = makeChain({ data: sampleWorkout, error: null })
    fromMock.mockReturnValue(chain)
    const draft = { date: sampleWorkout.date, template_id: sampleWorkout.template_id, title: sampleWorkout.title, blocks: sampleWorkout.blocks, status: 'planned' as const, performed: null }
    const row = await insertWorkout(draft)
    expect(chain.insert).toHaveBeenCalledWith(draft)
    expect(row).toEqual(sampleWorkout)
  })

  it('updateWorkout 按 id 更新', async () => {
    const chain = makeChain({ data: { ...sampleWorkout, status: 'done' }, error: null })
    fromMock.mockReturnValue(chain)
    const row = await updateWorkout('w1', { status: 'done' })
    expect(chain.update).toHaveBeenCalledWith({ status: 'done' })
    expect(chain.eq).toHaveBeenCalledWith('id', 'w1')
    expect(row.status).toBe('done')
  })

  it('deleteWorkout 按 id 删除', async () => {
    const chain = makeChain({ data: null, error: null })
    fromMock.mockReturnValue(chain)
    await deleteWorkout('w1')
    expect(chain.delete).toHaveBeenCalled()
    expect(chain.eq).toHaveBeenCalledWith('id', 'w1')
  })

  it('archiveWorkout 把状态改为 done 并写一条 workout 汇总 entry', async () => {
    const chain = makeChain({ data: { ...sampleWorkout, status: 'done' }, error: null })
    fromMock.mockReturnValue(chain)
    insertEntryMock.mockResolvedValue({})
    const row = await archiveWorkout(sampleWorkout)
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'done' }))
    expect(row.status).toBe('done')
    expect(insertEntryMock).toHaveBeenCalledTimes(1)
    const entryArg = insertEntryMock.mock.calls[0][0]
    expect(entryArg.domain).toBe('workout')
    expect(entryArg.parse_source).toBe('manual')
    expect(entryArg.raw_text).toContain('力量·推日')
    expect(entryArg.raw_text).toContain('2') // 动作数量
    expect(entryArg.data.type).toBe('力量·推日')
  })
})
