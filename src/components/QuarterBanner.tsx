import { useEffect, useState } from 'react'
import { currentQuarterTrips, listTrips, type TripRow } from '../lib/tripRepo'

/** 记录页日历上方的本季旅行提醒（V1.7 从 HomeView 迁出）。零命中/trips 表不存在时静默不渲染。 */
export function QuarterBanner({ refreshKey, active }: { refreshKey: number; active: boolean }) {
  const [quarterTrips, setQuarterTrips] = useState<TripRow[]>([])

  useEffect(() => {
    if (!active) return
    let cancelled = false
    listTrips()
      .then((trips) => { if (!cancelled) setQuarterTrips(currentQuarterTrips(trips, new Date())) })
      .catch(() => { if (!cancelled) setQuarterTrips([]) })
    return () => { cancelled = true }
  }, [active, refreshKey])

  if (quarterTrips.length === 0) return null

  return (
    <div className="card home-quarter-banner">
      📍 本季计划：{quarterTrips.map((t) => t.destination).join('、')}
    </div>
  )
}
