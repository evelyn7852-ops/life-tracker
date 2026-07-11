import { useCallback, useEffect, useRef, useState } from 'react'
import { getAlmanacEvent } from '../lib/almanac'
import { isSameDay, isSameMonth, monthMatrix } from '../lib/calendarGrid'
import { listEntries } from '../lib/entriesRepo'
import { ALL_DOMAINS, type Entry } from '../lib/types'
import { DayDetail } from './DayDetail'

const WEEKDAY_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const MAX_DOTS = 3

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function monthBounds(year: number, month: number): { fromTs: string; toTs: string } {
  const from = new Date(year, month, 1)
  const to = new Date(year, month + 1, 1)
  return { fromTs: from.toISOString(), toTs: to.toISOString() }
}

export function CalendarView({ active, initialDate }: { active: boolean; initialDate?: Date }) {
  const base = initialDate ?? new Date()
  const [viewYear, setViewYear] = useState(base.getFullYear())
  const [viewMonth, setViewMonth] = useState(base.getMonth())
  const [entries, setEntries] = useState<Entry[]>([])
  const [selected, setSelected] = useState<Date | null>(null)
  const lastFetched = useRef('')

  const load = useCallback(async (year: number, month: number) => {
    const { fromTs, toTs } = monthBounds(year, month)
    setEntries(await listEntries({ fromTs, toTs, limit: 1000 }))
  }, [])

  useEffect(() => {
    const key = `${viewYear}-${viewMonth}`
    if (active && lastFetched.current !== key) {
      lastFetched.current = key
      load(viewYear, viewMonth)
    }
  }, [active, viewYear, viewMonth, load])

  const domainsByDay = new Map<string, Set<string>>()
  for (const e of entries) {
    const k = dayKey(new Date(e.ts))
    if (!domainsByDay.has(k)) domainsByDay.set(k, new Set())
    domainsByDay.get(k)!.add(e.domain)
  }

  const goPrev = () => {
    const d = new Date(viewYear, viewMonth - 1, 1)
    setViewYear(d.getFullYear()); setViewMonth(d.getMonth())
  }
  const goNext = () => {
    const d = new Date(viewYear, viewMonth + 1, 1)
    setViewYear(d.getFullYear()); setViewMonth(d.getMonth())
  }

  const today = new Date()
  const weeks = monthMatrix(viewYear, viewMonth)

  return (
    <div className="cal">
      <div className="cal-head">
        <button aria-label="上个月" onClick={goPrev}>‹</button>
        <p className="cal-title">{viewYear}年{viewMonth + 1}月</p>
        <button aria-label="下个月" onClick={goNext}>›</button>
      </div>
      <div className="cal-weekdays">
        {WEEKDAY_ZH.map((w) => <span key={w}>{w}</span>)}
      </div>
      <div className="cal-grid">
        {weeks.flat().map((d) => {
          const inMonth = isSameMonth(d, viewYear, viewMonth)
          const domains = ALL_DOMAINS.filter((dom) => domainsByDay.get(dayKey(d))?.has(dom))
          const overflow = domains.length > MAX_DOTS
          const shown = domains.slice(0, MAX_DOTS)
          const event = getAlmanacEvent(d)
          return (
            <button
              key={d.toISOString()}
              className={`cal-day ${inMonth ? '' : 'cal-day-out'} ${isSameDay(d, today) ? 'today' : ''}`}
              onClick={() => setSelected(d)}
            >
              {event && <span className="cal-emoji">{event.emoji}</span>}
              <span className="cal-day-num">{d.getDate()}</span>
              {shown.length > 0 && (
                <span className="cal-dots">
                  {shown.map((dom) => <span key={dom} className={`dot dot-${dom}`} />)}
                  {overflow && <span className="cal-dot-overflow">+</span>}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {selected && (
        <DayDetail
          date={selected}
          onClose={() => setSelected(null)}
          onNavigate={(delta) => setSelected((prev) => {
            const d = new Date(prev ?? selected)
            d.setDate(d.getDate() + delta)
            return d
          })}
        />
      )}
    </div>
  )
}
