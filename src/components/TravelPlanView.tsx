import { useCallback, useEffect, useState } from 'react'
import travelPlanData from '../data/travelPlan.json'
import { formatBudget, groupTripsByYear, orderGroupsCurrentFirst, type TravelPlanData } from '../lib/travelPlan'
import {
  countYearConflicts, currentQuarterTrips, deleteTrip, insertTrip, listTrips, seedTripsIfEmpty, updateTrip,
  type NewTrip, type TripRow, type TripStatusDb,
} from '../lib/tripRepo'

const data = travelPlanData as TravelPlanData

interface TripDraft {
  year: number
  slot: string
  destination: string
  period_hint: string
  country: string
  days: number | null
  budget_cny: number | null
  status: TripStatusDb
  notes: string
}

function toDraft(t: TripRow): TripDraft {
  return {
    year: t.year, slot: t.slot, destination: t.destination, period_hint: t.period_hint ?? '',
    country: t.country ?? '', days: t.days, budget_cny: t.budget_cny, status: t.status, notes: t.notes ?? '',
  }
}

function draftToPatch(d: TripDraft): Partial<NewTrip> {
  return {
    year: d.year,
    slot: d.slot.trim(),
    destination: d.destination.trim(),
    period_hint: d.period_hint.trim() || null,
    country: d.country.trim() || null,
    days: d.days,
    budget_cny: d.budget_cny,
    status: d.status,
    notes: d.notes.trim() || null,
  }
}

const STATUS_OPTIONS: { value: TripStatusDb; label: string }[] = [
  { value: 'planned', label: '计划中' },
  { value: 'booked', label: '已订' },
  { value: 'done', label: '已完成' },
]

function TripFormFields({ draft, setDraft, conflicts }: { draft: TripDraft; setDraft: (d: TripDraft) => void; conflicts: number }) {
  return (
    <>
      <div className="trip-edit-row">
        <label>
          年份
          <input
            type="number"
            value={draft.year || ''}
            onChange={(e) => setDraft({ ...draft, year: e.target.value === '' ? 0 : Number(e.target.value) })}
          />
        </label>
        {conflicts > 0 && <span className="trip-conflict-hint">⚠️同年已有{conflicts}程</span>}
      </div>
      <input placeholder="时段（如 五一/十一/7月）" value={draft.slot} onChange={(e) => setDraft({ ...draft, slot: e.target.value })} />
      <input placeholder="目的地" value={draft.destination} onChange={(e) => setDraft({ ...draft, destination: e.target.value })} />
      <input placeholder="时段说明（如 7天·已订）" value={draft.period_hint} onChange={(e) => setDraft({ ...draft, period_hint: e.target.value })} />
      <input placeholder="国家" value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value })} />
      <div className="trip-edit-row">
        <input
          type="number"
          placeholder="天数"
          value={draft.days ?? ''}
          onChange={(e) => setDraft({ ...draft, days: e.target.value === '' ? null : Number(e.target.value) })}
        />
        <input
          type="number"
          placeholder="预算¥"
          value={draft.budget_cny ?? ''}
          onChange={(e) => setDraft({ ...draft, budget_cny: e.target.value === '' ? null : Number(e.target.value) })}
        />
      </div>
      <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as TripStatusDb })}>
        {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <input placeholder="备注" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
    </>
  )
}

