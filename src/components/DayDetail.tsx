import { useEffect, useState } from 'react'
import { listEntries } from '../lib/entriesRepo'
import type { Entry } from '../lib/types'
import { EntryCard } from './EntryCard'

const WEEKDAY_ZH = ['日', '一', '二', '三', '四', '五', '六']

function dayBounds(d: Date): { fromTs: string; toTs: string } {
  const from = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const to = new Date(from)
  to.setDate(to.getDate() + 1)
  return { fromTs: from.toISOString(), toTs: to.toISOString() }
}

export function DayDetail({ date, onClose, onNavigate }: {
  date: Date
  onClose: () => void
  onNavigate: (delta: number) => void
}) {
  const [rows, setRows] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const { fromTs, toTs } = dayBounds(date)
    listEntries({ fromTs, toTs, limit: 200 }).then((data) => {
      if (!cancelled) { setRows(data); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [date])

  return (
    <div className="day-detail-overlay" onClick={onClose}>
      <div className="day-detail-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="day-detail-head">
          <button aria-label="前一天" onClick={() => onNavigate(-1)}>‹</button>
          <p className="day-detail-title">{date.getMonth() + 1}月{date.getDate()}日 周{WEEKDAY_ZH[date.getDay()]}</p>
          <button aria-label="后一天" onClick={() => onNavigate(1)}>›</button>
          <button aria-label="关闭" className="day-detail-close" onClick={onClose}>✕</button>
        </div>
        <div className="day-detail-body">
          {loading && <p className="muted empty">加载中…</p>}
          {!loading && rows.length === 0 && <p className="muted empty">没有记录</p>}
          {!loading && rows.map((e) => <EntryCard key={e.id} entry={e} onChanged={() => {}} readOnly />)}
        </div>
      </div>
    </div>
  )
}
