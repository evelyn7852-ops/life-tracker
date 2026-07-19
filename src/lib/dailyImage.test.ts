import { describe, it, expect, vi, beforeEach } from 'vitest'

const invokeMock = vi.fn()
vi.mock('./supabase', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invokeMock(...a) } } }))

import { fetchDailyImage } from './dailyImage'

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('fetchDailyImage（两段式，§B onSettled 契约）', () => {
  beforeEach(() => {
    invokeMock.mockReset()
    localStorage.clear()
  })

  it('fast 段秒回图（sentence null），完整段到位后触发 onSettled(带句) 并写缓存', async () => {
    invokeMock.mockImplementation((name: string) =>
      Promise.resolve(
        name === 'daily-image?fast=1'
          ? { data: { url: 'https://cn.bing.com/x.jpg', copyright: '在沙巴的水稻田，老街，越南', sentence: null }, error: null }
          : { data: { url: 'https://cn.bing.com/x.jpg', copyright: '在沙巴的水稻田，老街，越南', sentence: '稻浪起伏处，是异乡也是归途。' }, error: null },
      ),
    )
    const onSettled = vi.fn()
    const img = await fetchDailyImage(onSettled)
    expect(img).toEqual({ url: 'https://cn.bing.com/x.jpg', copyright: '在沙巴的水稻田，老街，越南', sentence: null })
    expect(invokeMock).toHaveBeenCalledWith('daily-image?fast=1', { method: 'GET' })
    expect(onSettled).not.toHaveBeenCalled() // fast 回来时完整段仍在途，尚未 settle
    await flush()
    expect(onSettled).toHaveBeenCalledTimes(1)
    expect(onSettled).toHaveBeenCalledWith(expect.objectContaining({ sentence: '稻浪起伏处，是异乡也是归途。' }))
    expect(JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith('daily_image'))!)!).sentence).toBe('稻浪起伏处，是异乡也是归途。')
  })

  it('完整段 LLM 失败（sentence null）→ 不写缓存，但仍 onSettled(fast) 恰好一次，标记「完整尝试已结束」', async () => {
    invokeMock.mockResolvedValue({ data: { url: 'https://cn.bing.com/x.jpg', copyright: 'c', sentence: null }, error: null })
    const onSettled = vi.fn()
    const img = await fetchDailyImage(onSettled)
    expect(img?.sentence).toBeNull()
    await flush()
    expect(onSettled).toHaveBeenCalledTimes(1)
    expect(onSettled).toHaveBeenCalledWith(expect.objectContaining({ sentence: null }))
    expect(Object.keys(localStorage).some((k) => k.startsWith('daily_image'))).toBe(false)
  })

  it('响应缺失 sentence 字段（旧版函数/异常响应）→ 视为 null，不抛错', async () => {
    invokeMock.mockResolvedValue({ data: { url: 'https://cn.bing.com/x.jpg', copyright: 'c' }, error: null })
    const img = await fetchDailyImage()
    expect(img?.sentence).toBeNull()
  })

  it('缓存命中（含句）→ 不再调用 invoke，onSettled 立即触发一次（携带缓存值）', async () => {
    invokeMock.mockResolvedValue({ data: { url: 'https://cn.bing.com/x.jpg', copyright: 'c', sentence: 's' }, error: null })
    await fetchDailyImage()
    await flush() // 等后台完整段写缓存
    invokeMock.mockClear()
    const onSettled = vi.fn()
    const img2 = await fetchDailyImage(onSettled)
    expect(invokeMock).not.toHaveBeenCalled()
    expect(img2).toEqual({ url: 'https://cn.bing.com/x.jpg', copyright: 'c', sentence: 's' })
    expect(onSettled).toHaveBeenCalledTimes(1)
    expect(onSettled).toHaveBeenCalledWith({ url: 'https://cn.bing.com/x.jpg', copyright: 'c', sentence: 's' })
  })

  it('fast 段 invoke 报错 → 返回 null，onSettled(null) 触发一次', async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error('boom') })
    const onSettled = vi.fn()
    const img = await fetchDailyImage(onSettled)
    expect(img).toBeNull()
    expect(onSettled).toHaveBeenCalledTimes(1)
    expect(onSettled).toHaveBeenCalledWith(null)
  })

  it('invoke 抛异常（离线）→ 返回 null', async () => {
    invokeMock.mockRejectedValue(new Error('offline'))
    const img = await fetchDailyImage()
    expect(img).toBeNull()
  })
})
