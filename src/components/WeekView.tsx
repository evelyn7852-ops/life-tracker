import { useCallback, useEffect, useRef, useState } from 'react'
import { listEntries } from '../lib/entriesRepo'
import { generateSummary, getSummary, type PeriodType, type Summary } from '../lib/summaryRepo'
import { ALL_DOMAINS, DOMAIN_LABEL, type Entry } from '../lib/types'

export function weekStart(d: Date = new Date()): Date {
  const start = new Date(d)
  start.setDate(start.getDate() - start.getDay()) // 周日起
  start.setHours(0, 0, 0, 0)
  return start
}

function toShortDateStr(d: Date): string {
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

/** 「7月5日–7月11日」 */
export function weekRangeLabel(d: Date = new Date()): string {
  const start = weekStart(d)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return `${toShortDateStr(start)}–${toShortDateStr(end)}`
}

function monthStart(): Date {
  const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function periodStart(type: PeriodType): string {
  return toDateStr(type === 'week' ? weekStart() : monthStart())
}

/** 本地时区周期 ISO 边界 [from, to)，随请求发给 summarize 供 entries 查询直接使用。 */
function periodBounds(type: PeriodType): { fromTs: string; toTs: string } {
  const start = type === 'week' ? weekStart() : monthStart()
  const end = new Date(start)
  if (type === 'week') end.setDate(end.getDate() + 7)
  else end.setMonth(end.getMonth() + 1)
  return { fromTs: start.toISOString(), toTs: end.toISOString() }
}

export function WeekView({ refreshKey, active }: { refreshKey: number; active: boolean }) {
  const [rows, setRows] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const lastFetched = useRef(-1)
  const load = useCallback(async () => {
    setLoading(true)
    setRows(await listEntries({ fromTs: weekStart().toISOString(), limit: 500 }))
    setLoading(false)
  }, [])
  useEffect(() => {
    if (active && lastFetched.current !== refreshKey) {
      lastFetched.current = refreshKey
      load()
    }
  }, [active, refreshKey, load])

  const [summaryType, setSummaryType] = useState<PeriodType>('week')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  const loadSummary = useCallback(async (type: PeriodType) => {
    setSummaryLoading(true)
    setSummaryError(null)
    try {
      setSummary(await getSummary(type, periodStart(type)))
    } catch {
      setSummaryError('加载总结失败')
    } finally {
      setSummaryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (active) loadSummary(summaryType)
  }, [active, summaryType, loadSummary])

  const handleGenerate = async () => {
    setGenerating(true)
    setSummaryError(null)
    try {
      const { fromTs, toTs } = periodBounds(summaryType)
      const content = await generateSummary(summaryType, periodStart(summaryType), fromTs, toTs)
      setSummary({ id: '', period_type: summaryType, period_start: periodStart(summaryType), content, created_at: new Date().toISOString() })
    } catch {
      setSummaryError('生成失败，请重试')
    } finally {
      setGenerating(false)
    }
  }

  const counts = ALL_DOMAINS.map((d) => ({ d, n: rows.filter((r) => r.domain === d).length }))
  const max = Math.max(1, ...counts.map((c) => c.n))
  const days = new Set(rows.map((r) => new Date(r.ts).toDateString()))
  const periodLabel = summaryType === 'week' ? '本周' : '本月'

  return (
    <div className="view">
      <p className="view-title">周览 {weekRangeLabel()}</p>
      {loading && rows.length === 0 ? (
        <p className="muted empty">加载中…</p>
      ) : (
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

      <div className="summary-section">
        <p className="section-title">AI 总结</p>
        <div className="summary-tabs">
          <button className={summaryType === 'week' ? 'on' : ''} onClick={() => setSummaryType('week')}>本周</button>
          <button className={summaryType === 'month' ? 'on' : ''} onClick={() => setSummaryType('month')}>本月</button>
        </div>
        {summaryLoading && <p className="muted">加载中…</p>}
        {!summaryLoading && generating && <p className="muted">生成中…</p>}
        {!summaryLoading && !generating && summary && (
          <>
            <div className="summary-content">
              {summary.content.split('\n').filter((line) => line.trim()).map((line, i) => <p key={i}>{line}</p>)}
            </div>
            <div className="summary-actions">
              <button onClick={handleGenerate}>重新生成</button>
            </div>
          </>
        )}
        {!summaryLoading && !generating && !summary && (
          <div className="summary-empty">
            <button onClick={handleGenerate}>生成{periodLabel}总结</button>
          </div>
        )}
        {summaryError && <p className="muted">{summaryError}</p>}
      </div>
    </div>
  )
}
