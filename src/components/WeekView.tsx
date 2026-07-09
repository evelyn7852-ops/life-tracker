import { useCallback, useEffect, useState } from 'react'
import { listEntries } from '../lib/entriesRepo'
import { ALL_DOMAINS, DOMAIN_LABEL, type Entry } from '../lib/types'

function weekStart(): Date {
  const d = new Date(); const day = (d.getDay() + 6) % 7 // 周一起
  d.setDate(d.getDate() - day); d.setHours(0, 0, 0, 0); return d
}

export function WeekView({ refreshKey }: { refreshKey: number }) {
  const [rows, setRows] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true)
    setRows(await listEntries({ fromTs: weekStart().toISOString(), limit: 500 }))
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load, refreshKey])

  const counts = ALL_DOMAINS.map((d) => ({ d, n: rows.filter((r) => r.domain === d).length }))
  const max = Math.max(1, ...counts.map((c) => c.n))
  const days = new Set(rows.map((r) => new Date(r.ts).toDateString()))

  return (
    <div className="view">
      {loading && <p className="muted empty">加载中…</p>}
      {!loading && (
        <>
          <p className="muted">本周记录 {rows.length} 条 · 活跃 {days.size} 天</p>
          {counts.map(({ d, n }) => (
            <div key={d} className="bar-row">
              <span className="bar-label">{DOMAIN_LABEL[d]}</span>
              <div className="bar-track"><div className={`bar dot-${d}`} style={{ width: `${(n / max) * 100}%` }} /></div>
              <span className="bar-n">{n}</span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
