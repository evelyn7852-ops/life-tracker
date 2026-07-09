import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

// Defaults double as documentation of the provider we've verified works;
// override any of these via `supabase secrets set` in production.
const DEFAULT_LLM_BASE_URL = 'https://apihub.agnes-ai.com/v1'
const DEFAULT_LLM_MODEL = 'agnes-2.0-flash'

// Field names are pinned explicitly per domain because the model has been
// observed to drift onto synonyms (e.g. "book"/"duration") when only given
// a loose description — see task-12 brief corrections.
const SYSTEM = `你把一句中文生活记录解析成 JSON。只输出 JSON，不要解释、不要 markdown 代码块。

输出格式固定为：{"domain":"<domain>","data":{...}}

domain 取值必须是以下六者之一：food | workout | travel | reading | journal | learning

根据 domain，data 的字段名必须严格使用以下英文字段名（不要用同义词、不要用中文键名、不要新增未列出的字段）：
- food: {"meal":"早|午|晚|加餐","items":["..."]}
- workout: {"type":"...","duration_min":数字(可选),"sets":[{"exercise":"...","weight_kg":数字(可选),"sets":数字,"reps":数字}](可选)}
- reading: {"title":"...","pages":数字(可选),"minutes":数字(可选)}
- learning: {"course":"...","topic":"...(可选)","minutes":数字(可选)}
- journal: {"mood":"...(可选)"}
- travel: {"place":"...","note":"...(可选)"}

字段名必须与上面完全一致（例如书名字段是 title 不是 book，时长字段是 minutes 或 duration_min 不是 duration）。`

type DomainKey = 'food' | 'workout' | 'travel' | 'reading' | 'journal' | 'learning'

const DOMAIN_FIELDS: Record<DomainKey, string[]> = {
  food: ['meal', 'items'],
  workout: ['type', 'duration_min', 'sets'],
  reading: ['title', 'pages', 'minutes'],
  learning: ['course', 'topic', 'minutes'],
  journal: ['mood'],
  travel: ['place', 'note'],
}

const DOMAIN_REQUIRED: Record<DomainKey, string[]> = {
  food: ['meal', 'items'],
  workout: ['type'],
  reading: ['title'],
  learning: ['course'],
  journal: [],
  travel: ['place'],
}

function isDomainKey(v: unknown): v is DomainKey {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(DOMAIN_FIELDS, v)
}

// SetGroup whitelist mirrors src/lib/types.ts: exercise/sets/reps required, weight_kg optional.
const SET_GROUP_FIELDS = ['exercise', 'weight_kg', 'sets', 'reps']
const SET_GROUP_REQUIRED = ['exercise', 'sets', 'reps']

// Whitelist each element of workout's sets array; drop elements missing
// required fields. Returns undefined when nothing survives (sets is optional).
function sanitizeSets(sets: unknown): Record<string, unknown>[] | undefined {
  if (!Array.isArray(sets)) return undefined
  const out: Record<string, unknown>[] = []
  for (const el of sets) {
    if (typeof el !== 'object' || el === null) continue
    const record = el as Record<string, unknown>
    const group: Record<string, unknown> = {}
    for (const key of SET_GROUP_FIELDS) {
      if (record[key] !== undefined) group[key] = record[key]
    }
    if (SET_GROUP_REQUIRED.every((key) => group[key] !== undefined)) out.push(group)
  }
  return out.length > 0 ? out : undefined
}

// Whitelist + require: drop any field the model invented, and reject the
// result outright if a required field for that domain is missing.
function sanitizeData(domain: DomainKey, data: unknown): Record<string, unknown> | null {
  if (typeof data !== 'object' || data === null) return null
  const record = data as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of DOMAIN_FIELDS[domain]) {
    if (record[key] !== undefined) out[key] = record[key]
  }
  if (domain === 'workout' && out.sets !== undefined) {
    const sets = sanitizeSets(out.sets)
    if (sets === undefined) delete out.sets
    else out.sets = sets
  }
  for (const key of DOMAIN_REQUIRED[domain]) {
    if (out[key] === undefined) return null
  }
  return out
}

Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  let raw_text: string | undefined
  try {
    ;({ raw_text } = await req.json())
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json body' }), { status: 400, headers: cors })
  }
  if (!raw_text) return new Response(JSON.stringify({ error: 'raw_text required' }), { status: 400, headers: cors })

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
          { role: 'system', content: SYSTEM },
          { role: 'user', content: raw_text },
        ],
        max_tokens: 300,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    return new Response(JSON.stringify({ error: 'llm unreachable' }), { status: 502, headers: cors })
  }
  if (!resp.ok) return new Response(JSON.stringify({ error: `llm ${resp.status}` }), { status: 502, headers: cors })

  let content: string
  try {
    const body = await resp.json()
    content = body.choices[0].message.content
  } catch {
    return new Response(JSON.stringify({ error: 'llm malformed response' }), { status: 502, headers: cors })
  }

  const start = content.indexOf('{')
  const end = content.lastIndexOf('}')
  if (start === -1 || end === -1) {
    return new Response(JSON.stringify({ error: 'llm did not return json' }), { status: 502, headers: cors })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(content.slice(start, end + 1))
  } catch {
    return new Response(JSON.stringify({ error: 'llm json parse failed' }), { status: 502, headers: cors })
  }

  const domain = (parsed as Record<string, unknown> | null)?.domain
  if (!isDomainKey(domain)) {
    return new Response(JSON.stringify({ error: 'llm returned unknown domain' }), { status: 502, headers: cors })
  }

  const data = sanitizeData(domain, (parsed as Record<string, unknown>).data)
  if (data === null) {
    return new Response(JSON.stringify({ error: 'llm returned invalid data fields' }), { status: 502, headers: cors })
  }

  return new Response(JSON.stringify({ domain, data }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
