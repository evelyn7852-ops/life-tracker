import { useCallback, useEffect, useRef, useState } from 'react'
import exercisesData from '../data/exercises.json'
import templatesData from '../data/workoutTemplates.json'
import { archiveWorkout, deleteWorkout, insertWorkout, listWorkouts } from '../lib/workoutRepo'
import type { Exercise, Workout, WorkoutBlock, WorkoutTemplate } from '../lib/types'

const exercises = exercisesData as Exercise[]
const templates = templatesData as WorkoutTemplate[]
const exerciseName = (id: string): string => exercises.find((e) => e.id === id)?.name ?? id

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

function TodayPlan({ rows, loading, onArchive, onDelete }: {
  rows: Workout[]; loading: boolean
  onArchive: (w: Workout) => void; onDelete: (id: string) => void
}) {
  return (
    <div className="view">
      {loading && rows.length === 0 && <p className="muted empty">加载中…</p>}
      {!loading && rows.length === 0 && <p className="muted empty">今天还没有排课，去课表库选一个吧</p>}
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

function ScheduleForm({ template, onCancel, onConfirm }: {
  template: WorkoutTemplate
  onCancel: () => void
  onConfirm: (date: string, blocks: WorkoutBlock[]) => void
}) {
  const [date, setDate] = useState(todayStr())
  const [blocks, setBlocks] = useState<WorkoutBlock[]>(template.blocks)

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
              template={t}
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

function ExerciseLibrary() {
  const [selected, setSelected] = useState<Exercise | null>(null)
  return (
    <div className="view">
      <ul className="train-exercise-list">
        {exercises.map((e) => (
          <li key={e.id}>
            <button className="train-exercise-item" onClick={() => setSelected(e)}>{e.name}</button>
          </li>
        ))}
      </ul>
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
        <TodayPlan rows={rows} loading={loading} onArchive={handleArchive} onDelete={handleDelete} />
      )}
      {section === 'library' && <TemplateLibrary onScheduled={load} />}
      {section === 'exercises' && <ExerciseLibrary />}
    </div>
  )
}
