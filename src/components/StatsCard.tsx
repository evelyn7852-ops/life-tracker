import { useCallback, useEffect, useRef, useState } from 'react'
import travelPlanData from '../data/travelPlan.json'
import { countEntries, listEntries } from '../lib/entriesRepo'
import { computeStreak, countByDomain, moodSparkline } from '../lib/stats'
import type { TravelPlanData } from '../lib/travelPlan'
import { ALL_DOMAINS, DOMAIN_LABEL, type Entry } from '../lib/types'
import { listWorkouts } from '../lib/workoutRepo'

const travelPlan = travelPlanData as TravelPlanData
const MOOD_DAYS = 14
const RECENT_DAYS = 60 // streak/本月统计共用同一次拉取：覆盖当月全部天数 + 近14天情绪

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function monthStart(d: Date): Date {
  const s = new Date(d); s.setDate(1); s.setHours(0, 0, 0, 0); return s
}

export function StatsCard({ refreshKey, active }: { refreshKey: number; active: boolean }) {
  const [recentEntries, setRecentEntries] = useState<Entry[]>([])
  const [workoutDoneCount, setWorkoutDoneCount] = useState(0)
  const [yearTotal, setYearTotal] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const lastFetched = useRef(-1)

  const load = useCallback(async () => {
    const now = new Date()
    const from60 = new Date(now); from60.setDate(from60.getDate() - RECENT_DAYS)
    const mStart = monthStart(now)
    const mEndExclusive = new Date(mStart); mEndExclusive.setMonth(mEndExclusive.getMonth() + 1)
    const mEndInclusive = new Date(mEndExclusive.getTime() - 86400000)
    const yStart = new Date(now.getFullYear(), 0, 1)
    const yEndExclusive = new Date(now.getFullYear() + 1, 0, 1)

    const [entries, workouts, total] = await Promise.all([
      listEntries({ fromTs: from60.toISOString(), limit: 1000 }),
      listWorkouts({ fromDate: toDateStr(mStart), toDate: toDateStr(mEndInclusive) }),
      countEntries(yStart.toISOString(), yEndExclusive.toISOString()),
    ])
    setRecentEntries(entries)
    setWorkoutDoneCount(workouts.filter((w) => w.status === 'done').length)
    setYearTotal(total)
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (active && lastFetched.current !== refreshKey) {
      lastFetched.current = refreshKey
      load()
    }
  }, [active, refreshKey, load])

  if (!loaded) {
    return <div className="card stats-card"><p className="muted">统计加载中…</p></div>
  }

  const now = new Date()
  const mStart = monthStart(now)
  const monthEntries = recentEntries.filter((e) => new Date(e.ts) >= mStart)
  const domainCounts = countByDomain(monthEntries)
  const entryDates = [...new Set(recentEntries.map((e) => toDateStr(new Date(e.ts))))]
  const streak = computeStreak(entryDates, now)
  const sparkline = moodSparkline(recentEntries, MOOD_DAYS, now)
  const currentYear = now.getFullYear()
  const tripsDone = travelPlan.trips.filter((t) => t.year === currentYear && t.status === 'done').length

  return (
    <div className="card stats-card">
      <p className="stats-streak">🔥 连续 {streak} 天 <span className="muted">· 本月 {monthEntries.length} 条</span></p>
      <div className="stats-domains">
        {ALL_DOMAINS.map((d) => (
          <span key={d} className="stats-domain-chip">
            <span className={`dot dot-${d}`} />{DOMAIN_LABEL[d]} {domainCounts[d]}
          </span>
        ))}
      </div>
      <div className="stats-mood-row">
        <span className="muted">情绪近14天</span>
        <span className="stats-mood-sparkline">
          {sparkline.map((m, i) => <span key={i} className="stats-mood-dot">{m ?? '·'}</span>)}
        </span>
      </div>
      <p className="muted stats-yearly">
        今年共记录 {yearTotal} 条 · 本月阅读 {domainCounts.reading} 条 · 本月训练完成 {workoutDoneCount} 次 · 本年旅行 {tripsDone} 程（来自旅行规划）
      </p>
    </div>
  )
}
