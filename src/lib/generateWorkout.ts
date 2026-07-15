import exercisesData from '../data/exercises.json'
import { supabase } from './supabase'
import type { Exercise, WorkoutBlock } from './types'

const exercises = exercisesData as Exercise[]
const ALL_EXERCISE_IDS = exercises.map((e) => e.id)

export type GenerateDirection = 'hyrox' | 'crossfit' | '力量'

export interface RecentWorkout {
  date: string
  title: string
  exerciseIds: string[]
}

export interface GeneratedWorkout {
  title: string
  blocks: WorkoutBlock[]
}

const LIMITS = {
  sets: [1, 10],
  reps: [1, 50],
  restSec: [0, 300],
  duration: [1, 3600],
  distance: [1, 5000],
} as const

function clamp(n: number, [min, max]: readonly [number, number]): number {
  return Math.min(max, Math.max(min, n))
}

function coerceNum(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : undefined
}

/** 校验+夹紧单个动作块；exerciseId 不在白名单或缺失则整块剔除（返回 null）。 */
function sanitizeBlock(raw: unknown, validIds: Set<string>): WorkoutBlock | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const exerciseId = typeof r.exerciseId === 'string' ? r.exerciseId : undefined
  if (!exerciseId || !validIds.has(exerciseId)) return null

  const block: WorkoutBlock = { exerciseId }
  const sets = coerceNum(r.sets)
  if (sets !== undefined) block.sets = clamp(Math.round(sets), LIMITS.sets)
  const reps = coerceNum(r.reps)
  if (reps !== undefined) block.reps = clamp(Math.round(reps), LIMITS.reps)
  const restSec = coerceNum(r.restSec)
  if (restSec !== undefined) block.restSec = clamp(Math.round(restSec), LIMITS.restSec)
  const duration = coerceNum(r.duration_sec ?? r.duration)
  if (duration !== undefined) block.duration = clamp(Math.round(duration), LIMITS.duration)
  const distance = coerceNum(r.distance_m ?? r.distance)
  if (distance !== undefined) block.distance = clamp(Math.round(distance), LIMITS.distance)

  return block
}

/**
 * 解析 + 校验 generate-workout Edge Function 的响应。
 * exerciseId 白名单校验（无效 block 剔除）；有效 block 数 < 3 时视为生成失败，返回 null。
 */
export function parseGeneratedWorkout(raw: unknown, validExerciseIds: string[] = ALL_EXERCISE_IDS): GeneratedWorkout | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const title = typeof r.title === 'string' ? r.title.trim() : ''
  if (!title) return null
  if (!Array.isArray(r.blocks)) return null

  const validIds = new Set(validExerciseIds)
  const blocks: WorkoutBlock[] = []
  for (const b of r.blocks) {
    const sanitized = sanitizeBlock(b, validIds)
    if (sanitized) blocks.push(sanitized)
  }
  if (blocks.length < 3) return null

  return { title, blocks }
}

/** 调用 generate-workout Edge Function 并本地二次校验；失败统一抛出中文提示。 */
export async function generateWorkout(
  direction: GenerateDirection,
  date: string,
  recent: RecentWorkout[],
): Promise<GeneratedWorkout> {
  const { data, error } = await supabase.functions.invoke('generate-workout', {
    body: { direction, date, recent },
  })
  if (error) throw new Error('生成失败，请重试')
  const result = parseGeneratedWorkout(data)
  if (!result) throw new Error('生成失败，请重试')
  return result
}
