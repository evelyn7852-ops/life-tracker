const WEEKDAY_ZH = ['日', '一', '二', '三', '四', '五', '六']

/** 「周X」中的单字 X。 */
export function weekdayZh(d: Date): string {
  return WEEKDAY_ZH[d.getDay()]
}

/** 「HH:MM」，供 HomeView hero 时钟 / MoodHeader 复用，避免重复实现。 */
export function formatClock(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}
