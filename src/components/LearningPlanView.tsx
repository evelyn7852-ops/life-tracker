import { useState } from 'react'
import learningPlanData from '../data/learningPlan.json'
import {
  loadProgress, toggleProgress,
  type BuildItem, type LearnItem, type LearningPlanData, type ProgressState, type ShipItem,
} from '../lib/learningPlan'

const data = learningPlanData as LearningPlanData

const SECTION_LABEL: Record<'learn' | 'build' | 'ship', string> = {
  learn: '学 LEARN', build: '练 BUILD', ship: '交 SHIP',
}

function WeekSection({ weekN, section, items, progress, onToggle }: {
  weekN: number
  section: 'learn' | 'build' | 'ship'
  items: (LearnItem | BuildItem | ShipItem)[]
  progress: ProgressState
  onToggle: (id: string) => void
}) {
  if (items.length === 0) return null
  return (
    <div className="plan-week-section">
      <p className="plan-week-section-title">{SECTION_LABEL[section]}</p>
      <ul className="plan-check-list">
        {items.map((it, i) => {
          const id = `w${weekN}-${section}-${i}`
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

export function LearningPlanView({ onClose }: { onClose: () => void }) {
  const [progress, setProgress] = useState<ProgressState>(() => loadProgress())
  const [openWeek, setOpenWeek] = useState<number | null>(1)
  const [openSetup, setOpenSetup] = useState(false)

  const toggle = (id: string) => setProgress((p) => toggleProgress(p, id))

  return (
    <div className="day-detail-overlay" onClick={onClose}>
      <div className="day-detail-sheet plan-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="day-detail-head">
          <p className="day-detail-title">学习规划</p>
          <button aria-label="关闭" className="day-detail-close" onClick={onClose}>✕</button>
        </div>
        <p className="muted plan-note">进度存本设备浏览器，若之前在同一浏览器打开过原集训台，勾选可能已带入；云同步待 V1.5</p>
        <div className="day-detail-body">
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
              <ul className="plan-check-list">
                {data.setup.map((t, i) => {
                  const id = `setup-${i}`
                  const done = !!progress[id]
                  return (
                    <li key={id}>
                      <label>
                        <input type="checkbox" checked={done} onChange={() => toggle(id)} />
                        <span className={done ? 'plan-item-done' : ''}>{t}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
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
                <ul className="plan-check-list">
                  {ph.takeaways.map((t, i) => {
                    const id = `m${ph.p}-${i}`
                    const done = !!progress[id]
                    return (
                      <li key={id}>
                        <label>
                          <input type="checkbox" checked={done} onChange={() => toggle(id)} />
                          <span className={done ? 'plan-item-done' : ''}>{t}</span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
