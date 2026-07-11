import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const listEntriesMock = vi.fn()
const updateEntryMock = vi.fn().mockResolvedValue({})
vi.mock('../lib/entriesRepo', () => ({
  listEntries: (o: unknown) => listEntriesMock(o),
  updateEntry: (id: string, patch: unknown) => updateEntryMock(id, patch),
}))

const saveMock = vi.fn().mockResolvedValue('synced')
vi.mock('../lib/outbox', () => ({ saveEntry: (d: unknown) => saveMock(d) }))

const fetchDailyImageMock = vi.fn()
vi.mock('../lib/dailyImage', () => ({ fetchDailyImage: () => fetchDailyImageMock() }))

import { HomeView } from './HomeView'

describe('HomeView', () => {
  beforeEach(() => {
    listEntriesMock.mockReset().mockResolvedValue([])
    updateEntryMock.mockClear()
    saveMock.mockClear()
    fetchDailyImageMock.mockReset().mockResolvedValue(null)
  })

  it('渲染大日期', async () => {
    render(<HomeView refreshKey={0} onSaved={() => {}} active />)
    expect(await screen.findByText(/月.*日.*周/)).toBeTruthy()
  })

  it('大日期含年份', async () => {
    render(<HomeView refreshKey={0} onSaved={() => {}} active />)
    expect(await screen.findByText(/\d{4}年\d{1,2}月\d{1,2}日 周[日一二三四五六]/)).toBeTruthy()
  })

  it('渲染月历（含当月标题）', async () => {
    render(<HomeView refreshKey={0} onSaved={() => {}} active />)
    const now = new Date()
    expect(await screen.findByText(`${now.getFullYear()}年${now.getMonth() + 1}月`)).toBeTruthy()
  })

  it('渲染每日一句（含出处）', async () => {
    render(<HomeView refreshKey={0} onSaved={() => {}} active />)
    expect(await screen.findByText(/——/)).toBeTruthy()
  })

  it('active=false 不拉取图片/心情', () => {
    render(<HomeView refreshKey={0} onSaved={() => {}} active={false} />)
    expect(fetchDailyImageMock).not.toHaveBeenCalled()
    expect(listEntriesMock).not.toHaveBeenCalled()
  })

  it('图片获取失败/离线 → 降级克莱因蓝纯色块，不渲染 img', async () => {
    fetchDailyImageMock.mockResolvedValue(null)
    render(<HomeView refreshKey={0} onSaved={() => {}} active />)
    await waitFor(() => expect(fetchDailyImageMock).toHaveBeenCalled())
    const box = document.querySelector('.home-image')
    expect(box?.className).toContain('home-image-fallback')
    expect(box?.querySelector('img')).toBeNull()
  })

  it('图片获取成功 → 渲染 img', async () => {
    fetchDailyImageMock.mockResolvedValue({ url: 'https://cn.bing.com/x.jpg', copyright: 'c', sentence: null })
    render(<HomeView refreshKey={0} onSaved={() => {}} active />)
    await waitFor(() => {
      const img = document.querySelector('.home-image img')
      expect(img).toBeTruthy()
    })
  })

  it('图片含地点（copyright）→ 图片下方显示地点原文', async () => {
    fetchDailyImageMock.mockResolvedValue({ url: 'https://cn.bing.com/x.jpg', copyright: '在沙巴的水稻田，老街，越南', sentence: null })
    render(<HomeView refreshKey={0} onSaved={() => {}} active />)
    expect(await screen.findByText('在沙巴的水稻田，老街，越南')).toBeTruthy()
  })

  it('daily-image 返回地点化 sentence → 显示该句，不显示语录出处', async () => {
    fetchDailyImageMock.mockResolvedValue({ url: 'https://cn.bing.com/x.jpg', copyright: 'c', sentence: '稻浪起伏处，是异乡也是归途。' })
    render(<HomeView refreshKey={0} onSaved={() => {}} active />)
    expect(await screen.findByText('稻浪起伏处，是异乡也是归途。')).toBeTruthy()
    expect(screen.queryByText(/——/)).toBeNull()
  })

  it('sentence 为 null（LLM 失败/离线）→ 降级为语录库（含出处）', async () => {
    fetchDailyImageMock.mockResolvedValue({ url: 'https://cn.bing.com/x.jpg', copyright: 'c', sentence: null })
    render(<HomeView refreshKey={0} onSaved={() => {}} active />)
    expect(await screen.findByText(/——/)).toBeTruthy()
  })

  it('点击 emoji（今日无已有心情）→ saveEntry 新建 journal mood 条', async () => {
    const onSaved = vi.fn()
    render(<HomeView refreshKey={0} onSaved={onSaved} active />)
    await waitFor(() => expect(listEntriesMock).toHaveBeenCalled())
    await userEvent.click(screen.getByText('😊'))
    expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'journal', raw_text: '心情 😊', parse_source: 'manual', data: { mood: '😊' },
    }))
    expect(updateEntryMock).not.toHaveBeenCalled()
    expect(onSaved).toHaveBeenCalled()
  })

  it('点击 emoji（今日已有心情条）→ updateEntry 改之而非新建', async () => {
    listEntriesMock.mockResolvedValue([
      { id: 'e1', ts: new Date().toISOString(), domain: 'journal', raw_text: '心情 😐', data: { mood: '😐' }, parse_source: 'manual', tags: [] },
    ])
    const onSaved = vi.fn()
    render(<HomeView refreshKey={0} onSaved={onSaved} active />)
    await waitFor(() => expect(listEntriesMock).toHaveBeenCalled())
    await userEvent.click(screen.getByText('🥳'))
    expect(updateEntryMock).toHaveBeenCalledWith('e1', { raw_text: '心情 🥳', data: { mood: '🥳' } })
    expect(saveMock).not.toHaveBeenCalled()
    expect(onSaved).toHaveBeenCalled()
  })
})
