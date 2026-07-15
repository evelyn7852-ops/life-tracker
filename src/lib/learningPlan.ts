export interface LearnItem { t: string; pill?: string; link?: string }
export interface BuildItem { t: string; out?: string }
export interface ShipItem { t: string }

export interface CaseStudy {
  you: string
  ref: string
  link: string
  desc: string
  src: string
}

export interface Week {
  n: number
  title: string
  theme: string
  prd: string
  learn: LearnItem[]
  build: BuildItem[]
  ship: ShipItem[]
  cs: CaseStudy
}

export interface Phase {
  phase: string
  p: number
  takeaways: string[]
  weeks: Week[]
}

export interface LearningPlanData {
  setup: string[]
  phases: Phase[]
}

export type FlatItemKind = 'setup' | 'learn' | 'build' | 'ship' | 'mastery'

export interface FlatItem {
  id: string
  label: string
  link?: string
  pill?: string
  kind: FlatItemKind
}

/** id scheme matches the original ai-hackathon dashboard: setup-{i} */
export function flattenSetup(setup: string[]): FlatItem[] {
  return setup.map((t, i) => ({ id: `setup-${i}`, label: t, kind: 'setup' }))
}

/** id scheme matches the original dashboard: w{weekN}-{section}-{i} */
export function flattenWeekSection(
  weekN: number,
  section: 'learn' | 'build' | 'ship',
  items: (LearnItem | BuildItem | ShipItem)[],
): FlatItem[] {
  return items.map((it, i) => ({
    id: `w${weekN}-${section}-${i}`,
    label: it.t,
    link: 'link' in it ? it.link : undefined,
    pill: 'pill' in it ? it.pill : undefined,
    kind: section,
  }))
}

/** id scheme matches the original dashboard: m{phaseP}-{i} (phase number, not array index) */
export function flattenMastery(phaseP: number, takeaways: string[]): FlatItem[] {
  return takeaways.map((t, i) => ({ id: `m${phaseP}-${i}`, label: t, kind: 'mastery' }))
}

export const PROGRESS_KEY = 'ai_bootcamp_progress_v3'

export type ProgressState = Record<string, boolean>

export function loadProgress(): ProgressState {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '{}') as ProgressState
  } catch {
    return {}
  }
}

export function saveProgress(state: ProgressState): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(state))
  } catch {
    // storage unavailable (private mode / quota) — best-effort, matches original dashboard behavior
  }
}

export function toggleProgress(state: ProgressState, id: string): ProgressState {
  const next = { ...state, [id]: !state[id] }
  saveProgress(next)
  return next
}
