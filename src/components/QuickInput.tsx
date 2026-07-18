import { useMemo, useState } from 'react'
import { parseEntry } from '../lib/parser'
import { saveEntry } from '../lib/outbox'
import { ALL_DOMAINS, DOMAIN_LABEL, type Domain, type NewEntry, type ParseResult } from '../lib/types'
import { llmParse } from '../lib/llmParse'

function summarize(r: ParseResult): string {
  const d = r.data as Record<string, unknown>
  const parts: string[] = []
  if (d.meal) parts.push(`${d.meal}餐`)
  if (Array.isArray(d.items)) parts.push((d.items as string[]).join('、'))
  if (d.type) parts.push(String(d.type))
  if (d.duration_min) parts.push(`${d.duration_min} 分钟`)
  if (Array.isArray(d.sets)) parts.push((d.sets as { exercise: string; weight_kg?: number; sets: number; reps: number }[]).map((s) => `${s.exercise} ${s.weight_kg ?? ''}kg ${s.sets}x${s.reps}`).join('；'))
  if (d.title) parts.push(String(d.title))
  if (d.pages) parts.push(`${d.pages} 页`)
  if (d.course) parts.push(String(d.course))
  if (d.minutes) parts.push(`${d.minutes} 分钟`)
  if (d.place) parts.push(String(d.place))
  return parts.join(' · ')
}

export function QuickInput({ onSaved }: { onSaved: () => void }) {
  const [text, setText] = useState('')
  const [llmResult, setLlmResult] = useState<ParseResult | null>(null)
  const [llmBusy, setLlmBusy] = useState(false)
  const [status, setStatus] = useState('')

  const ruleResult = useMemo(() => parseEntry(text), [text])
  const result = ruleResult ?? llmResult

  const save = async (r: ParseResult | null, manualDomain?: Domain) => {
    const draft: NewEntry = {
      ts: new Date().toISOString(),
      domain: r?.domain ?? manualDomain!,
      raw_text: text.trim(),
      data: r?.data ?? {},
      parse_source: r ? (ruleResult ? 'rule' : 'llm') : 'manual',
      tags: [],
    }
    const outcome = await saveEntry(draft)
    setStatus(outcome === 'synced' ? '已保存' : '已离线暂存')
    setText(''); setLlmResult(null)
    onSaved()
    setTimeout(() => setStatus(''), 2000)
  }

  const runLlm = async () => {
    setLlmBusy(true)
    try { setLlmResult(await llmParse(text)) }
    catch { setStatus('AI 解析失败，可手选域保存') }
    finally { setLlmBusy(false) }
  }

  return (
    <div className="qi">
      <input
        placeholder="记一笔…" value={text} enterKeyHint="done"
        onChange={(e) => { setText(e.target.value); setLlmResult(null) }}
      />
      {text.trim() && result && (
        <div className="qi-preview">
          <span className="chip chip-domain">{DOMAIN_LABEL[result.domain]}</span>
          <span className="qi-summary">{summarize(result)}</span>
          <button className="btn-primary" onClick={() => save(result)}>保存</button>
        </div>
      )}
      {text.trim() && !result && (
        <div className="qi-preview">
          <button className="chip" onClick={runLlm} disabled={llmBusy}>{llmBusy ? '解析中…' : 'AI 解析'}</button>
          {ALL_DOMAINS.map((d) => (
            <button key={d} className="chip" onClick={() => save(null, d)}>{DOMAIN_LABEL[d]}</button>
          ))}
        </div>
      )}
      {status && <p className="muted">{status}</p>}
    </div>
  )
}
