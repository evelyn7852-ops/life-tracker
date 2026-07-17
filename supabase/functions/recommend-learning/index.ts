import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

// Same provider defaults as summarize/generate-workout — see those files for why these are pinned.
const DEFAULT_LLM_BASE_URL = 'https://apihub.agnes-ai.com/v1'
const DEFAULT_LLM_MODEL = 'agnes-2.0-flash'

const MAX_EXISTING_TITLES = 200
const MAX_RESULT_ITEMS = 3

interface ExistingItem { title: string; url: string | null }

interface RawRecommendation {
  title?: unknown
  url?: unknown
  source?: unknown
  tag?: unknown
  note?: unknown
}

interface Recommendation {
  title: string
  url: string | null
  source: string | null
  tag: string | null
  note: string | null
}

function buildSystemPrompt(): string {
  return `你是一个 AI 学习资源推荐助手。只输出 JSON 数组，不要解释、不要 markdown 代码块。

输出格式固定为：[{"title":"...","url":"...","source":"...","tag":"...","note":"..."}]，2-3 条。

严格要求：
- 只推荐你确信真实存在的资源——知名机构（OpenAI、Anthropic、Google、DeepMind、知名大学/课程平台等）发布的官方文档、论文、课程。
- 绝不编造 URL 或资源；如果不确定某个资源是否真实存在，宁可少给甚至不给，也不要猜。
- 避免推荐下面「已有清单」中列出的标题（避免重复）。
- title 必填；url 若不确定可省略或留空；source/tag/note 可选，是简短字符串。`
}

function buildUserPrompt(existing: ExistingItem[]): string {
  const titles = existing.map((e) => e.title).filter(Boolean)
  const existingLine = titles.length > 0
    ? `已有清单（请避免重复推荐这些标题）：\n${titles.map((t) => `- ${t}`).join('\n')}`
    : '已有清单为空。'
  return `请推荐 2-3 条当前值得学习的 AI 相关资源（官方文档、论文、课程等）。\n\n${existingLine}\n\n直接输出 JSON 数组，不要任何解释文字。`
}

/** 解析 LLM 返回内容为 JSON；兼容 markdown 代码块包裹（```json ... ```）。解析失败或结果非数组返回 null。 */
function parseRecommendations(content: string): unknown[] | null {
  let text = content.trim()
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  if (fenced) text = fenced[1].trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    // Fall back to slicing between first [ and last ] in case of stray prose.
    const start = text.indexOf('[')
    const end = text.lastIndexOf(']')
    if (start === -1 || end === -1 || end < start) return null
    try {
      parsed = JSON.parse(text.slice(start, end + 1))
    } catch {
      return null
    }
  }
  return Array.isArray(parsed) ? parsed : null
}

/** 校验+清洗单条推荐；title 缺失/空则整条丢弃（返回 null）。 */
function sanitizeItem(raw: unknown): Recommendation | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as RawRecommendation

  const title = typeof r.title === 'string' ? r.title.trim() : ''
  if (!title) return null

  const rawUrl = typeof r.url === 'string' ? r.url.trim() : ''
  const url = rawUrl.startsWith('http://') || rawUrl.startsWith('https://') ? rawUrl : null

  const source = typeof r.source === 'string' && r.source.trim() ? r.source.trim() : null
  const tag = typeof r.tag === 'string' && r.tag.trim() ? r.tag.trim() : null
  const note = typeof r.note === 'string' && r.note.trim() ? r.note.trim() : null

  return { title, url, source, tag, note }
}

/** 校验、去重（大小写/首尾空格不敏感）、裁剪至最多 MAX_RESULT_ITEMS 条。 */
function sanitizeRecommendations(raw: unknown[], existing: ExistingItem[]): Recommendation[] {
  const existingTitles = new Set(existing.map((e) => e.title.trim().toLowerCase()))
  const result: Recommendation[] = []
  for (const item of raw) {
    const sanitized = sanitizeItem(item)
    if (!sanitized) continue
    if (existingTitles.has(sanitized.title.toLowerCase())) continue
    result.push(sanitized)
    if (result.length >= MAX_RESULT_ITEMS) break
  }
  return result
}

async function fetchRecommendationsForUser(
  existing: ExistingItem[],
  env: { baseUrl: string; model: string; apiKey: string },
): Promise<Recommendation[]> {
  const resp = await fetch(`${env.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.model,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserPrompt(existing) },
      ],
      max_tokens: 800,
      temperature: 0.4,
    }),
    signal: AbortSignal.timeout(20000),
  })
  if (!resp.ok) throw new Error(`llm ${resp.status}`)

  const respBody = await resp.json()
  const content = String(respBody.choices[0].message.content)

  const parsed = parseRecommendations(content)
  if (!parsed) return []
  return sanitizeRecommendations(parsed, existing)
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

  // 仅接受携带正确 x-cron-secret 头的请求，防止公网任意调用触发批量 LLM 调用/写入。
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret) {
    return new Response(JSON.stringify({ error: 'CRON_SECRET not configured' }), { status: 500, headers: cors })
  }
  const providedSecret = req.headers.get('x-cron-secret')
  if (providedSecret !== cronSecret) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: cors })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'supabase env not configured' }), { status: 500, headers: cors })
  }

  const baseUrl = Deno.env.get('LLM_BASE_URL') ?? DEFAULT_LLM_BASE_URL
  const model = Deno.env.get('LLM_MODEL') ?? DEFAULT_LLM_MODEL
  const apiKey = Deno.env.get('LLM_API_KEY')
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'LLM_API_KEY not configured' }), { status: 500, headers: cors })
  }

  // Service role client: bypasses RLS by design so the cron job can read/write across all users.
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers()
  if (usersErr || !usersData) {
    return new Response(JSON.stringify({ error: 'list users failed' }), { status: 500, headers: cors })
  }

  let inserted = 0
  const userCount = usersData.users.length

  for (const user of usersData.users) {
    try {
      const { data: existingRows, error: existingErr } = await supabase
        .from('learning_items')
        .select('title, url')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(MAX_EXISTING_TITLES)
      if (existingErr) {
        console.error(`[recommend-learning] fetch existing failed for user ${user.id}: ${existingErr.message}`)
        continue
      }
      const existing: ExistingItem[] = (existingRows ?? []).map((r) => ({
        title: String(r.title ?? ''),
        url: r.url ? String(r.url) : null,
      }))

      const recommendations = await fetchRecommendationsForUser(existing, { baseUrl, model, apiKey })
      if (recommendations.length === 0) continue

      const rows = recommendations.map((rec) => ({
        user_id: user.id,
        title: rec.title,
        url: rec.url,
        source: rec.source,
        tag: rec.tag,
        note: rec.note,
        status: '待读',
        added_by: 'auto',
      }))

      const { error: insertErr } = await supabase.from('learning_items').insert(rows)
      if (insertErr) {
        console.error(`[recommend-learning] insert failed for user ${user.id}: ${insertErr.message}`)
        continue
      }
      inserted += rows.length
    } catch (e) {
      // 单用户失败（LLM 超时/网络错误/解析异常等）不影响其他用户。
      console.error(`[recommend-learning] user ${user.id} failed: ${String(e).slice(0, 300)}`)
      continue
    }
  }

  return new Response(JSON.stringify({ inserted, users: userCount }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
