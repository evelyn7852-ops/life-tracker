import { describe, it, expect, vi, beforeEach } from 'vitest'

// 链式 supabase mock，照 tripRepo.test.ts 的搭桥风格。
function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  const self = () => chain
  chain.select = vi.fn(self)
  chain.insert = vi.fn(self)
  chain.update = vi.fn(self)
  chain.upsert = vi.fn(self)
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
  listItems, insertItem, updateItem, deleteItem, groupByStatus,
  listProgressRows, setProgress, bulkInsertProgress, migrateLocalProgressIfEmpty,
  type LearningItemRow,
} from './learningRepo'

function itemRow(overrides: Partial<LearningItemRow> = {}): LearningItemRow {
  return {
    id: 'i1', title: '标题', url: null, source: null, tag: null,
    status: '待读', note: null, added_by: 'manual', created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

beforeEach(() => { fromMock.mockReset() })

describe('listItems / insertItem / updateItem / deleteItem', () => {
  it('listItems 查询 learning_items 表，按创建时间倒序', async () => {
    const chain = makeChain({ data: [itemRow()], error: null })
    fromMock.mockReturnValue(chain)
    const rows = await listItems()
    expect(fromMock).toHaveBeenCalledWith('learning_items')
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(rows).toEqual([itemRow()])
  })

  it('listItems 出错时抛出', async () => {
    fromMock.mockReturnValue(makeChain({ data: null, error: new Error('boom') }))
    await expect(listItems()).rejects.toThrow('boom')
  })

  it('insertItem 只需 title 必填，其余默认 null/待读/manual', async () => {
    const chain = makeChain({ data: itemRow(), error: null })
    fromMock.mockReturnValue(chain)
    const row = await insertItem({ title: '标题' })
    expect(chain.insert).toHaveBeenCalledWith({
      title: '标题', url: null, source: null, tag: null, note: null, status: '待读', added_by: 'manual',
    })
    expect(row).toEqual(itemRow())
  })

  it('insertItem 透传可选字段', async () => {
    const chain = makeChain({ data: itemRow({ url: 'http://a', source: 'src', tag: 'tag', note: 'n' }), error: null })
    fromMock.mockReturnValue(chain)
    await insertItem({ title: '标题', url: 'http://a', source: 'src', tag: 'tag', note: 'n' })
    expect(chain.insert).toHaveBeenCalledWith({
      title: '标题', url: 'http://a', source: 'src', tag: 'tag', note: 'n', status: '待读', added_by: 'manual',
    })
  })

  it('updateItem 按 id 更新（如状态切换）', async () => {
    const chain = makeChain({ data: itemRow({ status: '在读' }), error: null })
    fromMock.mockReturnValue(chain)
    const row = await updateItem('i1', { status: '在读' })
    expect(chain.update).toHaveBeenCalledWith({ status: '在读' })
    expect(chain.eq).toHaveBeenCalledWith('id', 'i1')
    expect(row.status).toBe('在读')
  })

  it('deleteItem 按 id 删除', async () => {
    const chain = makeChain({ data: null, error: null })
    fromMock.mockReturnValue(chain)
    await deleteItem('i1')
    expect(chain.delete).toHaveBeenCalled()
    expect(chain.eq).toHaveBeenCalledWith('id', 'i1')
  })
})

describe('groupByStatus', () => {
  it('按三态分组，保持每组内原顺序', () => {
    const rows = [
      itemRow({ id: 'a', status: '待读' }),
      itemRow({ id: 'b', status: '已读' }),
      itemRow({ id: 'c', status: '待读' }),
      itemRow({ id: 'd', status: '在读' }),
    ]
    const grouped = groupByStatus(rows)
    expect(grouped['待读'].map((r) => r.id)).toEqual(['a', 'c'])
    expect(grouped['在读'].map((r) => r.id)).toEqual(['d'])
    expect(grouped['已读'].map((r) => r.id)).toEqual(['b'])
  })

  it('空列表三组都为空数组', () => {
    const grouped = groupByStatus([])
    expect(grouped['待读']).toEqual([])
    expect(grouped['在读']).toEqual([])
    expect(grouped['已读']).toEqual([])
  })
})

describe('listProgressRows / setProgress / bulkInsertProgress', () => {
  it('listProgressRows 查询 learning_progress 表', async () => {
    const chain = makeChain({ data: [{ item_id: 'w1-learn-0', done: true }], error: null })
    fromMock.mockReturnValue(chain)
    const rows = await listProgressRows()
    expect(fromMock).toHaveBeenCalledWith('learning_progress')
    expect(rows).toEqual([{ item_id: 'w1-learn-0', done: true }])
  })

  it('listProgressRows 出错时抛出', async () => {
    fromMock.mockReturnValue(makeChain({ data: null, error: new Error('boom') }))
    await expect(listProgressRows()).rejects.toThrow('boom')
  })

  it('setProgress 写入单条 upsert', async () => {
    const chain = makeChain({ data: null, error: null })
    fromMock.mockReturnValue(chain)
    await setProgress('w1-learn-0', true)
    expect(chain.upsert).toHaveBeenCalledWith({ item_id: 'w1-learn-0', done: true })
  })

  it('setProgress 出错时抛出（供 UI 捕获显示离线提示）', async () => {
    fromMock.mockReturnValue(makeChain({ data: null, error: new Error('offline') }))
    await expect(setProgress('w1-learn-0', true)).rejects.toThrow('offline')
  })

  it('bulkInsertProgress 空数组不调用 insert', async () => {
    await bulkInsertProgress([])
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('bulkInsertProgress 批量写入 done:true 行', async () => {
    const chain = makeChain({ data: null, error: null })
    fromMock.mockReturnValue(chain)
    await bulkInsertProgress(['setup-0', 'w1-learn-0'])
    expect(chain.insert).toHaveBeenCalledWith([
      { item_id: 'setup-0', done: true },
      { item_id: 'w1-learn-0', done: true },
    ])
  })
})

describe('migrateLocalProgressIfEmpty（迁移幂等）', () => {
  it('本地有勾选 + 云端无记录 → 批量写入云端', async () => {
    const listChain = makeChain({ data: [], error: null })
    const insertChain = makeChain({ data: null, error: null })
    fromMock.mockReturnValueOnce(listChain).mockReturnValueOnce(insertChain)

    await migrateLocalProgressIfEmpty({ 'setup-0': true, 'w1-learn-0': false, 'w1-build-0': true })

    expect(insertChain.insert).toHaveBeenCalledTimes(1)
    const rows = (insertChain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(rows).toEqual([
      { item_id: 'setup-0', done: true },
      { item_id: 'w1-build-0', done: true },
    ])
  })

  it('云端已有记录 → 跳过，不调用 insert', async () => {
    const listChain = makeChain({ data: [{ item_id: 'setup-0', done: true }], error: null })
    fromMock.mockReturnValue(listChain)
    await migrateLocalProgressIfEmpty({ 'setup-0': true })
    expect(fromMock).toHaveBeenCalledTimes(1) // 只查询，没有第二次 insert
  })

  it('本地无勾选 → 不调用 insert（no-op）', async () => {
    const listChain = makeChain({ data: [], error: null })
    fromMock.mockReturnValue(listChain)
    await migrateLocalProgressIfEmpty({})
    expect(fromMock).toHaveBeenCalledTimes(1) // 只查询，本地没有 true 值，不 insert
  })
})
