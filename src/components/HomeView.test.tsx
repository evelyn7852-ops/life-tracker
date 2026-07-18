import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const fetchDailyImageMock = vi.fn()
vi.mock('../lib/dailyImage', () => ({ fetchDailyImage: () => fetchDailyImageMock() }))

import { HomeView } from './HomeView'

describe('HomeView（V1.7 纯封面首页）', () => {
  beforeEach(() => {
    fetchDailyImageMock.mockReset().mockResolvedValue(null)
  })

  it('渲染大日期', async () => {
    render(<HomeView active />)
    expect(await screen.findByText(/月.*日.*周/)).toBeTruthy()
  })

  it('大日期含年份', async () => {
    render(<HomeView active />)
    expect(await screen.findByText(/\d{4}年\d{1,2}月\d{1,2}日 周[日一二三四五六]/)).toBeTruthy()
  })

  it('渲染每日一句（含出处）', async () => {
    render(<HomeView active />)
    expect(await screen.findByText(/——/)).toBeTruthy()
  })

  it('active=false 不拉取图片', () => {
    render(<HomeView active={false} />)
    expect(fetchDailyImageMock).not.toHaveBeenCalled()
  })

  it('图片获取失败/离线 → 降级纯色块，不渲染 img', async () => {
    fetchDailyImageMock.mockResolvedValue(null)
    render(<HomeView active />)
    await waitFor(() => expect(fetchDailyImageMock).toHaveBeenCalled())
    const box = document.querySelector('.home-hero')
    expect(box?.className).toContain('home-hero-fallback')
    expect(box?.querySelector('img')).toBeNull()
  })

  it('图片获取成功 → 渲染 img', async () => {
    fetchDailyImageMock.mockResolvedValue({ url: 'https://cn.bing.com/x.jpg', copyright: 'c', sentence: null })
    render(<HomeView active />)
    await waitFor(() => {
      const img = document.querySelector('.home-hero img')
      expect(img).toBeTruthy()
    })
  })

  it('hero 出血块是 home-view 唯一的子元素（纯封面，无其他内容）', () => {
    render(<HomeView active />)
    const homeView = document.querySelector('.home-view')
    expect(homeView?.children.length).toBe(1)
    expect(homeView?.firstElementChild?.className).toContain('home-hero-wrap')
  })

  it('hero 叠字层含日期', async () => {
    render(<HomeView active />)
    const overlay = document.querySelector('.home-hero-overlay')
    expect(overlay?.textContent).toMatch(/\d{4}年\d{1,2}月\d{1,2}日 周[日一二三四五六]/)
  })

  it('图片含地点（copyright）→ 图片下方显示地点原文', async () => {
    fetchDailyImageMock.mockResolvedValue({ url: 'https://cn.bing.com/x.jpg', copyright: '在沙巴的水稻田，老街，越南', sentence: null })
    render(<HomeView active />)
    expect(await screen.findByText('在沙巴的水稻田，老街，越南')).toBeTruthy()
  })

  it('daily-image 返回地点化 sentence → 显示该句，不显示语录出处', async () => {
    fetchDailyImageMock.mockResolvedValue({ url: 'https://cn.bing.com/x.jpg', copyright: 'c', sentence: '稻浪起伏处，是异乡也是归途。' })
    render(<HomeView active />)
    expect(await screen.findByText('稻浪起伏处，是异乡也是归途。')).toBeTruthy()
    expect(screen.queryByText(/——/)).toBeNull()
  })

  it('sentence 为 null（LLM 失败/离线）→ 降级为语录库（含出处）', async () => {
    fetchDailyImageMock.mockResolvedValue({ url: 'https://cn.bing.com/x.jpg', copyright: 'c', sentence: null })
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
})
