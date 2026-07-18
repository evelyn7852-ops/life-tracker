import { useEffect, useState } from 'react'
import { fetchDailyImage, type DailyImage } from '../lib/dailyImage'
import { formatClock, weekdayZh } from '../lib/dateFormat'
import { todayQuote } from '../lib/quote'

function formatBigDate(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 周${weekdayZh(d)}`
}

/** 首页 = 纯封面（V1.7）：只保留 hero 大图 + 叠字。心情行/本季 banner/日历/统计卡/规划区
 * 均已迁出（心情→MoodHeader，本季 banner→QuarterBanner，日历/统计→记录页与回顾页，规划→规划 tab）。 */
export function HomeView({ active }: { active: boolean }) {
  const [now, setNow] = useState(new Date())
  const [image, setImage] = useState<DailyImage | null>(null)
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
    </div>
  )
}
