export type Domain = 'food' | 'workout' | 'travel' | 'reading' | 'journal' | 'learning'
export type ParseSource = 'rule' | 'llm' | 'manual'

export interface SetGroup { exercise: string; weight_kg?: number; sets: number; reps: number }

export interface FoodData { meal: '早' | '午' | '晚' | '加餐'; items: string[] }
export interface WorkoutData { type: string; duration_min?: number; sets?: SetGroup[] }
export interface ReadingData { title: string; pages?: number; minutes?: number }
export interface LearningData { course: string; topic?: string; minutes?: number }
export interface JournalData { mood?: string }
export interface TravelData { place: string; note?: string }

export type EntryData = FoodData | WorkoutData | ReadingData | LearningData | JournalData | TravelData

export interface Entry {
  id: string
  ts: string            // ISO
  domain: Domain
  raw_text: string
  data: EntryData
  parse_source: ParseSource
  tags: string[]
}

export type NewEntry = Omit<Entry, 'id'>

export interface ParseResult { domain: Domain; data: EntryData }

export const DOMAIN_LABEL: Record<Domain, string> = {
  food: '饮食', workout: '运动', travel: '旅行',
  reading: '阅读', journal: '日记', learning: '学习',
}
export const ALL_DOMAINS: Domain[] = ['food','workout','travel','reading','journal','learning']

// ---- 运动模块（W1）----

export type ExerciseCategory = '力量' | 'Hyrox'

export interface Exercise {
  id: string
  name: string
  category: ExerciseCategory
  muscles: string[]
  cues: string[]
  mistakes: string[]
  videoUrl: string
}

export interface WorkoutBlock {
  exerciseId: string
  sets?: number
  reps?: number
  duration?: number   // 秒
  distance?: number   // 米
  restSec?: number
}

export interface WorkoutTemplate {
  id: string
  name: string
  style: string
  notes?: string
  blocks: WorkoutBlock[]
}

export type WorkoutStatus = 'planned' | 'in_progress' | 'done'

export interface Workout {
  id: string
  date: string          // YYYY-MM-DD
  template_id: string | null
  title: string
  blocks: WorkoutBlock[]
  status: WorkoutStatus
  performed: unknown | null
  created_at: string
}

export type NewWorkout = Omit<Workout, 'id' | 'created_at'>