function TripCard({ trip, allTrips, onChanged }: { trip: TripRow; allTrips: TripRow[]; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<TripDraft>(() => toDraft(trip))

  const startEdit = () => { setDraft(toDraft(trip)); setEditing(true) }

  const save = async () => {
    if (!draft.destination.trim() || !draft.slot.trim() || !draft.year) return
    await updateTrip(trip.id, draftToPatch(draft))
    setEditing(false)
    onChanged()
  }

  const remove = async () => {
    if (!confirm('删除这条行程？')) return
    await deleteTrip(trip.id)
    onChanged()
  }

  if (!editing) {
    return (
      <li className="plan-trip-card">
        <div className="plan-trip-head">
          <span>{trip.slot}{trip.period_hint ? ` · ${trip.period_hint}` : ''}</span>
          {trip.status === 'done' && <span className="plan-trip-done" aria-label="已完成">✓</span>}
          {trip.status === 'booked' && <span className="trip-status-badge">已订</span>}
        </div>
        <p className="card-text" onClick={startEdit}>{trip.destination}</p>
        <p className="muted">
          {trip.country}
          {trip.days ? ` · ${trip.days}天` : ''}
          {' · '}
          {formatBudget(trip.budget_cny, trip.budget_stale)}
        </p>
        {trip.notes && <p className="muted">{trip.notes}</p>}
      </li>
    )
  }

  const conflicts = countYearConflicts(allTrips, trip.id, draft.year)

  return (
    <li className="plan-trip-card trip-edit-card">
      <TripFormFields draft={draft} setDraft={setDraft} conflicts={conflicts} />
      <div className="card-edit">
        <button onClick={save}>存</button>
        <button className="card-del-inline" onClick={remove}>删</button>
        <button onClick={() => setEditing(false)}>取消</button>
      </div>
    </li>
  )
}

function AddTripCard({ year, allTrips, onAdded, onCancel }: { year: number; allTrips: TripRow[]; onAdded: () => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<TripDraft>({
    year, slot: '', destination: '', period_hint: '', country: '', days: null, budget_cny: null, status: 'planned', notes: '',
  })

  const conflicts = countYearConflicts(allTrips, '', draft.year)

  const save = async () => {
    if (!draft.destination.trim() || !draft.slot.trim() || !draft.year) return
    const patch = draftToPatch(draft)
    await insertTrip({
      year: patch.year as number,
      slot: patch.slot as string,
      period_hint: patch.period_hint ?? null,
      destination: patch.destination as string,
      country: patch.country ?? null,
      trip_type: null,
      days: patch.days ?? null,
      status: patch.status ?? 'planned',
      budget_cny: patch.budget_cny ?? null,
      budget_stale: false,
      notes: patch.notes ?? null,
      seed_key: null,
    })
    onAdded()
  }

  return (
    <div className="card trip-edit-card">
      <TripFormFields draft={draft} setDraft={setDraft} conflicts={conflicts} />
      <div className="card-edit">
        <button onClick={save}>存</button>
        <button onClick={onCancel}>取消</button>
      </div>
    </div>
  )
}

export function TravelPlanView({ onClose }: { onClose: () => void }) {
  const currentYear = new Date().getFullYear()
  const [trips, setTrips] = useState<TripRow[]>([])
  const [loading, setLoading] = useState(true)
  const [openYears, setOpenYears] = useState<Set<number>>(new Set([currentYear]))
  const [showExcluded, setShowExcluded] = useState(false)
  const [showUnscheduled, setShowUnscheduled] = useState(false)
  const [addingYear, setAddingYear] = useState<number | null>(null)

  const reload = useCallback(async () => {
    const rows = await listTrips()
    setTrips(rows)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await seedTripsIfEmpty()
      const rows = await listTrips()
      if (!cancelled) { setTrips(rows); setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [])

  const toggleYear = (year: number) => {
    setOpenYears((prev) => {
      const next = new Set(prev)
      if (next.has(year)) next.delete(year)
      else next.add(year)
      return next
    })
  }

  const groups = orderGroupsCurrentFirst(groupTripsByYear(trips), currentYear)
  const quarterTrips = currentQuarterTrips(trips, new Date())

  return (
    <div className="day-detail-overlay" onClick={onClose}>
      <div className="day-detail-sheet plan-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="day-detail-head">
          <p className="day-detail-title">旅行规划</p>
          <button aria-label="关闭" className="day-detail-close" onClick={onClose}>✕</button>
        </div>
        <p className="muted plan-note">粒度为「五一/十一/圣诞」季度级，日历不做日级映射</p>
        {quarterTrips.length > 0 && (
          <div className="card trip-quarter-banner">
            <p>📍 本季计划：{quarterTrips.map((t) => t.destination).join('、')}</p>
          </div>
        )}
        <div className="day-detail-body">
          {loading ? (
            <p className="muted">行程加载中…</p>
          ) : (
            <>
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
                      <>
                        <ul className="plan-trip-list">
                          {g.trips.map((t) => (
                            <TripCard key={t.id} trip={t} allTrips={trips} onChanged={reload} />
                          ))}
                        </ul>
                        <div className="trip-add-row">
                          {addingYear === g.year ? (
                            <AddTripCard
                              year={g.year}
                              allTrips={trips}
                              onAdded={async () => { await reload(); setAddingYear(null) }}
                              onCancel={() => setAddingYear(null)}
                            />
                          ) : (
                            <button className="trip-add-btn" onClick={() => setAddingYear(g.year)}>+ 加行程</button>
                          )}
                        </div>
                      </>
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
