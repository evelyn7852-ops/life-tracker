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

  it('渲染心情 emoji 行', () => {
    render(<MoodHeader refreshKey={0} onSaved={() => {}} active />)
    expect(screen.getByText('😊')).toBeTruthy()
    expect(screen.getByText('🥳')).toBeTruthy()
  })

  it('点击 emoji（今日无已有心情）→ saveEntry 新建 journal mood 条', async () => {
    const onSaved = vi.fn()
    render(<MoodHeader refreshKey={0} onSaved={onSaved} active />)
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
    render(<MoodHeader refreshKey={0} onSaved={onSaved} active />)
    await waitFor(() => expect(listEntriesMock).toHaveBeenCalled())
    await userEvent.click(screen.getByText('🥳'))
    expect(updateEntryMock).toHaveBeenCalledWith('e1', { raw_text: '心情 🥳', data: { mood: '🥳' } })
    expect(saveMock).not.toHaveBeenCalled()
    expect(onSaved).toHaveBeenCalled()
  })

  it('active=false 不拉取今日心情', () => {
    render(<MoodHeader refreshKey={0} onSaved={() => {}} active={false} />)
    expect(listEntriesMock).not.toHaveBeenCalled()
  })
})
