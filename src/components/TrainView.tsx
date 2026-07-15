import { useCallback, useEffect, useRef, useState } from 'react'
import exercisesData from '../data/exercises.json'
import templatesData from '../data/workoutTemplates.json'
import { generateWorkout, type GenerateDirection } from '../lib/generateWorkout'
import { archiveWorkout, deleteWorkout, insertWorkout, listWorkouts } from '../lib/workoutRepo'
import type { Exercise, ExerciseCategory, Workout, WorkoutBlock, WorkoutTemplate } from '../lib/types'

const exercises = exercisesData as Exercise[]
const templates = templatesData as WorkoutTemplate[]
const exerciseName = (id: string): string => exercises.find((e) => e.id === id)?.name ?? id

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function todayStr(): string {
  return dateStr(new Date())
}

function daysAgoStr(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return dateStr(d)
}

function blockLabel(b: WorkoutBlock): string {
  const parts: string[] = []
  if (b.sets) parts.push(`${b.sets}组`)
  if (b.reps) parts.push(`${b.reps}次`)
  if (b.duration) parts.push(`${b.duration}秒`)
  if (b.distance) parts.push(`${b.distance}米`)
  return `${exerciseName(b.exerciseId)} ${parts.join('×')}`
}

type Section = 'today' | 'library' | 'exercises'

const GENERATE_DIRECTIONS: { key: GenerateDirection; label: string }[] = [
  { key: 'hyrox', label: '生成 Hyrox' },
  { key: 'crossfit', label: '生成 CrossFit' },
  { key: '力量', label: '生成力量' },
]

function buildRecent(rows: Workout[]): { date: string; title: string; exerciseIds: string[] }[] {
  return rows.map((w) => ({ date: w.date, title: w.title, exerciseIds: w.blocks.map((b) => b.exerciseId) }))
}

