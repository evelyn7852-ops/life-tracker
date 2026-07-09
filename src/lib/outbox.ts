import { get, set } from 'idb-keyval'
import { insertEntry } from './entriesRepo'
import type { NewEntry } from './types'

const KEY = 'outbox_v1'

interface OutboxItem { id: string; entry: NewEntry }

function isOutboxItem(x: unknown): x is OutboxItem {
  return !!x && typeof x === 'object' && 'id' in x && 'entry' in x
}

async function read(): Promise<OutboxItem[]> {
  const raw = ((await get(KEY)) as unknown[] | undefined) ?? []
  let migrated = false
  const items = raw.map((x) => {
    if (isOutboxItem(x)) return x
    migrated = true
    return { id: crypto.randomUUID(), entry: x as NewEntry }
  })
  if (migrated) await set(KEY, items)
  return items
}

export async function queueEntry(draft: NewEntry): Promise<void> {
  const q = await read()
  q.push({ id: crypto.randomUUID(), entry: draft })
  await set(KEY, q)
}

export async function pendingCount(): Promise<number> {
  return (await read()).length
}

async function doFlush(): Promise<number> {
  const snapshot = await read()
  let ok = 0
  const succeededIds = new Set<string>()
  for (const item of snapshot) {
    try { await insertEntry(item.entry); ok++; succeededIds.add(item.id) }
    catch { /* left for retry */ }
  }
  // Re-read the current queue so anything queued mid-flight (or left over from
  // a failed insert) survives — never blindly overwrite with the snapshot.
  const current = await read()
  const remain = current.filter((item) => !succeededIds.has(item.id))
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
