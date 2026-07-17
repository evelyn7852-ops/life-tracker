import { supabase } from './supabase'

export type LearningStatus = '待读' | '在读' | '已读'
export type AddedBy = 'manual' | 'auto'

export interface LearningItemRow {
  id: string
  title: string
  url: string | null
  source: string | null
  tag: string | null
  status: LearningStatus
  note: string | null
  added_by: AddedBy
  created_at: string
}

export interface NewLearningItem {
  title: string
  url?: string | null
  source?: string | null
  tag?: string | null
  note?: string | null
  status?: LearningStatus
  added_by?: AddedBy
}

const COLS = 'id, title, url, source, tag, status, note, added_by, created_at'

export async function listItems(): Promise<LearningItemRow[]> {
  const { data, error } = await supabase.from('learning_items').select(COLS).order('created_at', { ascending: false })
  if (error) throw error
  return data as LearningItemRow[]
}

export async function insertItem(draft: NewLearningItem): Promise<LearningItemRow> {
  const { data, error } = await supabase.from('learning_items').insert({
    title: draft.title,
    url: draft.url ?? null,
    source: draft.source ?? null,
    tag: draft.tag ?? null,
    note: draft.note ?? null,
    status: draft.status ?? '待读',
    added_by: draft.added_by ?? 'manual',
  }).select(COLS).single()
  if (error) throw error
  return data as LearningItemRow
}

export async function updateItem(id: string, patch: Partial<Omit<LearningItemRow, 'id' | 'created_at'>>): Promise<LearningItemRow> {
  const { data, error } = await supabase.from('learning_items').update(patch).eq('id', id).select(COLS).single()
  if (error) throw error
  return data as LearningItemRow
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from('learning_items').delete().eq('id', id)
  if (error) throw error
}

/** 按待读/在读/已读三态分组，组内保持原顺序（listItems 已按创建时间倒序）。 */
export function groupByStatus(items: LearningItemRow[]): Record<LearningStatus, LearningItemRow[]> {
  const grouped: Record<LearningStatus, LearningItemRow[]> = { 待读: [], 在读: [], 已读: [] }
  for (const item of items) grouped[item.status].push(item)
  return grouped
}

// ---- 集训存档进度云同步（B）----

export interface ProgressRow { item_id: string; done: boolean }

export async function listProgressRows(): Promise<ProgressRow[]> {
  const { data, error } = await supabase.from('learning_progress').select('item_id, done')
  if (error) throw error
  return data as ProgressRow[]
}

/** 单条勾选写库（供勾选框 onChange 调用）；失败抛出，UI 层捕获后回滚 + 提示离线。 */
export async function setProgress(itemId: string, done: boolean): Promise<void> {
  const { error } = await supabase.from('learning_progress').upsert({ item_id: itemId, done })
  if (error) throw error
}

/** 批量写入（迁移用）：只写 done:true 的 id，与原 localStorage 语义一致（未勾选的条目本就不存在于原 progress 对象里的 true 值）。 */
export async function bulkInsertProgress(itemIds: string[]): Promise<void> {
  if (itemIds.length === 0) return
  const rows = itemIds.map((item_id) => ({ item_id, done: true }))
  const { error } = await supabase.from('learning_progress').insert(rows)
  if (error) throw error
}

/**
 * 首次打开集训存档时的一次性迁移：若云端该用户在 learning_progress 里已有行 → 跳过（幂等）；
 * 否则把本地 localStorage 勾选为 true 的 id 批量写入云端。迁移后以云端为准；
 * localStorage 本身不清空（见 spec B 的安全兜底）。
 */
export async function migrateLocalProgressIfEmpty(localProgress: Record<string, boolean>): Promise<void> {
  const existing = await listProgressRows()
  if (existing.length > 0) return
  const doneIds = Object.entries(localProgress).filter(([, done]) => done).map(([id]) => id)
  await bulkInsertProgress(doneIds)
}
