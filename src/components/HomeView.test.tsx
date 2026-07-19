import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import type { DailyImage } from '../lib/dailyImage'

const fetchDailyImageMock = vi.fn()
vi.mock('../lib/dailyImage', () => ({
  fetchDailyImage: (onSettled?: (img: DailyImage | null) => void) => fetchDailyImageMock(onSettled),
}))

import { HomeView } from './HomeView'

/** 模拟「缓存命中」或「fast 段直接失败」：onSettled 与外层 resolve 携带同一个最终值，无中间态。 */
function mockSettledImmediately(img: DailyImage | null) {
  fetchDailyImageMock.mockImplementation((onSettled?: (i: DailyImage | null) => void) => {
    onSettled?.(img)
    return Promise.resolve(img)
  })
}

/** 模拟两段式：fast 立即回（作为外层 resolve）；full 段的到位时机由测试用例通过返回的
 * settle() 显式触发（而非 setTimeout），避免真实定时器/微任务交织带来的时序不确定性。 */
function mockTwoPhase(fast: DailyImage) {
  let release: (v: DailyImage | null) => void = () => {}
  fetchDailyImageMock.mockImplementation((onSettled?: (i: DailyImage | null) => void) => {
    release = (v) => onSettled?.(v)
    return Promise.resolve(fast)
  })
  return { settle: (v: DailyImage | null) => act(() => release(v)) }
}

