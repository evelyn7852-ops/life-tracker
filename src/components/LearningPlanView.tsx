import { useCallback, useEffect, useRef, useState } from 'react'
import learningPlanData from '../data/learningPlan.json'
import {
  flattenMastery, flattenSetup, flattenWeekSection,
  loadProgress, type BuildItem, type LearnItem, type LearningPlanData, type ProgressState, type ShipItem,
} from '../lib/learningPlan'
import {
  deleteItem, groupByStatus, insertItem, listItems, listProgressRows, migrateLocalProgressIfEmpty,
  setProgress, updateItem,
  type LearningItemRow, type LearningStatus, type NewLearningItem,
} from '../lib/learningRepo'

const data = learningPlanData as LearningPlanData

type Segment = 'stream' | 'archive'

const SECTION_LABEL: Record<'learn' | 'build' | 'ship', string> = {
  learn: '学 LEARN', build: '练 BUILD', ship: '交 SHIP',
}

// ---------- A. 学习流（新）----------

const STATUS_ORDER: LearningStatus[] = ['待读', '在读', '已读']

interface ItemDraft { title: string; url: string; source: string; tag: string; note: string }

const EMPTY_DRAFT: ItemDraft = { title: '', url: '', source: '', tag: '', note: '' }

function AddResourceForm({ onAdded, onCancel }: { onAdded: () => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<ItemDraft>(EMPTY_DRAFT)

  const save = async () => {
    if (!draft.title.trim()) return
    const payload: NewLearningItem = { title: draft.title.trim() }
    if (draft.url.trim()) payload.url = draft.url.trim()
    if (draft.source.trim()) payload.source = draft.source.trim()
    if (draft.tag.trim()) payload.tag = draft.tag.trim()
    if (draft.note.trim()) payload.note = draft.note.trim()
    await insertItem(payload)
    onAdded()
  }

  return (
    <div className="card trip-edit-card">
      <input placeholder="标题（必填）" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
      <input placeholder="链接 URL" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
      <input placeholder="来源" value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} />
      <input placeholder="标签" value={draft.tag} onChange={(e) => setDraft({ ...draft, tag: e.target.value })} />
      <input placeholder="备注" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
      <div className="card-edit">
        <button className="btn-primary" onClick={save}>存</button>
        <button className="btn-secondary" onClick={onCancel}>取消</button>
      </div>
    </div>
  )
}

/**
 * 无 url 的条目（多为 auto 推荐：LLM 常记得资源但记不准链接，服务端探活后置 null）
 * 降级为搜索入口，同 exercises.json 用 B站搜索链接而非视频 id 的既有取舍——搜索必达，死链不可用。
 */
