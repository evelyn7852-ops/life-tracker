import { useState } from 'react'
import travelPlanData from '../data/travelPlan.json'
import { formatBudget, groupTripsByYear, orderGroupsCurrentFirst, type TravelPlanData } from '../lib/travelPlan'

const data = travelPlanData as TravelPlanData

export function TravelPlanView({ onClose }: { onClose: () => void }) {
  const currentYear = new Date().getFullYear()
  const groups = orderGroupsCurrentFirst(groupTripsByYear(data.trips), currentYear)
  const [openYears, setOpenYears] = useState<Set<number>>(new Set([currentYear]))
  const [showExcluded, setShowExcluded] = useState(false)
  const [showUnscheduled, setShowUnscheduled] = useState(false)

  const toggleYear = (year: number) => {
    setOpenYears((prev) => {
      const next = new Set(prev)
      if (next.has(year)) next.delete(year)
      else next.add(year)
      return next
    })
  }

  return (
    <div className="day-detail-overlay" onClick={onClose}>
      <div className="day-detail-sheet plan-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="day-detail-head">
          <p className="day-detail-title">旅行规划</p>
          <button aria-label="关闭" className="day-detail-close" onClick={onClose}>✕</button>
        </div>
        <p className="muted plan-note">粒度为「五一/十一/圣诞」季度级，日历不做日级映射</p>
        <div className="day-detail-body">
          {groups.map((g) => {
            const open = openYears.has(g.year)
            return (
              <div key={g.year} className="card train-accordion">
                <button
                  className="train-accordion-head"
                  aria-expanded={open}
                  onClick={() => toggleYear(g.year)}
                >
                  <span className="card-domain">{g.year}年{g.year === currentYear ? '（当前）' : ''}</span>
                  <span className="muted">{open ? '收起' : `展开（${g.trips.length}）`}</span>
                </button>
                {open && (
                  <ul className="plan-trip-list">
                    {g.trips.map((t, i) => (
                      <li key={i} className="plan-trip-card">
                        <div className="plan-trip-head">
                          <span>{t.slot}{t.period_hint ? ` · ${t.period_hint}` : ''}</span>
                          {t.status === 'done' && <span className="plan-trip-done" aria-label="已完成">✓</span>}
                        </div>
                        <p className="card-text">{t.destination}</p>
                        <p className="muted">
                          {t.country}
                          {t.days ? ` · ${t.days}天` : ''}
                          {' · '}
                          {formatBudget(t.budget_cny, t.budget_stale)}
                        </p>
                        {t.notes && <p className="muted">{t.notes}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}

          <div className="card train-accordion">
            <button
              className="train-accordion-head"
              aria-expanded={showExcluded}
              onClick={() => setShowExcluded((v) => !v)}
            >
              <span className="card-domain muted">已排除清单</span>
              <span className="muted">{showExcluded ? '收起' : `展开（${data.excluded_destinations.length}）`}</span>
            </button>
            {showExcluded && <p className="muted plan-excluded">{data.excluded_destinations.join('、')}</p>}
          </div>

          <div className="card train-accordion">
            <button
              className="train-accordion-head"
              aria-expanded={showUnscheduled}
              onClick={() => setShowUnscheduled((v) => !v)}
            >
              <span className="card-domain muted">待排清单</span>
              <span className="muted">{showUnscheduled ? '收起' : `展开（${data.unscheduled.length}）`}</span>
            </button>
            {showUnscheduled && (
              <ul className="plan-trip-list">
                {data.unscheduled.map((u, i) => (
                  <li key={i} className="muted">{u.destination} — {u.reason}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
