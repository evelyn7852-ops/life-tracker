import { describe, it, expect, vi, beforeEach } from 'vitest'

const store = new Map<string, unknown>()
vi.mock('idb-keyval', () => ({
  get: vi.fn(async (k: string) => store.get(k)),
  set: vi.fn(async (k: string, v: unknown) => { store.set(k, v) }),
}))
const insertMock = vi.fn()
vi.mock('./entriesRepo', () => ({ insertEntry: (d: unknown) => insertMock(d) }))

import { queueEntry, pendingCount, flushOutbox, saveEntry } from './outbox'
import type { NewEntry } from './types'

const draft: NewEntry = {
  ts: '2026-07-08T12:00:00Z', domain: 'food', raw_text: '午餐 沙拉',
  data: { meal: '午', items: ['沙拉'] }, parse_source: 'rule', tags: [],
}

beforeEach(() => { store.clear(); insertMock.mockReset() })

describe('outbox', () => {
  it('queue + count', async () => {
    await queueEntry(draft)
    expect(await pendingCount()).toBe(1)
  })
  it('flush 成功清空', async () => {
    insertMock.mockResolvedValue({})
    await queueEntry(draft); await queueEntry(draft)
    expect(await flushOutbox()).toBe(2)
    expect(await pendingCount()).toBe(0)
  })
  it('flush 失败保留剩余', async () => {
    insertMock.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('net'))
    await queueEntry(draft); await queueEntry(draft)
    expect(await flushOutbox()).toBe(1)
    expect(await pendingCount()).toBe(1)
  })
  it('saveEntry 在线直存', async () => {
    insertMock.mockResolvedValue({})
    expect(await saveEntry(draft)).toBe('synced')
    expect(await pendingCount()).toBe(0)
  })
  it('saveEntry 失败入队', async () => {
    insertMock.mockRejectedValue(new Error('offline'))
    expect(await saveEntry(draft)).toBe('queued')
    expect(await pendingCount()).toBe(1)
  })
})
