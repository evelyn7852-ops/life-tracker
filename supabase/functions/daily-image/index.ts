import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

// Bing 每日一图（中国站）。经服务端代理是因为浏览器直取有 CORS 墙。
const BING_URL = 'https://cn.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN'

Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
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

  return new Response(JSON.stringify({ url: `https://cn.bing.com${urlPath}`, copyright }), {
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
  })
})
