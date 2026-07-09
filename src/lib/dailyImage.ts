import { supabase } from './supabase'

export interface DailyImage { url: string; copyright: string }

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

/** 每日一图：先查本地缓存，未命中则调用 Edge Function；失败/离线返回 null（调用方降级为纯色块）。 */
export async function fetchDailyImage(): Promise<DailyImage | null> {
  const key = todayKey()
  const cached = readCache(key)
  if (cached) return cached

  try {
    const { data, error } = await supabase.functions.invoke('daily-image', { method: 'GET' })
    if (error || typeof data?.url !== 'string') return null
    const image: DailyImage = { url: data.url, copyright: typeof data.copyright === 'string' ? data.copyright : '' }
    writeCache(key, image)
    return image
  } catch {
    return null
  }
}
