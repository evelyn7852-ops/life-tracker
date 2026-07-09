import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

// Same provider defaults as parse-entry — see that file for why these are pinned.
const DEFAULT_LLM_BASE_URL = 'https://apihub.agnes-ai.com/v1'
const DEFAULT_LLM_MODEL = 'agnes-2.0-flash'

const DOMAIN_LABEL: Record<string, string> = {
  food: '饮食', workout: '运动', travel: '旅行', reading: '阅读', journal: '日记', learning: '学习',
}

const MAX_RAW_TEXT_CHARS = 3000

// 周期实际边界由客户端以其本地时区计算后随请求传入（from_ts/to_ts），服务端
// 原样用于 entries 查询——不能从 period_start 自推：'YYYY-MM-DD' 会被解析成
// UTC 午夜，UTC+8 用户周期头 8 小时的记录会错归到上一周期。
// period_start 仅作 summaries 表的缓存键。

Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), { status: 405, headers: cors })
  }

  // JWT verification is left at the platform default (verify_jwt = true, not
  // disabled in config.toml) — this handler additionally forwards the
  // caller's JWT into the Supabase client below so RLS scopes the entries
  // query to that user; it never uses the service role.
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'missing authorization' }), { status: 401, headers: cors })
  }

  let body: { period_type?: string; period_start?: string; from_ts?: string; to_ts?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json body' }), { status: 400, headers: cors })
  }
  const { period_type, period_start, from_ts, to_ts } = body
  if (period_type !== 'week' && period_type !== 'month') {
    return new Response(JSON.stringify({ error: 'period_type must be week or month' }), { status: 400, headers: cors })
  }
  if (!period_start || Number.isNaN(Date.parse(period_start))) {
    return new Response(JSON.stringify({ error: 'period_start required (YYYY-MM-DD)' }), { status: 400, headers: cors })
  }
  if (typeof from_ts !== 'string' || Number.isNaN(Date.parse(from_ts)) ||
      typeof to_ts !== 'string' || Number.isNaN(Date.parse(to_ts))) {
    return new Response(JSON.stringify({ error: 'from_ts/to_ts required (ISO timestamps)' }), { status: 400, headers: cors })
  }
  if (Date.parse(from_ts) >= Date.parse(to_ts)) {
    return new Response(JSON.stringify({ error: 'from_ts must be before to_ts' }), { status: 400, headers: cors })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey) {
    return new Response(JSON.stringify({ error: 'supabase env not configured' }), { status: 500, headers: cors })
  }

  // Client carries the caller's JWT so `entries`/`summaries` RLS ("own rows")
  // naturally scopes every query below — no service-role key involved.
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: 'invalid token' }), { status: 401, headers: cors })
  }
  const userId = userData.user.id

  const { data: entries, error: entriesErr } = await supabase
    .from('entries')
    .select('ts, domain, raw_text')
    .gte('ts', from_ts)
    .lt('ts', to_ts)
    .order('ts', { ascending: true })
    .limit(500)
  if (entriesErr) {
    return new Response(JSON.stringify({ error: 'query entries failed' }), { status: 500, headers: cors })
  }

  const rows = entries ?? []
  const counts: Record<string, number> = {}
  for (const r of rows) counts[r.domain] = (counts[r.domain] ?? 0) + 1
  const countLines = Object.entries(counts)
    .map(([d, n]) => `${DOMAIN_LABEL[d] ?? d}: ${n} 条`)
    .join('；')

  let notable = rows.map((r) => `- ${r.raw_text}`).join('\n')
  if (notable.length > MAX_RAW_TEXT_CHARS) notable = notable.slice(0, MAX_RAW_TEXT_CHARS)

  const periodLabel = period_type === 'week' ? '本周' : '本月'
  const userPrompt = `以下是用户${periodLabel}（${period_start} 起）的生活记录。

各类目条数：${countLines || '无记录'}

原始记录：
${notable || '（无）'}

请用中文写一段不超过 300 字的总结，包含：数据概览、模式观察、下阶段建议。直接输出总结正文，不要标题、不要 markdown。`

  const baseUrl = Deno.env.get('LLM_BASE_URL') ?? DEFAULT_LLM_BASE_URL
  const model = Deno.env.get('LLM_MODEL') ?? DEFAULT_LLM_MODEL
  const apiKey = Deno.env.get('LLM_API_KEY')
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'LLM_API_KEY not configured' }), { status: 500, headers: cors })
  }

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
          { role: 'system', content: '你是一个生活记录分析助手，擅长从零散的生活记录中总结模式并给出简短可执行的建议。' },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(15000),
    })
  } catch {
    return new Response(JSON.stringify({ error: 'llm unreachable' }), { status: 502, headers: cors })
  }
  if (!resp.ok) return new Response(JSON.stringify({ error: `llm ${resp.status}` }), { status: 502, headers: cors })

  let content: string
  try {
    const respBody = await resp.json()
    content = String(respBody.choices[0].message.content).trim()
  } catch {
    return new Response(JSON.stringify({ error: 'llm malformed response' }), { status: 502, headers: cors })
  }
  if (!content) {
    return new Response(JSON.stringify({ error: 'llm returned empty content' }), { status: 502, headers: cors })
  }

  const { error: upsertErr } = await supabase
    .from('summaries')
    .upsert(
      { user_id: userId, period_type, period_start, content },
      { onConflict: 'user_id,period_type,period_start' },
    )
  if (upsertErr) {
    return new Response(JSON.stringify({ error: 'save summary failed' }), { status: 500, headers: cors })
  }

  return new Response(JSON.stringify({ content }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
