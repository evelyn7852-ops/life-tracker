import { useEffect, useState } from 'react'
import { fetchDailyImage, type DailyImage } from '../lib/dailyImage'
import { formatClock, weekdayZh } from '../lib/dateFormat'
import { todayQuote } from '../lib/quote'

function formatBigDate(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 周${weekdayZh(d)}`
}

type SentenceState = 'loading' | 'ai' | 'fallback'

/** 首页 = 封面卡（V1.8）：hero 图为带玻璃框的画卡（不再叠字），文字块下移到图下方的粉底区。
 * 心情行/本季 banner/日历/统计卡/规划区均已迁出（心情→MoodHeader，本季 banner→QuarterBanner，
 * 日历/统计→记录页与回顾页，规划→规划 tab）。
 *
 * §B 句子三态：loading（占位「…」，完整段在途，绝不提前闪现语录）→ ai（daily-image 给出地点化句子）
 * / fallback（完整尝试结束但无句 → 语录库兜底）。三态由 fetchDailyImage 的 onSettled 回调驱动——
 * 只有「完整段尝试已结束」（settled=true）才允许句子位离开 loading。 */
export function HomeView({ active }: { active: boolean }) {
  const [now, setNow] = useState(new Date())
  const [image, setImage] = useState<DailyImage | null>(null)
  const [settled, setSettled] = useState(false)
  const quote = todayQuote(now)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!active) return
    let cancelled = false
    setSettled(false)
    fetchDailyImage((finalImg) => {
      if (cancelled) return
      setImage(finalImg)
      setSettled(true)
    }).then((img) => {
      if (cancelled) return
      setImage(img)
    })
    return () => { cancelled = true }
  }, [active])

  const showFallback = !image
  const sentenceState: SentenceState = !settled ? 'loading' : image?.sentence ? 'ai' : 'fallback'

  return (
    <div className="view home-view">
      <div className="home-hero-wrap">
        <div className={`home-hero ${showFallback ? 'home-hero-fallback' : ''}`}>
          {!showFallback && (
            <img src={image!.url} alt={image!.copyright} onError={() => setImage(null)} />
          )}
          <div className="home-hero-glass-ring" />
        </div>
      </div>
      <div className="home-text-block">
        <div className="home-date-row">
          <p className="home-date">{formatBigDate(now)}</p>
          <p className="home-clock">{formatClock(now)}</p>
        </div>
        {sentenceState === 'loading' && <p className="home-sentence home-sentence-loading">…</p>}
        {sentenceState === 'ai' && <p className="home-sentence">{image!.sentence}</p>}
        {sentenceState === 'fallback' && <p className="home-sentence">{quote.text}</p>}
        <div className="home-meta">
          {!showFallback && image!.copyright && <p className="home-copyright">{image!.copyright}</p>}
          {sentenceState === 'fallback' && <p className="home-quote-author">—— {quote.author}</p>}
        </div>
      </div>
    </div>
  )
}
