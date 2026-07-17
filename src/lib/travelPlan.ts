export type TripType = 'intl' | 'domestic'
export type TripStatus = 'done' | 'planned'

export interface Trip {
  year: number
  slot: string
  period_hint: string
  destination: string
  country: string
  type: TripType
  days: number | null
  status: TripStatus
  budget_cny: number | null
  budget_stale: boolean
  notes: string
}

export interface UnscheduledDestination {
  destination: string
  reason: string
}

export interface TravelPlanData {
  version: string
  decisions_ref: string
  trips: Trip[]
  excluded_destinations: string[]
  unscheduled: UnscheduledDestination[]
}

export interface YearGroup<T = Trip> {
  year: number
  trips: T[]
}

/** Groups trips by year, years ascending. Generic so DB-backed TripRow[] (阶段②) can reuse it too. */
export function groupTripsByYear<T extends { year: number }>(trips: T[]): YearGroup<T>[] {
  const map = new Map<number, T[]>()
  for (const t of trips) {
    if (!map.has(t.year)) map.set(t.year, [])
    map.get(t.year)!.push(t)
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, yearTrips]) => ({ year, trips: yearTrips }))
}

/** Moves the current-year group to the front; other years stay ascending. */
export function orderGroupsCurrentFirst<T>(groups: YearGroup<T>[], currentYear: number): YearGroup<T>[] {
  const idx = groups.findIndex((g) => g.year === currentYear)
  if (idx <= 0) return groups
  return [groups[idx], ...groups.slice(0, idx), ...groups.slice(idx + 1)]
}

/** ¥ format when a fresh budget number exists; otherwise "预算待估". */
export function formatBudget(budgetCny: number | null, budgetStale: boolean): string {
  if (budgetCny === null || budgetStale) return '预算待估'
  return `¥${budgetCny.toLocaleString('zh-CN')}`
}
