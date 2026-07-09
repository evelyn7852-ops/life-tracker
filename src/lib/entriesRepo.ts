import { supabase } from './supabase'
import type { Domain, Entry, NewEntry } from './types'

const COLS = 'id, ts, domain, raw_text, data, parse_source, tags'

export interface ListOpts { fromTs?: string; toTs?: string; domain?: Domain; limit?: number; beforeTs?: string }

export async function insertEntry(draft: NewEntry): Promise<Entry> {
  const { data, error } = await supabase.from('entries').insert(draft).select(COLS).single()
  if (error) throw error
  return data as Entry
}

export async function updateEntry(id: string, patch: Partial<NewEntry>): Promise<Entry> {
  const { data, error } = await supabase.from('entries')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id).select(COLS).single()
  if (error) throw error
  return data as Entry
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase.from('entries').delete().eq('id', id)
  if (error) throw error
}

export async function listEntries(opts: ListOpts = {}): Promise<Entry[]> {
  let q = supabase.from('entries').select(COLS).order('ts', { ascending: false })
  if (opts.fromTs) q = q.gte('ts', opts.fromTs)
  if (opts.toTs) q = q.lt('ts', opts.toTs)
  if (opts.domain) q = q.eq('domain', opts.domain)
  if (opts.beforeTs) q = q.lt('ts', opts.beforeTs)
  q = q.limit(opts.limit ?? 50)
  const { data, error } = await q
  if (error) throw error
  return data as Entry[]
}
