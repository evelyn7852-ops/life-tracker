import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const listEntriesMock = vi.fn()
vi.mock('../lib/entriesRepo', () => ({ listEntries: (o: unknown) => listEntriesMock(o) }))

import { DayDetail } from './DayDetail'

const entry = {
  id: 'e1', ts: '2026-07-09T10:00:00Z', domain: 'journal' as const,
  raw_text: '今天很开心', data: { mood: '😊' }, parse_source: 'manual' as const, tags: [],
}

describe('DayDetail', () => {
  beforeEach(() => {
    listEntriesMock.mockReset().mockResolvedValue([])
  })

  it('渲染日期标题', () => {
    render(<DayDetail date={new Date(2026, 6, 9)} onClose={() => {}} onNavigate={() => {}} />)
    expect(screen.getByText(/7月9日/)).toBeTruthy()
  })

  it('按当天范围查询并渲染只读记录', async () => {
    listEntriesMock.mockResolvedValue([entry])
    render(<DayDetail date={new Date(2026, 6, 9)} onClose={() => {}} onNavigate={() => {}} />)
    expect(await screen.findByText('今天很开心')).toBeTruthy()
    // readOnly：无删除按钮
    expect(screen.queryByText('删')).toBeNull()
    const [opts] = listEntriesMock.mock.calls[0]
    expect(Number.isNaN(Date.parse(opts.fromTs))).toBe(false)
    expect(Number.isNaN(Date.parse(opts.toTs))).toBe(false)
    expect(new Date(opts.fromTs).getTime()).toBeLessThan(new Date(opts.toTs).getTime())
  })

  it('无记录 → 显示空态', async () => {
    render(<DayDetail date={new Date(2026, 6, 9)} onClose={() => {}} onNavigate={() => {}} />)
    expect(await screen.findByText('没有记录')).toBeTruthy()
  })

  it('点击 → 前一天/后一天触发 onNavigate', async () => {
    const onNavigate = vi.fn()
    render(<DayDetail date={new Date(2026, 6, 9)} onClose={() => {}} onNavigate={onNavigate} />)
    await userEvent.click(screen.getByLabelText('前一天'))
    expect(onNavigate).toHaveBeenCalledWith(-1)
    await userEvent.click(screen.getByLabelText('后一天'))
    expect(onNavigate).toHaveBeenCalledWith(1)
  })

  it('点击关闭 → 触发 onClose', async () => {
    const onClose = vi.fn()
    render(<DayDetail date={new Date(2026, 6, 9)} onClose={onClose} onNavigate={() => {}} />)
    await userEvent.click(screen.getByLabelText('关闭'))
    expect(onClose).toHaveBeenCalled()
  })

  it('切换 date prop → 重新查询', async () => {
    const { rerender } = render(<DayDetail date={new Date(2026, 6, 9)} onClose={() => {}} onNavigate={() => {}} />)
    await waitFor(() => expect(listEntriesMock).toHaveBeenCalledTimes(1))
    rerender(<DayDetail date={new Date(2026, 6, 10)} onClose={() => {}} onNavigate={() => {}} />)
    await waitFor(() => expect(listEntriesMock).toHaveBeenCalledTimes(2))
  })
})
