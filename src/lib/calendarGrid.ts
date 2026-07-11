/**
 * 月历网格：周日起始，固定 6 周（42 格），含上/下月填充日。
 * month 为 0-indexed（同 JS Date）。
 */
export function monthMatrix(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1)
  const gridStart = new Date(year, month, 1 - first.getDay())

  const weeks: Date[][] = []
  const cursor = new Date(gridStart)
  for (let w = 0; w < 6; w++) {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}

export function isSameMonth(d: Date, year: number, month: number): boolean {
  return d.getFullYear() === year && d.getMonth() === month
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
