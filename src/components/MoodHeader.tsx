import { useEffect, useState } from 'react'
import { useMood } from '../hooks/useMood'
import { formatClock, weekdayZh } from '../lib/dateFormat'
import { MoodFace, MOOD_STYLES } from './MoodFace'

const MOODS = ['😊', '😐', '😮‍💨', '🥳', '😢', '🤒']

function formatDate(d: Date): string {
  return `${d.getMonth() + 1}月${d.getDate()}日 周${weekdayZh(d)} ${formatClock(d)}`
}

/** 记录 tab 顶部日期时钟 + 心情行（V1.7：心情行从首页回归记录页）。 */
export function MoodHeader({ refreshKey, onSaved, active }: { refreshKey: number; onSaved: () => void; active: boolean }) {
  const [now, setNow] = useState(new Date())
  const { selected, pick } = useMood(refreshKey, onSaved, active)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="mood-header">
      <p className="mood-date muted">{formatDate(now)}</p>
      <div className="mood-row">
        {MOODS.map((emoji) => (
          <button
            key={emoji}
            className={`mood-emoji ${selected === emoji ? 'on' : ''}`}
            aria-label={MOOD_STYLES[emoji]?.label}
            onClick={() => pick(emoji)}
          >
            <MoodFace mood={emoji} selected={selected === emoji} />
          </button>
        ))}
      </div>
    </div>
  )
}
