import { describe, it, expect, vi, beforeEach } from 'vitest'

const invokeMock = vi.fn()
vi.mock('./supabase', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invokeMock(...a) } } }))

import { fetchDailyImage } from './dailyImage'

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('fetchDailyImage（两段式）', () => {
  beforeEach(() => {
    invokeMock.mockReset()
    localStorage.clear()
  })

  it('fast 段秒回图（sentence null），完整段到位后触发 onUpdate 并写缓存', async () => {
    invokeMock.mockImplementation((name: string) =>
      Promise.resolve(
        name === 'daily-image?fast=1'
          ? { data: { url: 'https://cn.bing.com/x.jpg', copyright: '在沙巴的水稻田，老街，越南', sentence: null }, error: null }
          : { data: { url: 'https://cn.bing.com/x.jpg', copyright: '在沙巴的水稻田，老街，越南', sentence: '稻浪起伏处，是异乡也是归途。' }, error: null },
      ),
    )
    const onUpdate = vi.fn()
    const img = await fetchDailyImage(onUpdate)
    expect(img).toEqual({ url: 'https://cn.bing.com/x.jpg', copyright: '在沙巴的水稻田，老街，越南', sentence: null })
    expect(invokeMock).toHaveBeenCalledWith('daily-image?fast=1', { method: 'GET' })
    await flush()
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ sentence: '稻浪起伏处，是异乡也是归途。' }))
    expect(JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith('daily_image'))!)!).sentence).toBe('稻浪起伏处，是异乡也是归途。')
  })

  it('完整段 LLM 失败（sentence null）→ 不写缓存、不触发 onUpdate，下次打开重试', async () => {
    invokeMock.mockResolvedValue({ data: { url: 'https://cn.bing.com/x.jpg', copyright: 'c', sentence: null }, error: null })
    const onUpdate = vi.fn()
    const img = await fetchDailyImage(onUpdate)
    expect(img?.sentence).toBeNull()
    await flush()
    expect(onUpdate).not.toHaveBeenCalled()
    expect(Object.keys(localStorage).some((k) => k.startsWith('daily_image'))).toBe(false)
  })

  it('响应缺失 sentence 字段（旧版函数/异常响应）→ 视为 null，不抛错', async () => {
    invokeMock.mockResolvedValue({ data: { url: 'https://cn.bing.com/x.jpg', copyright: 'c' }, error: null })
    const img = await fetchDailyImage()
    expect(img?.sentence).toBeNull()
  })

  it('缓存命中（含句）→ 不再调用 invoke', async () => {
    invokeMock.mockResolvedValue({ data: { url: 'https://cn.bing.com/x.jpg', copyright: 'c', sentence: 's' }, error: null })
    await fetchDailyImage()
    await flush() // 等后台完整段写缓存
    invokeMock.mockClear()
    const img2 = await fetchDailyImage()
    expect(invokeMock).not.toHaveBeenCalled()
    expect(img2).toEqual({ url: 'https://cn.bing.com/x.jpg', copyright: 'c', sentence: 's' })
  })

  it('fast 段 invoke 报错 → 返回 null', async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error('boom') })
    const img = await fetchDailyImage()
    expect(img).toBeNull()
  })

  it('invoke 抛异常（离线）→ 返回 null', async () => {
    invokeMock.mockRejectedValue(new Error('offline'))
    const img = await fetchDailyImage()
    expect(img).toBeNull()
  })
})
