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

import { MoodHeader } from './MoodHeader'

describe('MoodHeader（V1.7：心情行从首页回归记录页）', () => {
  beforeEach(() => {
    listEntriesMock.mockReset().mockResolvedValue([])
    updateEntryMock.mockClear()
    saveMock.mockClear()
  })

  it('渲染日期时钟文案', async () => {
    render(<MoodHeader refreshKey={0} onSaved={() => {}} active />)
    expect(await screen.findByText(/月.*日.*周.*:/)).toBeTruthy()
  })

  it('渲染心情行：6 个 Headspace 风心情脸（§C 存库值仍是 emoji，渲染换成 SVG）', () => {
    render(<MoodHeader refreshKey={0} onSaved={() => {}} active />)
    expect(screen.getByRole('button', { name: '开心' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '兴奋' })).toBeTruthy()
    expect(document.querySelectorAll('.mood-row svg.mood-face').length).toBe(6)
  })

  it('点击心情脸（今日无已有心情）→ saveEntry 新建 journal mood 条，写库值仍是 emoji 字符串', async () => {
    const onSaved = vi.fn()
    render(<MoodHeader refreshKey={0} onSaved={onSaved} active />)
    await waitFor(() => expect(listEntriesMock).toHaveBeenCalled())
    await userEvent.click(screen.getByRole('button', { name: '开心' }))
    expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'journal', raw_text: '心情 😊', parse_source: 'manual', data: { mood: '😊' },
    }))
    expect(updateEntryMock).not.toHaveBeenCalled()
    expect(onSaved).toHaveBeenCalled()
  })

  it('点击心情脸（今日已有心情条）→ updateEntry 改之而非新建', async () => {
    listEntriesMock.mockResolvedValue([
      { id: 'e1', ts: new Date().toISOString(), domain: 'journal', raw_text: '心情 😐', data: { mood: '😐' }, parse_source: 'manual', tags: [] },
    ])
    const onSaved = vi.fn()
    render(<MoodHeader refreshKey={0} onSaved={onSaved} active />)
    await waitFor(() => expect(listEntriesMock).toHaveBeenCalled())
    await userEvent.click(screen.getByRole('button', { name: '兴奋' }))
    expect(updateEntryMock).toHaveBeenCalledWith('e1', { raw_text: '心情 🥳', data: { mood: '🥳' } })
    expect(saveMock).not.toHaveBeenCalled()
    expect(onSaved).toHaveBeenCalled()
  })

  it('选中态：已有心情对应的按钮内 SVG 带 mood-face-selected class', async () => {
    listEntriesMock.mockResolvedValue([
      { id: 'e1', ts: new Date().toISOString(), domain: 'journal', raw_text: '心情 😐', data: { mood: '😐' }, parse_source: 'manual', tags: [] },
    ])
    render(<MoodHeader refreshKey={0} onSaved={() => {}} active />)
    await waitFor(() => expect(listEntriesMock).toHaveBeenCalled())
    const calmBtn = await screen.findByRole('button', { name: '平静' })
    expect(calmBtn.querySelector('svg')?.getAttribute('class')).toContain('mood-face-selected')
    const happyBtn = screen.getByRole('button', { name: '开心' })
    expect(happyBtn.querySelector('svg')?.getAttribute('class')).not.toContain('mood-face-selected')
  })

  it('active=false 不拉取今日心情', () => {
    render(<MoodHeader refreshKey={0} onSaved={() => {}} active={false} />)
    expect(listEntriesMock).not.toHaveBeenCalled()
  })
})
