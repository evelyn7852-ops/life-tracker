import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

// Same provider defaults as parse-entry/summarize — see those files for why these are pinned.
const DEFAULT_LLM_BASE_URL = 'https://apihub.agnes-ai.com/v1'
const DEFAULT_LLM_MODEL = 'agnes-2.0-flash'

type Direction = 'hyrox' | 'crossfit' | '力量'
const DIRECTIONS = new Set<Direction>(['hyrox', 'crossfit', '力量'])

interface RecentWorkout { date: string; title: string; exerciseIds: string[] }

interface WorkoutBlock {
  exerciseId: string
  sets?: number
  reps?: number
  duration?: number
  distance?: number
  restSec?: number
}

// 动作库 id+name 白名单，随主库 src/data/exercises.json 手动同步（已去瑜伽，只剩力量+Hyrox）。
// Edge Function 目录自包含部署，不与前端共享打包，故在此内联一份精简副本。
const EXERCISES: { id: string; name: string }[] = [
  { id: 'back-squat', name: '高杠深蹲' },
  { id: 'front-squat', name: '前蹲' },
  { id: 'deadlift', name: '传统硬拉' },
  { id: 'rdl', name: '罗马尼亚硬拉' },
  { id: 'bench-press', name: '杠铃卧推' },
  { id: 'incline-bench-press', name: '上斜卧推' },
  { id: 'overhead-press', name: '站姿推举' },
  { id: 'db-shoulder-press', name: '哑铃推举' },
  { id: 'barbell-row', name: '杠铃划船' },
  { id: 'db-row', name: '哑铃单臂划船' },
  { id: 'pull-up', name: '引体向上' },
  { id: 'chin-up', name: '反手引体' },
  { id: 'kettlebell-swing', name: '壶铃摇摆' },
  { id: 'farmers-carry', name: '农夫行走' },
  { id: 'bulgarian-split-squat', name: '保加利亚分腿蹲' },
  { id: 'lunge', name: '箭步蹲' },
  { id: 'hip-thrust', name: '臀桥' },
  { id: 'plank', name: '平板支撑' },
  { id: 'hanging-leg-raise', name: '悬垂举腿' },
  { id: 'db-bicep-curl', name: '哑铃弯举' },
  { id: 'triceps-pushdown', name: '绳索下压' },
  { id: 'seated-cable-row', name: '坐姿划船机' },
  { id: 'lat-pulldown', name: '高位下拉' },
  { id: 'leg-press', name: '腿举' },
  { id: 'leg-extension', name: '腿屈伸' },
  { id: 'leg-curl', name: '腿弯举' },
  { id: 'skierg', name: 'SkiErg划雪橇机' },
  { id: 'sled-push', name: '推雪橇' },
  { id: 'sled-pull', name: '拉雪橇' },
  { id: 'burpee-broad-jump', name: '波比跳远' },
  { id: 'rowing-machine', name: '划船机' },
  { id: 'sandbag-lunge', name: '沙袋弓步' },
  { id: 'wall-ball', name: '墙球' },
]
const EXERCISE_IDS = new Set(EXERCISES.map((e) => e.id))
const EXERCISE_LIST_COMPACT = EXERCISES.map((e) => `${e.id}:${e.name}`).join(',')

const DIRECTION_LABEL: Record<Direction, string> = { hyrox: 'Hyrox', crossfit: 'CrossFit', '力量': '力量训练' }

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

/** 校验+夹紧单个动作块；exerciseId 不在白名单或缺失则整块剔除（返回 null）。镜像 src/lib/generateWorkout.ts 的规则。 */
function sanitizeBlock(raw: unknown): WorkoutBlock | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const exerciseId = typeof r.exerciseId === 'string' ? r.exerciseId : undefined
  if (!exerciseId || !EXERCISE_IDS.has(exerciseId)) return null

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

/** 解析+校验 LLM 响应；有效 block 数 < 3 视为生成失败，返回 null。 */
function sanitizeResult(raw: unknown): { title: string; blocks: WorkoutBlock[] } | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const title = typeof r.title === 'string' ? r.title.trim() : ''
  if (!title) return null
  if (!Array.isArray(r.blocks)) return null

  const blocks: WorkoutBlock[] = []
  for (const b of r.blocks) {
    const sanitized = sanitizeBlock(b)
    if (sanitized) blocks.push(sanitized)
  }
  if (blocks.length < 3) return null
  return { title, blocks }
}