function searchUrl(title: string, source: string | null): string {
  const q = [title, source].filter(Boolean).join(' ')
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`
}

function StreamItemCard({ item, onStatusChange, onDelete }: {
  item: LearningItemRow
  onStatusChange: (id: string, status: LearningStatus) => void
  onDelete: (id: string) => void
}) {
  const remove = () => { if (confirm('删除这条资源？')) onDelete(item.id) }
  const meta = [item.source, item.tag].filter(Boolean).join(' · ')

  return (
    <div className="card stream-item">
      <div className="card-head">
        <span className="card-domain">{item.title}</span>
        {item.added_by === 'auto' && <span className="stream-auto-badge">🤖 推荐</span>}
      </div>
      {meta && <p className="muted">{meta}</p>}
      {item.url
        ? <a className="stream-item-link" href={item.url} target="_blank" rel="noopener noreferrer">打开链接</a>
        : (
          <a
            className="stream-item-link"
            href={searchUrl(item.title, item.source)}
            target="_blank"
            rel="noopener noreferrer"
          >
            搜索
          </a>
        )}
      {item.note && <p className="card-text">{item.note}</p>}
      <div className="summary-tabs stream-status-switch">
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            className={s === item.status ? 'on' : ''}
            disabled={s === item.status}
            onClick={() => onStatusChange(item.id, s)}
          >
            {s}
          </button>
        ))}
      </div>
      <button className="card-del" onClick={remove}>删</button>
    </div>
  )
}

function StreamSection() {
  const [items, setItems] = useState<LearningItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  const reload = useCallback(async () => {
    setItems(await listItems())
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const rows = await listItems()
      if (!cancelled) { setItems(rows); setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [])

  const changeStatus = async (id: string, status: LearningStatus) => { await updateItem(id, { status }); reload() }
  const remove = async (id: string) => { await deleteItem(id); reload() }

  const grouped = groupByStatus(items)

  if (loading) return <p className="muted empty">加载中…</p>

  return (
    <div className="view">
      {STATUS_ORDER.map((s) => (
        <div key={s} className="plan-week-section">
          <p className="plan-week-section-title">{s}（{grouped[s].length}）</p>
          {grouped[s].length === 0
            ? <p className="muted">📭 暂无</p>
            : grouped[s].map((item) => (
              <StreamItemCard key={item.id} item={item} onStatusChange={changeStatus} onDelete={remove} />
            ))}
        </div>
      ))}
      {adding
        ? <AddResourceForm onAdded={async () => { await reload(); setAdding(false) }} onCancel={() => setAdding(false)} />
        : <button className="trip-add-btn" onClick={() => setAdding(true)}>+ 加资源</button>}
    </div>
  )
}

// ---------- B. 集训存档（保留原黑客松 8 周内容，进度改云同步）----------

function SimpleCheckList({ ids, labels, progress, onToggle }: {
  ids: string[]; labels: string[]; progress: ProgressState; onToggle: (id: string) => void
}) {
  return (
    <ul className="plan-check-list">
      {labels.map((label, i) => {
        const id = ids[i]
        const done = !!progress[id]
        return (
          <li key={id}>
            <label>
              <input type="checkbox" checked={done} onChange={() => onToggle(id)} />
              <span className={done ? 'plan-item-done' : ''}>{label}</span>
            </label>
          </li>
        )
      })}
    </ul>
  )
}

function WeekSection({ weekN, section, items, progress, onToggle }: {
  weekN: number
  section: 'learn' | 'build' | 'ship'
  items: (LearnItem | BuildItem | ShipItem)[]
  progress: ProgressState
  onToggle: (id: string) => void
}) {
  if (items.length === 0) return null
  const ids = flattenWeekSection(weekN, section, items).map((f) => f.id)
  return (
    <div className="plan-week-section">
      <p className="plan-week-section-title">{SECTION_LABEL[section]}</p>
      <ul className="plan-check-list">
        {items.map((it, i) => {
          const id = ids[i]
          const done = !!progress[id]
          const link = 'link' in it ? it.link : undefined
          const out = 'out' in it ? it.out : undefined
          return (
            <li key={id}>
              <label>
                <input type="checkbox" checked={done} onChange={() => onToggle(id)} />
                <span className={done ? 'plan-item-done' : ''}>
                  {link ? <a href={link} target="_blank" rel="noreferrer">{it.t}</a> : it.t}
                  {out && <span className="plan-item-out">▸ {out}</span>}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function BootcampArchive() {
  const [progress, setProgressState] = useState<ProgressState>({})
  const [openWeek, setOpenWeek] = useState<number | null>(1)
  const [openSetup, setOpenSetup] = useState(false)
  const [syncHint, setSyncHint] = useState<string | null>(null)
  const initedRef = useRef(false)

  useEffect(() => {
    if (initedRef.current) return
    initedRef.current = true
    const local = loadProgress()
    ;(async () => {
      try {
        await migrateLocalProgressIfEmpty(local)
        const rows = await listProgressRows()
        const next: ProgressState = {}
        for (const r of rows) next[r.item_id] = r.done
        setProgressState(next)
      } catch {
        // 离线打开：本地缓存兜底展示，不崩；等下次联网重试
        setProgressState(local)
      }
    })()
  }, [])

  const toggle = async (id: string) => {
    const next = !progress[id]
    setProgressState((p) => ({ ...p, [id]: next }))
    try {
      await setProgress(id, next)
      setSyncHint(null)
    } catch {
      setProgressState((p) => ({ ...p, [id]: !next }))
      setSyncHint('离线，稍后重试')
    }
  }

  return (
    <>
      {syncHint && <p className="muted stream-sync-hint">{syncHint}</p>}
      <div className="card train-accordion">
        <button
          className="train-accordion-head"
          aria-expanded={openSetup}
          onClick={() => setOpenSetup((v) => !v)}
        >
          <span className="card-domain">环境搭建清单</span>
          <span className="muted">{openSetup ? '收起' : `展开（${data.setup.length}）`}</span>
        </button>
        {openSetup && (
          <SimpleCheckList
            ids={flattenSetup(data.setup).map((f) => f.id)}
            labels={data.setup}
            progress={progress}
            onToggle={toggle}
          />
        )}
      </div>

      {data.phases.map((ph) => (
        <div key={ph.p} className="plan-phase">
          <p className="section-title">Phase {ph.p} · {ph.phase.split('· ')[1] ?? ph.phase}</p>
          {ph.weeks.map((w) => {
            const open = openWeek === w.n
            return (
              <div key={w.n} className="card train-accordion">
                <button
                  className="train-accordion-head"
                  aria-expanded={open}
                  onClick={() => setOpenWeek(open ? null : w.n)}
                >
                  <span className="card-domain">第{w.n}周 · {w.title}</span>
                  <span className="muted">{open ? '收起' : '展开'}</span>
                </button>
                {open && (
                  <div className="plan-week-body">
                    <p className="muted">{w.theme}</p>
                    <WeekSection weekN={w.n} section="learn" items={w.learn} progress={progress} onToggle={toggle} />
                    <WeekSection weekN={w.n} section="build" items={w.build} progress={progress} onToggle={toggle} />
                    <WeekSection weekN={w.n} section="ship" items={w.ship} progress={progress} onToggle={toggle} />
                  </div>
                )}
              </div>
            )
          })}
          <div className="card">
            <p className="card-domain">Phase {ph.p} 掌握度自查</p>
            <SimpleCheckList
              ids={flattenMastery(ph.p, ph.takeaways).map((f) => f.id)}
              labels={ph.takeaways}
              progress={progress}
              onToggle={toggle}
            />
          </div>
        </div>
      ))}
    </>
  )
}

// ---------- 外层：分段切换 ----------

/** 学习规划：V1.7 起内嵌渲染在「规划」tab 的学习 segment 中（不再是可关闭的全屏 overlay）。 */
export function LearningPlanView() {
  const [segment, setSegment] = useState<Segment>('stream')

  return (
    <div className="view">
      <p className="view-title">学习规划</p>
      <div className="summary-tabs">
        <button className={segment === 'stream' ? 'on' : ''} onClick={() => setSegment('stream')}>学习流</button>
        <button className={segment === 'archive' ? 'on' : ''} onClick={() => setSegment('archive')}>集训存档</button>
      </div>
      {segment === 'stream' && <StreamSection />}
      {segment === 'archive' && <BootcampArchive />}
    </div>
  )
}
