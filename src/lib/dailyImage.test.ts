import { describe, it, expect, vi, beforeEach } from 'vitest'

const invokeMock = vi.fn()
vi.mock('./supabase', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invokeMock(...a) } } }))

import { fetchDailyImage } from './dailyImage'

describe('fetchDailyImage', () => {
  beforeEach(() => {
    invokeMock.mockReset()
    localStorage.clear()
  })

  it('调用成功且含 sentence → 返回 {url, copyright, sentence} 并写入本日缓存', async () => {
    invokeMock.mockResolvedValue({ data: { url: 'https://cn.bing.com/x.jpg', copyright: '在沙巴的水稻田，老街，越南', sentence: '稻浪起伏处，是异乡也是归途。' }, error: null })
    const img = await fetchDailyImage()
    expect(img).toEqual({ url: 'https://cn.bing.com/x.jpg', copyright: '在沙巴的水稻田，老街，越南', sentence: '稻浪起伏处，是异乡也是归途。' })
    expect(invokeMock).toHaveBeenCalledWith('daily-image', { method: 'GET' })
  })

  it('LLM 生成失败 → sentence 为 null（客户端可降级用语录库）', async () => {
    invokeMock.mockResolvedValue({ data: { url: 'https://cn.bing.com/x.jpg', copyright: 'c', sentence: null }, error: null })
    const img = await fetchDailyImage()
    expect(img?.sentence).toBeNull()
  })

  it('响应缺失 sentence 字段（旧版函数/异常响应）→ 视为 null，不抛错', async () => {
    invokeMock.mockResolvedValue({ data: { url: 'https://cn.bing.com/x.jpg', copyright: 'c' }, error: null })
    const img = await fetchDailyImage()
    expect(img?.sentence).toBeNull()
  })

  it('第二次调用命中本日缓存 → 不再调用 invoke', async () => {
    invokeMock.mockResolvedValue({ data: { url: 'https://cn.bing.com/x.jpg', copyright: 'c', sentence: 's' }, error: null })
    await fetchDailyImage()
    invokeMock.mockClear()
    const img2 = await fetchDailyImage()
    expect(invokeMock).not.toHaveBeenCalled()
    expect(img2).toEqual({ url: 'https://cn.bing.com/x.jpg', copyright: 'c', sentence: 's' })
  })

  it('invoke 报错 → 返回 null', async () => {
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
