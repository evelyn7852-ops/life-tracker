import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { supabase } from './supabase'
import { insertEntry, updateEntry, deleteEntry, listEntries } from './entriesRepo'
import type { NewEntry } from './types'

// 需要 .env.local 里加 TEST_EMAIL / TEST_PASSWORD（Task 6 注册的账号）
const draft: NewEntry = {
  ts: new Date().toISOString(),
  domain: 'workout',
  raw_text: '瑜伽45分钟',
  data: { type: '瑜伽', duration_min: 45 },
  parse_source: 'rule',
  tags: [],
}

let createdId: string

beforeAll(async () => {
  const { error } = await supabase.auth.signInWithPassword({
    email: import.meta.env.VITE_TEST_EMAIL,
    password: import.meta.env.VITE_TEST_PASSWORD,
  })
  if (error) throw error
})

afterAll(async () => {
  if (createdId) await deleteEntry(createdId).catch(() => {})
})

describe('entriesRepo CRUD', () => {
  it('insert 返回带 id 的完整行', async () => {
    const e = await insertEntry(draft)
    createdId = e.id
    expect(e.id).toBeTruthy()
    expect(e.domain).toBe('workout')
  })
  it('list 能查到且按 ts desc', async () => {
    const rows = await listEntries({ limit: 5 })
    expect(rows.some((r) => r.id === createdId)).toBe(true)
  })
  it('domain 过滤', async () => {
    const rows = await listEntries({ domain: 'food', limit: 50 })
    expect(rows.every((r) => r.domain === 'food')).toBe(true)
  })
  it('update 改字段', async () => {
    const e = await updateEntry(createdId, { tags: ['am'] })
    expect(e.tags).toEqual(['am'])
  })
  it('delete 后查不到', async () => {
    await deleteEntry(createdId)
    const rows = await listEntries({ limit: 50 })
    expect(rows.some((r) => r.id === createdId)).toBe(false)
    createdId = ''
  })
})
