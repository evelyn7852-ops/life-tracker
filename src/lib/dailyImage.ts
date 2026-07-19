import { supabase } from './supabase'

export interface DailyImage { url: string; copyright: string; sentence: string | null }

function todayKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `daily_image_${y}-${m}-${day}`
}

function readCache(key: string): DailyImage | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DailyImage
    if (typeof parsed?.url === 'string') return parsed
    return null
  } catch {
    return null
  }
}

function writeCache(key: string, image: DailyImage): void {
  try { localStorage.setItem(key, JSON.stringify(image)) } catch { /* storage full/unavailable — ignore */ }
}

function normalize(data: unknown): DailyImage | null {
  const d = data as { url?: unknown; copyright?: unknown; sentence?: unknown } | null
  if (typeof d?.url !== 'string') return null
  return {
    url: d.url,
    copyright: typeof d.copyright === 'string' ? d.copyright : '',
    sentence: typeof d.sentence === 'string' && d.sentence.trim() ? d.sentence : null,
  }
}

async function invoke(fast: boolean): Promise<DailyImage | null> {
  try {
    const name = fast ? 'daily-image?fast=1' : 'daily-image'
    const { data, error } = await supabase.functions.invoke(name, { method: 'GET' })
    if (error) return null
    return normalize(data)
  } catch {
    return null
  }
}

/**
 * 每日一图，两段式：缓存命中直接回；否则先 fast 调用秒回图（sentence null），
 * 再后台取完整版补齐句子。
 *
 * §B 契约：onSettled 在「完整段尝试结束」后**恰好触发一次**，携带最终结果——
 * 缓存命中视为立即 settle（携带缓存值）；fast 段失败直接 settle(null)；
 * fast 成功后台取 full：full 带句 → settle(full) 并落缓存；full 无句/失败 → settle(fast)
 * （不落缓存，下次打开重试），而不是保持沉默——调用方需要明确知道「完整尝试已结束」
 * 才能把句子位从 loading 切到 fallback，避免古诗词提前闪现。
 * 失败/离线返回 null（调用方降级为纯色块 + 语录库）。
 */
export async function fetchDailyImage(onSettled?: (img: DailyImage | null) => void): Promise<DailyImage | null> {
  const key = todayKey()
  const cached = readCache(key)
  if (cached) {
    onSettled?.(cached)
    return cached
  }

  const fast = await invoke(true)
  if (!fast) {
    onSettled?.(null)
    return null
  }

  // 句子后台补齐；LLM 偶发失败时不落缓存（下次打开重试），但仍需 settle(fast) 告知调用方「完整尝试已结束」
  void invoke(false).then((full) => {
    if (full?.sentence) {
      writeCache(key, full)
      onSettled?.(full)
    } else {
      onSettled?.(fast)
    }
  })

  return fast
}
