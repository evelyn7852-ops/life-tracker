import travelPlanData from '../data/travelPlan.json'
import { supabase } from './supabase'
import type { TravelPlanData, Trip as PlanTrip } from './travelPlan'

export type TripStatusDb = 'planned' | 'booked' | 'done'

export interface TripRow {
  id: string
  year: number
  slot: string
  period_hint: string | null
  destination: string
  country: string | null
  trip_type: string | null
  days: number | null
  status: TripStatusDb
  budget_cny: number | null
  budget_stale: boolean
  notes: string | null
  seed_key: string | null
  created_at: string
}

export type NewTrip = Omit<TripRow, 'id' | 'created_at'>

const COLS = 'id, year, slot, period_hint, destination, country, trip_type, days, status, budget_cny, budget_stale, notes, seed_key, created_at'

export async function listTrips(): Promise<TripRow[]> {
  const { data, error } = await supabase.from('trips').select(COLS).order('year', { ascending: true })
  if (error) throw error
  return data as TripRow[]
}

export async function insertTrip(draft: NewTrip): Promise<TripRow> {
  const { data, error } = await supabase.from('trips').insert(draft).select(COLS).single()
  if (error) throw error
  return data as TripRow
}

export async function updateTrip(id: string, patch: Partial<NewTrip>): Promise<TripRow> {
  const { data, error } = await supabase.from('trips').update(patch).eq('id', id).select(COLS).single()
  if (error) throw error
  return data as TripRow
}

export async function deleteTrip(id: string): Promise<void> {
  const { error } = await supabase.from('trips').delete().eq('id', id)
  if (error) throw error
}

/** 稳定种子键：年份+时段+目的地。跟 004 迁移里 (user_id, seed_key) 的部分唯一索引对应。 */
export function seedKeyFor(t: { year: number; slot: string; destination: string }): string {
  return `${t.year}-${t.slot}-${t.destination}`
}

function mapSeedStatus(s: PlanTrip['status']): TripStatusDb {
  // travelPlan.json 里只有 done/planned 两种值，没有 booked（"已订"目前只出现在 period_hint 文案里，原样保留，不做状态映射）。
  return s === 'done' ? 'done' : 'planned'
}

function planTripToNewTrip(t: PlanTrip): NewTrip {
  return {
    year: t.year,
    slot: t.slot,
    period_hint: t.period_hint || null,
    destination: t.destination,
    country: t.country || null,
    trip_type: t.type || null, // json 字段名 type → 表字段 trip_type（避免保留字）
    days: t.days,
    status: mapSeedStatus(t.status),
    budget_cny: t.budget_cny,
    budget_stale: t.budget_stale,
    notes: t.notes || null,
    seed_key: seedKeyFor(t),
  }
}

/**
 * 首次打开旅行视图时的一次性种子导入：当前用户在 trips 表里已有行程则跳过（真正的幂等判定）；
 * 否则把 travelPlan.json 的 152 条静态计划整批写入。
 *
 * 注：004 迁移里的唯一索引 trips_user_seedkey 是部分索引（where seed_key is not null）。
 * Postgres 的 ON CONFLICT 列表推断无法命中部分索引（除非在 ON CONFLICT 里重复写出同样的 WHERE 谓词，
 * 而 supabase-js 的 upsert({ onConflict }) 只接受列名、不支持谓词），所以这里不用 upsert，
 * 改用普通 insert + 对 23505（唯一约束冲突，理论上只会发生在并发双开首次种子的极端情况）静默吞掉，
 * 保证幂等性不依赖会在运行时报错的 ON CONFLICT 目标。
 */
export async function seedTripsIfEmpty(): Promise<void> {
  const existing = await listTrips()
  if (existing.length > 0) return
  const plan = travelPlanData as TravelPlanData
  const rows = plan.trips.map(planTripToNewTrip)
  const { error } = await supabase.from('trips').insert(rows)
  if (error) {
    if ((error as { code?: string }).code === '23505') return
    throw error
  }
}

/** 把某条行程改到 newYear 后，同用户同年份下（不含自身）还有几条行程——用于「⚠️同年已有N程」黄标提示。 */
export function countYearConflicts(trips: TripRow[], tripId: string, newYear: number): number {
  return trips.filter((t) => t.id !== tripId && t.year === newYear).length
}

const SLOT_QUARTER: Record<string, number> = { '五一': 2, '十一': 4, '圣诞': 4 }

/** 把 slot 文案（五一/十一/圣诞，或 "3月"/"4月下旬"/"6-7月"/"11-12月" 等）粗略映射到季度 1-4；无法识别返回 null。 */
export function slotToQuarter(slot: string): number | null {
  if (slot in SLOT_QUARTER) return SLOT_QUARTER[slot]
  const m = slot.match(/^(\d{1,2})/)
  if (!m) return null
  const month = Number(m[1])
  if (month < 1 || month > 12) return null
  return Math.floor((month - 1) / 3) + 1
}

/** 今年当季（now 所在季度）状态为 planned/booked 的行程——首页/旅行视图「本季计划」提醒用。 */
export function currentQuarterTrips(trips: TripRow[], now: Date): TripRow[] {
  const year = now.getFullYear()
  const quarter = Math.floor(now.getMonth() / 3) + 1
  return trips.filter(
    (t) => t.year === year && slotToQuarter(t.slot) === quarter && (t.status === 'planned' || t.status === 'booked'),
  )
}
