import { useEffect, useState } from 'react'

const WEEKDAY_ZH = ['日', '一', '二', '三', '四', '五', '六']

function formatDate(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getMonth() + 1}月${d.getDate()}日 周${WEEKDAY_ZH[d.getDay()]} ${hh}:${mm}`
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
