import { useCallback, useEffect, useRef, useState } from 'react'
import { listEntries } from '../lib/entriesRepo'
import { ALL_DOMAINS, DOMAIN_LABEL, type Domain, type Entry } from '../lib/types'
import { EntryCard } from './EntryCard'

const PAGE = 30

export function HistoryView({ refreshKey, active }: { refreshKey: number; active: boolean }) {
  const [rows, setRows] = useState<Entry[]>([])
  const [domain, setDomain] = useState<Domain | undefined>()
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(true)
  const lastFetched = useRef('')

  const load = useCallback(async (reset: boolean, before?: string) => {
    if (reset) setLoading(true)
    const batch = await listEntries({ domain, limit: PAGE, beforeTs: before })
    setDone(batch.length < PAGE)
    setRows((prev) => reset ? batch : [...prev, ...batch])
    if (reset) setLoading(false)
  }, [domain])

  useEffect(() => {
    const key = `${refreshKey}|${domain ?? ''}` // 域筛选变化也要重拉
    if (active && lastFetched.current !== key) {
      lastFetched.current = key
      load(true)
    }
  }, [active, refreshKey, domain, load])

  let lastDay = ''
  return (
    <div className="view">
      <div className="day-dots">
        <button className={`day-dot ${!domain ? 'on' : ''}`} onClick={() => setDomain(undefined)}>全部</button>
        {ALL_DOMAINS.map((d) => (
          <button key={d} className={`day-dot ${domain === d ? 'on' : ''}`} onClick={() => setDomain(d)}>
            {DOMAIN_LABEL[d]}
          </button>
        ))}
      </div>
      {rows.map((e) => {
        const day = new Date(e.ts).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })
        const header = day !== lastDay ? <h3 className="day-header">{day}</h3> : null
        lastDay = day
        return (
          <div key={e.id}>
            {header}
            <EntryCard entry={e} onChanged={() => load(true)} />
          </div>
        )
      })}
      {!done && !loading && rows.length > 0 && (
        <button className="more" onClick={() => load(false, rows[rows.length - 1].ts)}>加载更多</button>
      )}
      {loading && rows.length === 0 && <p className="muted empty">加载中…</p>}
      {!loading && rows.length === 0 && <p className="muted empty">没有记录</p>}
    </div>
  )
}
