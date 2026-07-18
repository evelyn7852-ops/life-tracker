import { useEffect, useState } from 'react'
import { useMood } from '../hooks/useMood'
import { fetchDailyImage, type DailyImage } from '../lib/dailyImage'
import { formatClock, weekdayZh } from '../lib/dateFormat'
import { todayQuote } from '../lib/quote'
import { currentQuarterTrips, listTrips, type TripRow } from '../lib/tripRepo'
import { CalendarView } from './CalendarView'
import { LearningPlanView } from './LearningPlanView'
import { StatsCard } from './StatsCard'
import { TravelPlanView } from './TravelPlanView'

type PlanOverlay = 'travel' | 'learning' | null

const MOODS = ['😊', '😐', '😮‍💨', '🥳', '😢', '🤒']

function formatBigDate(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 周${weekdayZh(d)}`
}

export function HomeView({ refreshKey, onSaved, active }: { refreshKey: number; onSaved: () => void; active: boolean }) {
  const [now, setNow] = useState(new Date())
  const [image, setImage] = useState<DailyImage | null>(null)
  const [planOverlay, setPlanOverlay] = useState<PlanOverlay>(null)
  const [quarterTrips, setQuarterTrips] = useState<TripRow[]>([])
  const { selected, pick } = useMood(refreshKey, onSaved, active)
  const quote = todayQuote(now)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  // 本季计划提醒：拉当前用户行程，筛出今年当季 planned/booked。trips 表还没建（用户没跑 SQL）
  // 或零命中时静默——不渲染 banner、不报错、不出错误 UI。
  useEffect(() => {
    if (!active) return
    let cancelled = false
    listTrips()
      .then((trips) => { if (!cancelled) setQuarterTrips(currentQuarterTrips(trips, new Date())) })
      .catch(() => { if (!cancelled) setQuarterTrips([]) })
    return () => { cancelled = true }
  }, [active, refreshKey])

  useEffect(() => {
    if (!active) return
    let cancelled = false
    fetchDailyImage((full) => { if (!cancelled) setImage(full) }).then((img) => { if (!cancelled) setImage(img) })
    return () => { cancelled = true }
  }, [active])

  const showFallback = !image
  const sentence = image?.sentence

  return (
    <div className="view home-view">
      <div className="home-hero-wrap">
        <div className={`home-hero ${showFallback ? 'home-hero-fallback' : ''}`}>
          {!showFallback && (
            <img src={image!.url} alt={image!.copyright} onError={() => setImage(null)} />
          )}
          <div className="home-hero-scrim" />
          <div className="home-hero-overlay">
            <div className="home-hero-date-row">
              <p className="home-hero-date">{formatBigDate(now)}</p>
              <p className="home-hero-clock">{formatClock(now)}</p>
            </div>
            {sentence ? (
              <p className="home-hero-sentence one-line">{sentence}</p>
            ) : (
              <p className="home-hero-sentence one-line">{quote.text}</p>
            )}
            <div className="home-hero-meta">
              {!showFallback && image!.copyright && <p className="home-hero-copyright">{image!.copyright}</p>}
              {!sentence && <p className="home-hero-quote-author">—— {quote.author}</p>}
            </div>
          </div>
        </div>
      </div>
      <div className="mood-row">
        {MOODS.map((emoji) => (
          <button
            key={emoji}
            className={`mood-emoji ${selected === emoji ? 'on' : ''}`}
            onClick={() => pick(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
      {quarterTrips.length > 0 && (
        <button className="card home-quarter-banner" onClick={() => setPlanOverlay('travel')}>
          📍 本季计划：{quarterTrips.map((t) => t.destination).join('、')}
        </button>
      )}
      <p className="section-title">本月</p>
      <CalendarView active={active} />
      <StatsCard refreshKey={refreshKey} active={active} />
      <div className="plan-section">
        <p className="section-title">规划</p>
        <div className="plan-cards">
          <button className="plan-card" onClick={() => setPlanOverlay('travel')}>
            <span className="plan-card-emoji">✈️</span>
            <span>旅行规划</span>
          </button>
          <button className="plan-card" onClick={() => setPlanOverlay('learning')}>
            <span className="plan-card-emoji">📘</span>
            <span>学习规划</span>
          </button>
        </div>
      </div>
      {planOverlay === 'travel' && <TravelPlanView onClose={() => setPlanOverlay(null)} />}
      {planOverlay === 'learning' && <LearningPlanView onClose={() => setPlanOverlay(null)} />}
    </div>
  )
}
