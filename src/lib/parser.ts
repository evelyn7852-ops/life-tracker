import type { FoodData, ParseResult, SetGroup, WorkoutData } from './types'

const MEAL_MAP: Record<string, FoodData['meal']> = {
  早餐: '早', 早饭: '早', 午餐: '午', 午饭: '午', 中饭: '午',
  晚餐: '晚', 晚饭: '晚', 加餐: '加餐', 零食: '加餐',
}

const WORKOUT_TYPES = ['瑜伽', '力量', '跑步', 'hyrox', 'crossfit', '健身', '游泳', '骑行', '徒步', '训练']

const DURATION_RE = /(\d+(?:\.\d+)?)\s*(分钟|min|小时|h)/i
const SETS_RE = /([一-龥a-zA-Z]+?)\s*(\d+(?:\.\d+)?)\s*kg\s*(\d+)\s*[x×X]\s*(\d+)/g

function splitTokens(s: string): string[] {
  return s.split(/[\s,，、]+/).filter(Boolean)
}

function parseDuration(text: string): number | undefined {
  const m = text.match(DURATION_RE)
  if (!m) return undefined
  const n = parseFloat(m[1])
  return /小时|h/i.test(m[2]) ? Math.round(n * 60) : Math.round(n)
}

function parseFood(text: string): ParseResult | null {
  for (const [kw, meal] of Object.entries(MEAL_MAP)) {
    if (text.includes(kw)) {
      const items = splitTokens(text.replace(kw, ''))
      return { domain: 'food', data: { meal, items } }
    }
  }
  return null
}

function parseSets(text: string): SetGroup[] {
  const out: SetGroup[] = []
  for (const m of text.matchAll(SETS_RE)) {
    out.push({ exercise: m[1], weight_kg: parseFloat(m[2]), sets: parseInt(m[3]), reps: parseInt(m[4]) })
  }
  return out
}

function parseWorkout(text: string): ParseResult | null {
  const lower = text.toLowerCase()
  const type = WORKOUT_TYPES.find((t) => lower.includes(t))
  const sets = parseSets(text)
  if (!type && sets.length === 0) return null
  const data: WorkoutData = { type: type ?? '力量' }
  if (sets.length > 0) { data.sets = sets; if (!type || type === '训练') data.type = '力量' }
  const dur = parseDuration(text)
  if (dur !== undefined) data.duration_min = dur
  return { domain: 'workout', data }
}

export function parseEntry(text: string): ParseResult | null {
  const t = text.trim()
  if (!t) return null
  return parseFood(t) ?? parseWorkout(t) ?? parseRest(t)
}

// parseRest 在 Task 4 实现；本 task 先占位返回 null
function parseRest(_t: string): ParseResult | null {
  return null
}
