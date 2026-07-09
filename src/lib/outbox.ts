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

async function doFlush(): Promise<number> {
  const q = await read()
  const remain: NewEntry[] = []
  let ok = 0
  for (const d of q) {
    try { await insertEntry(d); ok++ } catch { remain.push(d) }
  }
  await set(KEY, remain)
  return ok
}

let inFlight: Promise<number> | null = null
export function flushOutbox(): Promise<number> {
  if (inFlight) return inFlight
  inFlight = doFlush().finally(() => { inFlight = null })
  return inFlight
}

export async function saveEntry(draft: NewEntry): Promise<'synced' | 'queued'> {
  try { await insertEntry(draft); return 'synced' }
  catch { await queueEntry(draft); return 'queued' }
}
