import { ALL_DOMAINS, type Domain, type Entry, type JournalData } from './types'

/** 本地时区 YYYY-MM-DD。 */
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(d: Date, delta: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + delta)
  return next
}

/**
 * 连续记录天数（streak）。entryDates 为有 ≥1 条 entry 的本地日期（YYYY-MM-DD，可乱序/重复）。
 * 选择：若今天还没有记录，不直接归零——从昨天开始往回数连续天数，这样清晨打开 app 时不会先看到 0。
 * 若今天已有记录，从今天开始往回数。中间出现缺口即停止。
 */
export function computeStreak(entryDates: string[], today: Date): number {
  const set = new Set(entryDates)
  const todayStr = toDateStr(today)
  const cursor = set.has(todayStr) ? new Date(today) : addDays(today, -1)
  if (!set.has(toDateStr(cursor))) return 0

  let streak = 0
  let d = cursor
  while (set.has(toDateStr(d))) {
    streak++
    d = addDays(d, -1)
  }
  return streak
}

/** 给定（已按范围筛好的）entry 列表，按域计数。 */
export function countByDomain(entries: Entry[]): Record<Domain, number> {
  const result = Object.fromEntries(ALL_DOMAINS.map((d) => [d, 0])) as Record<Domain, number>
  for (const e of entries) result[e.domain]++
  return result
}

/** 近 N 天（含 today，含空位）journal mood emoji 一行 sparkline，缺失日为 null，同日取最新一条。 */
export function moodSparkline(journalEntries: Entry[], days: number, today: Date): (string | null)[] {
  const latestByDay = new Map<string, { ts: string; mood: string }>()
  for (const e of journalEntries) {
    if (e.domain !== 'journal') continue
    const mood = (e.data as JournalData).mood
    if (!mood) continue
    const key = toDateStr(new Date(e.ts))
    const prev = latestByDay.get(key)
    if (!prev || e.ts > prev.ts) latestByDay.set(key, { ts: e.ts, mood })
  }

  const start = addDays(today, -(days - 1))
  const out: (string | null)[] = []
  for (let i = 0; i < days; i++) {
    const key = toDateStr(addDays(start, i))
    out.push(latestByDay.get(key)?.mood ?? null)
  }
  return out
}