function daysBetween(a: string, b: string): number {
  const diff = Date.parse(a) - Date.parse(b)
  return Math.round(diff / 86400000)
}

/** 最近3天内练过的动作 id（用于 prompt 里要求避开），按 date 与目标日期的差值过滤，不依赖调用方排序。 */
function recentExerciseIds(recent: RecentWorkout[], date: string): string[] {
  const ids = new Set<string>()
  for (const w of recent) {
    if (!Array.isArray(w.exerciseIds)) continue
    const diff = daysBetween(date, w.date)
    if (diff >= 1 && diff <= 3) w.exerciseIds.forEach((id) => ids.add(id))
  }
  return [...ids]
}

function buildSystemPrompt(): string {
  return `你是一个训练计划生成器。只输出 JSON，不要解释、不要 markdown 代码块。

输出格式固定为：{"title":"...","blocks":[{"exerciseId":"...","sets":数字,"reps":数字,"restSec":数字}]}
若某个动作块是计时/计距类型（如跑步机、划船机、雪橇），可改用 {"exerciseId":"...","duration_sec":数字,"restSec":数字} 或 {"exerciseId":"...","distance_m":数字,"restSec":数字}。

exerciseId 必须严格来自下面的动作库清单（格式 id:名称，逗号分隔），不得编造：
${EXERCISE_LIST_COMPACT}

blocks 至少要有 4-6 个动作块，覆盖当天训练方向的合理组合。`
}

function buildUserPrompt(direction: Direction, date: string, avoidIds: string[]): string {
  const label = DIRECTION_LABEL[direction]
  const avoidLine = avoidIds.length > 0
    ? `近3天已练过以下动作，请尽量避开、换其他动作组合以保证多样性：${avoidIds.join(',')}`
    : '近期无训练记录，可自由安排。'
  return `请为 ${date} 生成一份「${label}」方向的训练计划。${avoidLine}\n直接输出 JSON，不要任何解释文字。`
}

Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), { status: 405, headers: cors })
  }

  let body: { direction?: string; date?: string; recent?: RecentWorkout[] }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json body' }), { status: 400, headers: cors })
  }

  const { direction, date, recent } = body
  if (typeof direction !== 'string' || !DIRECTIONS.has(direction as Direction)) {
    return new Response(JSON.stringify({ error: 'direction must be hyrox|crossfit|力量' }), { status: 400, headers: cors })
  }
  if (typeof date !== 'string' || Number.isNaN(Date.parse(date))) {
    return new Response(JSON.stringify({ error: 'date required (YYYY-MM-DD)' }), { status: 400, headers: cors })
  }
  const recentList = Array.isArray(recent) ? recent : []

  const baseUrl = Deno.env.get('LLM_BASE_URL') ?? DEFAULT_LLM_BASE_URL
  const model = Deno.env.get('LLM_MODEL') ?? DEFAULT_LLM_MODEL
  const apiKey = Deno.env.get('LLM_API_KEY')
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'LLM_API_KEY not configured' }), { status: 500, headers: cors })
  }

  const avoidIds = recentExerciseIds(recentList, date)
  const system = buildSystemPrompt()
  const user = buildUserPrompt(direction as Direction, date, avoidIds)

  let resp: Response
  try {
    resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: 800,
        temperature: 0.6,
      }),
      signal: AbortSignal.timeout(20000),
    })
  } catch {
    return new Response(JSON.stringify({ error: '生成失败，请重试' }), { status: 502, headers: cors })
  }
  if (!resp.ok) return new Response(JSON.stringify({ error: '生成失败，请重试' }), { status: 502, headers: cors })

  let content: string
  try {
    const respBody = await resp.json()
    content = String(respBody.choices[0].message.content)
  } catch {
    return new Response(JSON.stringify({ error: '生成失败，请重试' }), { status: 502, headers: cors })
  }

  const start = content.indexOf('{')
  const end = content.lastIndexOf('}')
  if (start === -1 || end === -1) {
    return new Response(JSON.stringify({ error: '生成失败，请重试' }), { status: 502, headers: cors })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(content.slice(start, end + 1))
  } catch {
    return new Response(JSON.stringify({ error: '生成失败，请重试' }), { status: 502, headers: cors })
  }

  const result = sanitizeResult(parsed)
  if (!result) {
    return new Response(JSON.stringify({ error: '生成失败，请重试' }), { status: 502, headers: cors })
  }

  return new Response(JSON.stringify(result), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
