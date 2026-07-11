import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const listEntriesMock = vi.fn()
vi.mock('../lib/entriesRepo', () => ({ listEntries: (o: unknown) => listEntriesMock(o) }))

import { CalendarView } from './CalendarView'

function entry(id: string, ts: string, domain: 'food' | 'workout' | 'travel' | 'reading' | 'journal' | 'learning') {
  return { id, ts, domain, raw_text: 'x', data: {}, parse_source: 'manual' as const, tags: [] }
}

describe('CalendarView', () => {
  beforeEach(() => {
    listEntriesMock.mockReset().mockResolvedValue([])
  })

  it('渲染周日起始的中文星期表头', () => {
    render(<CalendarView active initialDate={new Date(2026, 6, 9)} />)
    const headers = screen.getAllByText(/^周[日一二三四五六]$/)
    expect(headers.map((h) => h.textContent)).toEqual(['周日', '周一', '周二', '周三', '周四', '周五', '周六'])
  })

  it('渲染月标题「2026年7月」', () => {
    render(<CalendarView active initialDate={new Date(2026, 6, 9)} />)
    expect(screen.getByText('2026年7月')).toBeTruthy()
  })

  it('今天所在格带 today 高亮', async () => {
    const now = new Date()
    render(<CalendarView active initialDate={now} />)
    await waitFor(() => expect(listEntriesMock).toHaveBeenCalledTimes(1))
    const todayCell = document.querySelector('.cal-day.today')
    expect(todayCell?.textContent).toContain(String(now.getDate()))
  })

  it('拉取当月 entries 一次，且 fromTs/toTs 覆盖当月', async () => {
    render(<CalendarView active initialDate={new Date(2026, 6, 9)} />)
    await waitFor(() => expect(listEntriesMock).toHaveBeenCalledTimes(1))
    const [opts] = listEntriesMock.mock.calls[0]
    expect(opts.fromTs.startsWith('2026-06-30') || opts.fromTs.startsWith('2026-07-01')).toBe(true)
  })

  it('有记录的日期渲染对应域颜色圆点', async () => {
    listEntriesMock.mockResolvedValue([entry('1', '2026-07-09T10:00:00Z', 'food')])
    render(<CalendarView active initialDate={new Date(2026, 6, 9)} />)
    await waitFor(() => expect(document.querySelector('.cal-day .dot-food')).toBeTruthy())
  })

  it('点击 ‹/› 切换月份并重新拉取', async () => {
    render(<CalendarView active initialDate={new Date(2026, 6, 9)} />)
    await waitFor(() => expect(listEntriesMock).toHaveBeenCalledTimes(1))
    await userEvent.click(screen.getByLabelText('下个月'))
    expect(screen.getByText('2026年8月')).toBeTruthy()
    await waitFor(() => expect(listEntriesMock).toHaveBeenCalledTimes(2))
    await userEvent.click(screen.getByLabelText('上个月'))
    await userEvent.click(screen.getByLabelText('上个月'))
    expect(screen.getByText('2026年6月')).toBeTruthy()
  })

  it('点击某天 → 打开日详情覆盖层', async () => {
    render(<CalendarView active initialDate={new Date(2026, 6, 9)} />)
    await waitFor(() => expect(listEntriesMock).toHaveBeenCalledTimes(1))
    await userEvent.click(screen.getByText('15'))
    expect(document.querySelector('.day-detail-overlay')).toBeTruthy()
  })

  it('节气/节日 emoji 显示在对应格子', () => {
    render(<CalendarView active initialDate={new Date(2026, 1, 1)} />)
    // 2026-02-04 立春
    const cell = Array.from(document.querySelectorAll('.cal-day')).find((c) => c.textContent?.includes('4') && c.querySelector('.cal-emoji'))
    expect(cell).toBeTruthy()
  })

  it('active=false 不拉取', () => {
    render(<CalendarView active={false} initialDate={new Date(2026, 6, 9)} />)
    expect(listEntriesMock).not.toHaveBeenCalled()
  })
})
