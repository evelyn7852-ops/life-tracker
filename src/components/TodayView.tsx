import { useCallback, useEffect, useState } from 'react'
import { listEntries } from '../lib/entriesRepo'
import { ALL_DOMAINS, DOMAIN_LABEL, type Entry } from '../lib/types'
import { EntryCard } from './EntryCard'

function dayRange(d = new Date()): { fromTs: string; toTs: string } {
  const start = new Date(d); start.setHours(0, 0, 0, 0)
  const end = new Date(start); end.setDate(end.getDate() + 1)
  return { fromTs: start.toISOString(), toTs: end.toISOString() }
}

export function TodayView({ refreshKey }: { refreshKey: number }) {
  const [rows, setRows] = useState<Entry[]>([])
  const load = useCallback(async () => {
    setRows(await listEntries({ ...dayRange(), limit: 100 }))
  }, [])
  useEffect(() => { load() }, [load, refreshKey])

  const done = new Set(rows.map((r) => r.domain))
  return (
    <div className="view">
      <div className="day-dots">
        {ALL_DOMAINS.map((d) => (
          <span key={d} className={`day-dot ${done.has(d) ? `dot-${d} on` : ''}`} title={DOMAIN_LABEL[d]}>
            {DOMAIN_LABEL[d]}
          </span>
        ))}
      </div>
      {rows.length === 0 && <p className="muted empty">今天还没记录</p>}
      {rows.map((e) => <EntryCard key={e.id} entry={e} onChanged={load} />)}
    </div>
  )
}
