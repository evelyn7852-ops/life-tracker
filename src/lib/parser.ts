import type { FoodData, ParseResult, SetGroup, WorkoutData, ReadingData, LearningData, TravelData, EntryData } from './types'

const MEAL_MAP: Record<string, FoodData['meal']> = {
  早餐: '早', 早饭: '早', 午餐: '午', 午饭: '午', 中饭: '午',
  晚餐: '晚', 晚饭: '晚', 加餐: '加餐', 零食: '加餐',
}

const WORKOUT_TYPES = ['瑜伽', '力量', '跑步', 'hyrox', 'crossfit', '健身', '游泳', '骑行', '徒步', '训练']

const DURATION_RE = /(\d+(?:\.\d+)?)\s*(分钟|min|小时|h)/i
const SETS_RE = /([一-龥a-zA-Z]+?)\s*(\d+(?:\.\d+)?)\s*kg\s*(\d+)\s*[x×X]\s*(\d+)/g
const PAGES_RE = /(\d+)\s*页/

function splitTokens(s: string): string[] {
  return s.split(/[\s,，、]+/).filter(Boolean)
}

function parseDuration(text: string): number | undefined {
  const m = text.match(DURATION_RE)
  if (!m) return undefined
  const n = parseFloat(m[1])
  return /小时|h/i.test(m[2]) ? Math.round(n * 60) : Math.round(n)
}

function stripDurationAndPages(s: string): string {
  return s.replace(DURATION_RE, '').replace(PAGES_RE, '').trim()
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

function parseRest(t: string): ParseResult | null {
  // reading
  const readM = t.match(/^(?:读|阅读|看书)\s*(.*)$/)
  if (readM) {
    const body = readM[1]
    const title = splitTokens(stripDurationAndPages(body)).join(' ')
    if (title) {
      const data: EntryData = { title }
      const pages = body.match(PAGES_RE); if (pages) (data as ReadingData).pages = parseInt(pages[1])
      const min = parseDuration(body); if (min !== undefined) (data as ReadingData).minutes = min
      return { domain: 'reading', data }
    }
  }
  // learning
  const learnM = t.match(/^(?:学习|学|上课)\s*(.*)$/)
  if (learnM) {
    const body = learnM[1]
    const course = splitTokens(stripDurationAndPages(body)).join(' ')
    if (course) {
      const data: LearningData = { course }
      const min = parseDuration(body); if (min !== undefined) data.minutes = min
      return { domain: 'learning', data }
    }
  }
  // travel
  const travelM = t.match(/^(?:到达|抵达|出发去?|飞往|去了)\s*(.+)$/)
  if (travelM) {
    return { domain: 'travel', data: { place: splitTokens(travelM[1])[0], note: splitTokens(travelM[1]).slice(1).join(' ') || undefined } as TravelData }
  }
  // journal
  if (/^(?:日记|随想|感想)/.test(t)) return { domain: 'journal', data: {} }
  return null
}