describe('HomeView（V1.8 玻璃画框封面 + 句子三态）', () => {
  beforeEach(() => {
    fetchDailyImageMock.mockReset()
    mockSettledImmediately(null)
  })

  it('渲染大日期', async () => {
    render(<HomeView active />)
    expect(await screen.findByText(/月.*日.*周/)).toBeTruthy()
  })

  it('大日期含年份', async () => {
    render(<HomeView active />)
    expect(await screen.findByText(/\d{4}年\d{1,2}月\d{1,2}日 周[日一二三四五六]/)).toBeTruthy()
  })

  it('渲染每日一句（含出处，settled 后 image 为空 → 语录兜底）', async () => {
    render(<HomeView active />)
    expect(await screen.findByText(/——/)).toBeTruthy()
  })

  it('active=false 不拉取图片', () => {
    render(<HomeView active={false} />)
    expect(fetchDailyImageMock).not.toHaveBeenCalled()
  })

  it('图片获取失败/离线 → 降级纯色块，不渲染 img', async () => {
    mockSettledImmediately(null)
    render(<HomeView active />)
    await waitFor(() => expect(fetchDailyImageMock).toHaveBeenCalled())
    const box = document.querySelector('.home-hero')
    expect(box?.className).toContain('home-hero-fallback')
    expect(box?.querySelector('img')).toBeNull()
  })

  it('图片获取成功 → 渲染 img', async () => {
    mockSettledImmediately({ url: 'https://cn.bing.com/x.jpg', copyright: 'c', sentence: null })
    render(<HomeView active />)
    await waitFor(() => {
      const img = document.querySelector('.home-hero img')
      expect(img).toBeTruthy()
    })
  })

  it('home-view 只有两个子节点：hero 画卡 + 下方文字块（无其余内容）', async () => {
    render(<HomeView active />)
    await waitFor(() => expect(fetchDailyImageMock).toHaveBeenCalled())
    const homeView = document.querySelector('.home-view')
    expect(homeView?.children.length).toBe(2)
    expect(homeView?.children[0]?.className).toContain('home-hero-wrap')
    expect(homeView?.children[1]?.className).toContain('home-text-block')
  })

  it('§A 图上不再叠字：scrim/overlay 类已移除', async () => {
    render(<HomeView active />)
    await waitFor(() => expect(fetchDailyImageMock).toHaveBeenCalled())
    expect(document.querySelector('.home-hero-scrim')).toBeNull()
    expect(document.querySelector('.home-hero-overlay')).toBeNull()
  })

  it('§A hero 内含液态玻璃环元素', async () => {
    render(<HomeView active />)
    await waitFor(() => expect(fetchDailyImageMock).toHaveBeenCalled())
    expect(document.querySelector('.home-hero .home-hero-glass-ring')).toBeTruthy()
  })

  it('§A 文字块（日期/句子）下移到图下方，不再叠在图上', async () => {
    render(<HomeView active />)
    const textBlock = document.querySelector('.home-text-block')
    expect(textBlock?.textContent).toMatch(/\d{4}年\d{1,2}月\d{1,2}日 周[日一二三四五六]/)
    expect(document.querySelector('.home-hero')?.textContent).toBe('')
  })

  it('图片含地点（copyright）→ 图片下方显示地点原文（不依赖句子是否到位）', async () => {
    mockSettledImmediately({ url: 'https://cn.bing.com/x.jpg', copyright: '在沙巴的水稻田，老街，越南', sentence: null })
    render(<HomeView active />)
    expect(await screen.findByText('在沙巴的水稻田，老街，越南')).toBeTruthy()
  })

  it('daily-image 返回地点化 sentence → 显示该句，不显示语录出处', async () => {
    mockSettledImmediately({ url: 'https://cn.bing.com/x.jpg', copyright: 'c', sentence: '稻浪起伏处，是异乡也是归途。' })
    render(<HomeView active />)
    expect(await screen.findByText('稻浪起伏处，是异乡也是归途。')).toBeTruthy()
    expect(screen.queryByText(/——/)).toBeNull()
  })

  it('sentence 为 null（LLM 失败/离线，已 settled）→ 降级为语录库（含出处）', async () => {
    mockSettledImmediately({ url: 'https://cn.bing.com/x.jpg', copyright: 'c', sentence: null })
    render(<HomeView active />)
    expect(await screen.findByText(/——/)).toBeTruthy()
  })

  it('不再渲染狗 banner（移至 App 全局，贴 tab 栏上方）', () => {
    render(<HomeView active />)
    expect(document.querySelector('.dog-banner')).toBeNull()
  })

  it('不再渲染心情行/本季banner/日历/统计卡/规划区（均已迁往记录页/回顾页/规划tab）', () => {
    render(<HomeView active />)
    expect(document.querySelector('.mood-row')).toBeNull()
    expect(document.querySelector('.home-quarter-banner')).toBeNull()
    expect(document.querySelector('.cal')).toBeNull()
    expect(document.querySelector('.stats-card')).toBeNull()
    expect(screen.queryByText('规划')).toBeNull()
    expect(screen.queryByText('旅行规划')).toBeNull()
    expect(screen.queryByText('学习规划')).toBeNull()
  })

  describe('§B 句子三态：loading → ai / fallback，绝不提前闪现语录', () => {
    it('fast 到位、full 在途 → 句子位显示占位「…」，不显示语录', async () => {
      mockTwoPhase({ url: 'https://cn.bing.com/x.jpg', copyright: 'c', sentence: null })
      render(<HomeView active />)
      await waitFor(() => expect(document.querySelector('.home-hero img')).toBeTruthy())
      // full 段尚未 settle（测试未调用 settle()），句子位应为占位符，不能是语录
      expect(document.querySelector('.home-sentence-loading')?.textContent).toBe('…')
      expect(screen.queryByText(/——/)).toBeNull()
    })

    it('full 到位有句 → loading 切到 ai，显示该句', async () => {
      const { settle } = mockTwoPhase({ url: 'https://cn.bing.com/x.jpg', copyright: 'c', sentence: null })
      render(<HomeView active />)
      await waitFor(() => expect(document.querySelector('.home-hero img')).toBeTruthy())
      expect(document.querySelector('.home-sentence-loading')).toBeTruthy() // full 在途中：占位
      settle({ url: 'https://cn.bing.com/x.jpg', copyright: 'c', sentence: '稻浪起伏处，是异乡也是归途。' })
      expect(await screen.findByText('稻浪起伏处，是异乡也是归途。')).toBeTruthy()
      expect(document.querySelector('.home-sentence-loading')).toBeNull()
    })

    it('full 到位无句（LLM 失败）→ loading 才切到 fallback（语录），不早于 settled', async () => {
      const { settle } = mockTwoPhase({ url: 'https://cn.bing.com/x.jpg', copyright: 'c', sentence: null })
      render(<HomeView active />)
      await waitFor(() => expect(document.querySelector('.home-hero img')).toBeTruthy())
      expect(document.querySelector('.home-sentence-loading')?.textContent).toBe('…')
      expect(screen.queryByText(/——/)).toBeNull()
      // full 段 settle(fast，无句) 后才允许切到 fallback
      settle({ url: 'https://cn.bing.com/x.jpg', copyright: 'c', sentence: null })
      expect(await screen.findByText(/——/)).toBeTruthy()
      expect(document.querySelector('.home-sentence-loading')).toBeNull()
    })

    it('缓存命中（含句）→ 直接 ai，无 loading 闪烁', async () => {
      mockSettledImmediately({ url: 'https://cn.bing.com/x.jpg', copyright: 'c', sentence: '缓存句子' })
      render(<HomeView active />)
      expect(await screen.findByText('缓存句子')).toBeTruthy()
    })
  })
})