function GenerateEmptyState({ onScheduled }: { onScheduled: () => void }) {
  const [busy, setBusy] = useState<GenerateDirection | null>(null)
  const [draft, setDraft] = useState<{ title: string; blocks: WorkoutBlock[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async (direction: GenerateDirection) => {
    setBusy(direction)
    setError(null)
    try {
      const today = todayStr()
      const recentRows = await listWorkouts({ fromDate: daysAgoStr(14), toDate: today })
      const result = await generateWorkout(direction, today, buildRecent(recentRows))
      setDraft(result)
    } catch {
      setError('生成失败，请重试')
    } finally {
      setBusy(null)
    }
  }

  const confirm = async (date: string, blocks: WorkoutBlock[]) => {
    if (!draft) return
    await insertWorkout({ date, template_id: null, title: draft.title, blocks, status: 'planned', performed: null })
    setDraft(null)
    onScheduled()
  }

  if (draft) {
    return (
      <div className="card">
        <div className="card-head">
          <span className="card-domain">{draft.title}</span>
        </div>
        <ScheduleForm initialBlocks={draft.blocks} onCancel={() => setDraft(null)} onConfirm={confirm} />
      </div>
    )
  }

  return (
    <div className="train-generate">
      <div className="train-actions">
        {GENERATE_DIRECTIONS.map((d) => (
          <button key={d.key} onClick={() => handleGenerate(d.key)} disabled={busy !== null}>
            {busy === d.key ? '生成中…' : d.label}
          </button>
        ))}
      </div>
      {error && <p className="muted">{error}</p>}
    </div>
  )
}

function TodayPlan({ rows, loading, onArchive, onDelete, onScheduled }: {
  rows: Workout[]; loading: boolean
  onArchive: (w: Workout) => void; onDelete: (id: string) => void
  onScheduled: () => void
}) {
  return (
    <div className="view">
      {loading && rows.length === 0 && <p className="muted empty">加载中…</p>}
      {!loading && rows.length === 0 && (
        <>
          <p className="muted empty">今天还没有排课，去课表库选一个吧</p>
          <GenerateEmptyState onScheduled={onScheduled} />
        </>
      )}
      {rows.map((w) => (
        <div key={w.id} className="card">
          <div className="card-head">
            <span className="card-domain">{w.title}</span>
            <span className="card-time">{w.status === 'done' ? '已完成' : '计划中'}</span>
          </div>
          <p className="card-text">{w.blocks.map(blockLabel).join('，')}</p>
          {w.status !== 'done' && (
            <div className="train-actions">
              <button onClick={() => onArchive(w)}>完成</button>
              <button className="card-del" onClick={() => onDelete(w.id)}>删</button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function ScheduleForm({ initialBlocks, onCancel, onConfirm }: {
  initialBlocks: WorkoutBlock[]
  onCancel: () => void
  onConfirm: (date: string, blocks: WorkoutBlock[]) => void
}) {
  const [date, setDate] = useState(todayStr())
  const [blocks, setBlocks] = useState<WorkoutBlock[]>(initialBlocks)

  const removeBlock = (i: number) => setBlocks((bs) => bs.filter((_, idx) => idx !== i))

  return (
    <div className="train-schedule">
      <label className="train-date-label">
        日期
        <input aria-label="日期" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <ul className="train-block-list">
        {blocks.map((b, i) => (
          <li key={`${b.exerciseId}-${i}`}>
            <span>{blockLabel(b)}</span>
            <button aria-label="移除动作" onClick={() => removeBlock(i)}>✕</button>
          </li>
        ))}
      </ul>
      <div className="train-actions">
        <button onClick={() => onConfirm(date, blocks)} disabled={blocks.length === 0}>确认排课</button>
        <button onClick={onCancel}>取消</button>
      </div>
    </div>
  )
}

function TemplateLibrary({ onScheduled }: { onScheduled: () => void }) {
  const [schedulingId, setSchedulingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const confirm = async (t: WorkoutTemplate, date: string, blocks: WorkoutBlock[]) => {
    setSavingId(t.id)
    try {
      await insertWorkout({ date, template_id: t.id, title: t.name, blocks, status: 'planned', performed: null })
      setSchedulingId(null)
      onScheduled()
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="view">
      {templates.map((t) => (
        <div key={t.id} className="card">
          <div className="card-head">
            <span className="card-domain">{t.name}</span>
            <span className="card-time">{t.style}</span>
          </div>
          {t.notes && <p className="muted">{t.notes}</p>}
          <p className="card-text">{t.blocks.map(blockLabel).join('，')}</p>
          {schedulingId === t.id ? (
            <ScheduleForm
              initialBlocks={t.blocks}
              onCancel={() => setSchedulingId(null)}
              onConfirm={(date, blocks) => confirm(t, date, blocks)}
            />
          ) : (
            <div className="train-actions">
              <button onClick={() => setSchedulingId(t.id)} disabled={savingId === t.id}>排入</button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

const EXERCISE_CATEGORIES: ExerciseCategory[] = ['力量', 'Hyrox']

function ExerciseLibrary() {
  const [selected, setSelected] = useState<Exercise | null>(null)
  const [openCategory, setOpenCategory] = useState<ExerciseCategory | null>(null)
  return (
    <div className="view">
      {EXERCISE_CATEGORIES.map((cat) => {
        const items = exercises.filter((e) => e.category === cat)
        const open = openCategory === cat
        return (
          <div key={cat} className="card train-accordion">
            <button
              className="train-accordion-head"
              aria-expanded={open}
              onClick={() => setOpenCategory(open ? null : cat)}
            >
              <span className="card-domain">{cat}</span>
              <span className="muted">{open ? '收起' : `展开（${items.length}）`}</span>
            </button>
            {open && (
              <ul className="train-exercise-list">
                {items.map((e) => (
                  <li key={e.id}>
                    <button className="train-exercise-item" onClick={() => setSelected(e)}>{e.name}</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
      {selected && (
        <div className="card train-exercise-detail">
          <div className="card-head">
            <span className="card-domain">{selected.name}</span>
          </div>
          <p className="muted">{selected.muscles.join(' · ')}</p>
          <p className="section-title">要点</p>
          <ul>{selected.cues.map((c, i) => <li key={i}>{c}</li>)}</ul>
          <p className="section-title">常见错误</p>
          <ul>{selected.mistakes.map((m, i) => <li key={i}>{m}</li>)}</ul>
          <a href={selected.videoUrl} target="_blank" rel="noreferrer">观看教学视频</a>
        </div>
      )}
    </div>
  )
}

export function TrainView({ refreshKey, active }: { refreshKey: number; active: boolean }) {
  const [section, setSection] = useState<Section>('today')
  const [rows, setRows] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)
  const lastFetched = useRef(-1)

  const load = useCallback(async () => {
    setLoading(true)
    const today = todayStr()
    setRows(await listWorkouts({ fromDate: today, toDate: today }))
    setLoading(false)
  }, [])

  useEffect(() => {
    if (active && lastFetched.current !== refreshKey) {
      lastFetched.current = refreshKey
      load()
    }
  }, [active, refreshKey, load])

  const handleArchive = async (w: Workout) => { await archiveWorkout(w); load() }
  const handleDelete = async (id: string) => {
    if (confirm('删除这条计划？')) { await deleteWorkout(id); load() }
  }

  return (
    <div className="view">
      <p className="view-title">训练</p>
      <div className="summary-tabs">
        <button className={section === 'today' ? 'on' : ''} onClick={() => setSection('today')}>今日计划</button>
        <button className={section === 'library' ? 'on' : ''} onClick={() => setSection('library')}>课表库</button>
        <button className={section === 'exercises' ? 'on' : ''} onClick={() => setSection('exercises')}>动作库</button>
      </div>
      {section === 'today' && (
        <TodayPlan rows={rows} loading={loading} onArchive={handleArchive} onDelete={handleDelete} onScheduled={load} />
      )}
      {section === 'library' && <TemplateLibrary onScheduled={load} />}
      {section === 'exercises' && <ExerciseLibrary />}
    </div>
  )
}
