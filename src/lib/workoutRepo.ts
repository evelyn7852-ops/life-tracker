import exercisesData from '../data/exercises.json'
import { insertEntry } from './entriesRepo'
import { supabase } from './supabase'
import type { Exercise, NewWorkout, Workout } from './types'

const exercises = exercisesData as Exercise[]
const exerciseName = (id: string): string => exercises.find((e) => e.id === id)?.name ?? id

const COLS = 'id, date, template_id, title, blocks, status, performed, created_at'

export interface ListWorkoutsOpts { fromDate?: string; toDate?: string }

export async function listWorkouts(opts: ListWorkoutsOpts = {}): Promise<Workout[]> {
  let q = supabase.from('workouts').select(COLS).order('date', { ascending: true })
  if (opts.fromDate) q = q.gte('date', opts.fromDate)
  if (opts.toDate) q = q.lte('date', opts.toDate)
  const { data, error } = await q
  if (error) throw error
  return data as Workout[]
}

export async function insertWorkout(draft: NewWorkout): Promise<Workout> {
  const { data, error } = await supabase.from('workouts').insert(draft).select(COLS).single()
  if (error) throw error
  return data as Workout
}

export async function updateWorkout(id: string, patch: Partial<NewWorkout>): Promise<Workout> {
  const { data, error } = await supabase.from('workouts')
    .update(patch).eq('id', id).select(COLS).single()
  if (error) throw error
  return data as Workout
}

export async function deleteWorkout(id: string): Promise<void> {
  const { error } = await supabase.from('workouts').delete().eq('id', id)
  if (error) throw error
}

/** 练完归档：workout 状态→done，并写一条 workout 汇总 entry（时间线/周览零改动兼容）。 */
export async function archiveWorkout(workout: Workout): Promise<Workout> {
  const updated = await updateWorkout(workout.id, { status: 'done' })
  const firstName = workout.blocks[0] ? exerciseName(workout.blocks[0].exerciseId) : ''
  const summary = workout.blocks.length > 1
    ? `${workout.title} ${firstName}等${workout.blocks.length}动作`
    : `${workout.title} ${firstName}`
  await insertEntry({
    ts: new Date().toISOString(),
    domain: 'workout',
    raw_text: summary,
    data: { type: workout.title },
    parse_source: 'manual',
    tags: [],
  })
  return updated
}
