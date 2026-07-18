import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

// Same provider defaults as summarize/generate-workout — see those files for why these are pinned.
const DEFAULT_LLM_BASE_URL = 'https://apihub.agnes-ai.com/v1'
const DEFAULT_LLM_MODEL = 'agnes-2.0-flash'

const MAX_EXISTING_TITLES = 200
const MAX_RESULT_ITEMS = 3
// 近期 learning 记录作为「这人最近在学什么」的信号，喂给 prompt 提升相关性。
const RECENT_ENTRY_DAYS = 60
const MAX_RECENT_ENTRIES = 30
const MAX_RECENT_ENTRY_CHARS = 1500

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
  return `你是一个 AI 学习资源推荐助手，为一位特定读者挑选资源。只输出 JSON 数组，不要解释、不要 markdown 代码块。

输出格式固定为：[{"title":"...","source":"...","tag":"...","note":"..."}]，2-3 条。

## 读者画像（推荐必须贴合此人，不是泛泛的「AI 学习者」）
技术流营销经理（医药行业），自建 AI 工具，动手写代码和 prompt。**不是 ML 研究者，不训练模型**，不关心底层网络结构和训练技巧。

关注四个方向：
① Agent 工程与产品：架构模式、工具调用、eval/评测、PRD、上线运维。
② Claude 生态深用：Claude Code / Cowork / MCP / skills / API 新能力与最佳实践。
③ AI 在医药/商业的应用：制药行业 AI、RWE、商业分析自动化、AI 辅助决策。
④ AI 前沿动态：新模型/新范式的重要进展（不是入门教程）。

## 禁止推荐（读者早已越过这个阶段，推这些等于浪费她时间）
- 入门/基础/科普类：如「什么是 LLM」「AI 入门」类内容。
- 经典奠基论文：如 Attention Is All You Need、BERT、GPT-1/2 原始论文等。
- 深度学习入门课：如 Deep Learning Specialization、CS231n、fast.ai 等。
- 框架文档与教程：如 PyTorch / TensorFlow / Keras 官方文档或入门教程。
- 模型训练/微调底层技术（除非与 agent 工程或行业应用直接相关）。

宁可只给 1 条真正贴合的，也不要用通用入门货凑数。**通用「AI 名作」= 失败的推荐。**

## 真实性（硬约束）
- 只推荐你确信真实存在的资源——知名机构（Anthropic、OpenAI、Google/DeepMind、知名大学、权威行业媒体/期刊等）发布的官方文档、论文、课程、工程博客。
- 绝不编造资源；不确定是否真实存在就不要给。**少给不是问题，编造是致命问题。**
- 避免推荐「已有清单」中已列出的标题。

## 关于 URL（重要）
**url 不是必填字段，默认不要给。** 你对具体 URL 路径的记忆很不可靠——即使资源真实存在，你也常常拼错路径。

- 只在你确信该 URL 真实存在、且确实指向这个资源时才给 url。
- 不确定就直接省略 url 字段。**省略 url 是完全正确的做法，编造 URL 是严重错误。**
- 绝不为了凑字段而拼接、猜测或臆造路径（如在域名后接一个「看起来合理」的路径）。
- 系统会为没有 url 的条目自动提供搜索入口，读者照样能找到资源——所以省略 url 毫无损失。

## 字段
title 必填，写准确、可被搜索到的资源全名。source 写发布方（如 Anthropic、Nature、McKinsey），tag 写方向标签，note 用一句简短中文说明「为什么这条值得这位读者看」。source/tag/note 可选但建议给全——title + source 是读者搜索时的主要线索。`
}

function buildUserPrompt(existing: ExistingItem[], recentEntries: string[]): string {
  const titles = existing.map((e) => e.title).filter(Boolean)
  const existingLine = titles.length > 0
    ? `已有清单（请避免重复推荐这些标题）：\n${titles.map((t) => `- ${t}`).join('\n')}`
    : '已有清单为空。'

  let recentBlock = ''
  if (recentEntries.length > 0) {
    let joined = recentEntries.map((t) => `- ${t}`).join('\n')
    if (joined.length > MAX_RECENT_ENTRY_CHARS) joined = joined.slice(0, MAX_RECENT_ENTRY_CHARS)
    recentBlock = `\n该用户最近在学的东西（近${RECENT_ENTRY_DAYS}天的学习记录，据此判断她的当前兴趣和水平）：\n${joined}\n`
  }

  return `请为上述读者画像推荐 2-3 条值得学习的 AI 资源，紧扣她关注的四个方向，避开入门/基础类。\n\n${existingLine}\n${recentBlock}\n记住：url 默认省略，除非你确信该链接真实存在且指向该资源。\n直接输出 JSON 数组，不要任何解释文字。`
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

/**
 * HEAD 探活：LLM 对 URL 路径的记忆不可靠（真调曾出现 404、臆造路径、title/URL 张冠李戴），
 * 故服务端逐条验证。非 2xx / 网络错误 / 超时 → 返回 false，调用方把 url 置 null 保留条目，
 * 客户端降级为搜索按钮（同 exercises.json 用 B站搜索链接而非视频 id 的既有取舍）。
 * 注意：部分站点（如 McKinsey）对 HEAD 有 bot 拦截，会被误判——可接受：宁可降级为搜索，不给死链。
 */
async function verifyUrl(url: string): Promise<boolean> {
  try {
    const resp = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(6000),
    })
    return resp.ok
  } catch {
    return false
  }
}

/** 逐条验证 url；失效则置 null 但保留条目。验证异常绝不影响条目本身或整轮运行。 */
async function verifyRecommendationUrls(items: Recommendation[]): Promise<Recommendation[]> {
  return await Promise.all(items.map(async (item) => {
    if (!item.url) return item
    const ok = await verifyUrl(item.url)
    if (ok) return item
    console.error(`[recommend-learning] dropping unverifiable url for "${item.title}"`)
    return { ...item, url: null }
  }))
}

async function fetchRecommendationsForUser(
  existing: ExistingItem[],
  recentEntries: string[],
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
        { role: 'user', content: buildUserPrompt(existing, recentEntries) },
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
  const sanitized = sanitizeRecommendations(parsed, existing)
  return await verifyRecommendationUrls(sanitized)
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

      // 近期 learning 记录：额外的兴趣/水平信号。查询失败或无记录不影响本轮推荐，仅少一份上下文。
      let recentEntries: string[] = []
      const since = new Date(Date.now() - RECENT_ENTRY_DAYS * 86400_000).toISOString()
      const { data: entryRows, error: entriesErr } = await supabase
        .from('entries')
        .select('raw_text')
        .eq('user_id', user.id)
        .eq('domain', 'learning')
        .gte('ts', since)
        .order('ts', { ascending: false })
        .limit(MAX_RECENT_ENTRIES)
      if (entriesErr) {
        console.error(`[recommend-learning] fetch recent entries failed for user ${user.id}: ${entriesErr.message}`)
      } else {
        recentEntries = (entryRows ?? [])
          .map((r) => String(r.raw_text ?? '').trim())
          .filter(Boolean)
      }

      const recommendations = await fetchRecommendationsForUser(existing, recentEntries, { baseUrl, model, apiKey })
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
