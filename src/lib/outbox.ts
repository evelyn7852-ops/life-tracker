import { get, set } from 'idb-keyval'
import { insertEntry } from './entriesRepo'
import type { NewEntry } from './types'

const KEY = 'outbox_v1'

async function read(): Promise<NewEntry[]> {
  return ((await get(KEY)) as NewEntry[] | undefined) ?? []
}

export async function queueEntry(draft: NewEntry): Promise<void> {
  const q = await read()
  q.push(draft)
  await set(KEY, q)
}

export async function pendingCount(): Promise<number> {
  return (await read()).length
}

export async function flushOutbox(): Promise<number> {
  const q = await read()
  const remain: NewEntry[] = []
  let ok = 0
  for (const d of q) {
    try { await insertEntry(d); ok++ } catch { remain.push(d) }
  }
  await set(KEY, remain)
  return ok
}

export async function saveEntry(draft: NewEntry): Promise<'synced' | 'queued'> {
  try { await insertEntry(draft); return 'synced' }
  catch { await queueEntry(draft); return 'queued' }
}
