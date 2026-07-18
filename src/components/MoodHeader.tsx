import { useEffect, useState } from 'react'
import { formatClock, weekdayZh } from '../lib/dateFormat'

function formatDate(d: Date): string {
  return `${d.getMonth() + 1}月${d.getDate()}日 周${weekdayZh(d)} ${formatClock(d)}`
}

/** 记录 tab 顶部日期时钟；心情 emoji 行已迁至 HomeView（V1.2）。 */
export function MoodHeader() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="mood-header">
      <p className="mood-date muted">{formatDate(now)}</p>
    </div>
  )
}
