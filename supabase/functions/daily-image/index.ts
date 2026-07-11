import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

// Bing 每日一图（中国站）。经服务端代理是因为浏览器直取有 CORS 墙。
const BING_URL = 'https://cn.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN'

// Same provider defaults as summarize/parse-entry — see those files for why these are pinned.
const DEFAULT_LLM_BASE_URL = 'https://apihub.agnes-ai.com/v1'
const DEFAULT_LLM_MODEL = 'agnes-2.0-flash'

const SENTENCE_SYSTEM = '你是一个旅行随笔作者。只输出一句中文短句，不超过18个字；不要加引号、不要署名、不要引用他人诗句或格言（避免杜撰出处）；语气贴近旅行/生活/自然，与地点或当前季节呼应。直接输出正文，不要任何解释或标点前后缀。'

/** 基于 Bing 图片版权信息（含地点）请求 LLM 生成一句地点化短句；失败/未配置时返回 null，调用方降级为语录库。 */
async function generateSentence(copyright: string, debug?: (msg: string) => void): Promise<string | null> {
  const apiKey = Deno.env.get('LLM_API_KEY')
  if (!apiKey) { debug?.('no LLM_API_KEY'); return null }
  const baseUrl = Deno.env.get('LLM_BASE_URL') ?? DEFAULT_LLM_BASE_URL
  const model = Deno.env.get('LLM_MODEL') ?? DEFAULT_LLM_MODEL

  const place = copyright.trim()
  // 东八区月份 → 季节，注入 prompt 防止 LLM 瞎猜季节
  const month = new Date(Date.now() + 8 * 3600_000).getUTCMonth() + 1
  const season = month <= 2 || month === 12 ? '冬' : month <= 5 ? '春' : month <= 8 ? '夏' : '秋'
  const timeHint = `当前是${month}月，${season}季`
  const userPrompt = place
    ? `图片版权信息：「${place}」。${timeHint}。请基于其中的地点和当前季节，写一句中文短句。`
    : `${timeHint}。请写一句中文短句，贴合旅行/生活/自然的氛围，呼应当前季节。`

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
          { role: 'system', content: SENTENCE_SYSTEM },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 100,
        temperature: 0.8,
      }),
      signal: AbortSignal.timeout(20000),
    })
  } catch (e) {
    debug?.(`fetch threw: ${String(e).slice(0, 200)}`)
    return null
  }
  if (!resp.ok) { debug?.(`llm status ${resp.status}: ${(await resp.text()).slice(0, 200)}`); return null }

  try {
    const respBody = await resp.json()
    let content = String(respBody.choices[0].message.content).trim()
    content = content.replace(/^[「"'“」]+|[」"'”「]+$/g, '').trim()
    if (!content) { debug?.('empty content'); return null }
    if (content.length > 18) content = content.slice(0, 18)
    return content
  } catch (e) {
    debug?.(`parse threw: ${String(e).slice(0, 200)}`)
    return null
  }
}

Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), { status: 405, headers: cors })
  }

  let resp: Response
  try {
    resp = await fetch(BING_URL, { signal: AbortSignal.timeout(8000) })
  } catch {
    return new Response(JSON.stringify({ error: 'bing unreachable' }), { status: 502, headers: cors })
  }
  if (!resp.ok) return new Response(JSON.stringify({ error: `bing ${resp.status}` }), { status: 502, headers: cors })

  let body: unknown
  try {
    body = await resp.json()
  } catch {
    return new Response(JSON.stringify({ error: 'bing malformed response' }), { status: 502, headers: cors })
  }

  const images = (body as { images?: unknown[] } | null)?.images
  const first = Array.isArray(images) ? (images[0] as Record<string, unknown> | undefined) : undefined
  const urlPath = first?.url
  if (typeof urlPath !== 'string') {
    return new Response(JSON.stringify({ error: 'bing returned no image' }), { status: 502, headers: cors })
  }
  const copyright = typeof first?.copyright === 'string' ? first.copyright : ''
  // ?fast=1：跳过 LLM 立刻回图（客户端两段式加载，句子随后单独取）
  const params = new URL(req.url).searchParams
  const fast = params.get('fast') === '1'
  const debugMsgs: string[] = []
  const wantDebug = params.get('debug') === '1'
  const sentence = fast ? null : await generateSentence(copyright, wantDebug ? (m) => debugMsgs.push(m) : undefined)

  const payload: Record<string, unknown> = { url: `https://cn.bing.com${urlPath}`, copyright, sentence }
  if (wantDebug) payload.debug = debugMsgs
  return new Response(JSON.stringify(payload), {
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
  })
})
