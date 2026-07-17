import { useEffect, useState } from 'react'
import { useMood } from '../hooks/useMood'
import { fetchDailyImage, type DailyImage } from '../lib/dailyImage'
import { todayQuote } from '../lib/quote'
import { CalendarView } from './CalendarView'
import { DogBanner } from './DogBanner'
import { LearningPlanView } from './LearningPlanView'
import { StatsCard } from './StatsCard'
import { TravelPlanView } from './TravelPlanView'

type PlanOverlay = 'travel' | 'learning' | null

const MOODS = ['😊', '😐', '😮‍💨', '🥳', '😢', '🤒']
const WEEKDAY_ZH = ['日', '一', '二', '三', '四', '五', '六']

function formatBigDate(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 周${WEEKDAY_ZH[d.getDay()]}`
}

function formatClock(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export function HomeView({ refreshKey, onSaved, active }: { refreshKey: number; onSaved: () => void; active: boolean }) {
  const [now, setNow] = useState(new Date())
  const [image, setImage] = useState<DailyImage | null>(null)
  const [planOverlay, setPlanOverlay] = useState<PlanOverlay>(null)
  const { selected, pick } = useMood(refreshKey, onSaved, active)
  const quote = todayQuote(now)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

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
      <div className={`home-image ${showFallback ? 'home-image-fallback' : ''}`}>
        {!showFallback && (
          <img src={image!.url} alt={image!.copyright} onError={() => setImage(null)} />
        )}
      </div>
      {!showFallback && image!.copyright && <p className="home-copyright muted">{image!.copyright}</p>}
      <p className="home-date">{formatBigDate(now)}</p>
      <p className="home-clock muted">{formatClock(now)}</p>
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
      <div className="home-quote-card">
        {sentence ? (
          <p className="home-quote-text one-line">{sentence}</p>
        ) : (
          <>
            <p className="home-quote-text">{quote.text}</p>
            <p className="home-quote-author muted">—— {quote.author}</p>
          </>
        )}
      </div>
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
      <DogBanner />
      {planOverlay === 'travel' && <TravelPlanView onClose={() => setPlanOverlay(null)} />}
      {planOverlay === 'learning' && <LearningPlanView onClose={() => setPlanOverlay(null)} />}
    </div>
  )
}
