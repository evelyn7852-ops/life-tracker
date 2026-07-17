import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const listEntriesMock = vi.fn()
vi.mock('../lib/entriesRepo', () => ({ listEntries: (o: unknown) => listEntriesMock(o) }))

const getSummaryMock = vi.fn()
const generateSummaryMock = vi.fn()
vi.mock('../lib/summaryRepo', () => ({
  getSummary: (t: string, s: string) => getSummaryMock(t, s),
  generateSummary: (t: string, s: string, f: string, to: string) => generateSummaryMock(t, s, f, to),
}))

import { WeekView, weekStart, weekRangeLabel } from './WeekView'

describe('weekStart 周日起始', () => {
  it('2026-07-09（周四）→ 周起始为 2026-07-05（周日）', () => {
    const start = weekStart(new Date(2026, 6, 9))
    expect(start.getFullYear()).toBe(2026)
    expect(start.getMonth()).toBe(6)
    expect(start.getDate()).toBe(5)
    expect(start.getDay()).toBe(0)
  })

  it('本身就是周日 → 周起始为当天', () => {
    const start = weekStart(new Date(2026, 6, 5))
    expect(start.getDate()).toBe(5)
  })

  it('归零时分秒', () => {
    const start = weekStart(new Date(2026, 6, 9, 15, 30, 0))
    expect(start.getHours()).toBe(0)
    expect(start.getMinutes()).toBe(0)
  })
})

describe('weekRangeLabel 范围标注', () => {
  it('2026-07-09 所在周 → 「7月5日–7月11日」', () => {
    expect(weekRangeLabel(new Date(2026, 6, 9))).toBe('7月5日–7月11日')
  })
})

describe('WeekView AI 总结', () => {
  beforeEach(() => {
    listEntriesMock.mockReset().mockResolvedValue([])
    getSummaryMock.mockReset()
    generateSummaryMock.mockReset()
  })

  it('已有缓存总结 → 直接展示 + 重新生成按钮', async () => {
    getSummaryMock.mockResolvedValue({
      id: 's1', period_type: 'week', period_start: '2026-07-06',
      content: '本周总结内容', created_at: '2026-07-09T00:00:00Z',
    })
    render(<WeekView refreshKey={0} active />)
    expect(await screen.findByText('本周总结内容')).toBeTruthy()
    expect(screen.getByText('重新生成')).toBeTruthy()
  })

  it('无缓存 → 显示生成按钮，点击后进入生成中态，完成后展示内容', async () => {
    getSummaryMock.mockResolvedValue(null)
    let resolveGen!: (v: string) => void
    generateSummaryMock.mockReturnValue(new Promise((r) => { resolveGen = r }))
    render(<WeekView refreshKey={0} active />)
    const genBtn = await screen.findByText('生成本周总结')
    await userEvent.click(genBtn)
    expect(await screen.findByText('生成中…')).toBeTruthy()
    resolveGen('生成的总结')
    expect(await screen.findByText('生成的总结')).toBeTruthy()
  })

  it('生成请求带本地时区 ISO 边界 from_ts/to_ts 且 from<to', async () => {
    getSummaryMock.mockResolvedValue(null)
    generateSummaryMock.mockResolvedValue('ok')
    render(<WeekView refreshKey={0} active />)
    await userEvent.click(await screen.findByText('生成本周总结'))
    expect(generateSummaryMock).toHaveBeenCalledWith(
      'week',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      expect.any(String),
      expect.any(String),
    )
    const [, periodStartArg, fromTs, toTs] = generateSummaryMock.mock.calls[0]
    // ISO 且可解析
    expect(Number.isNaN(Date.parse(fromTs))).toBe(false)
    expect(Number.isNaN(Date.parse(toTs))).toBe(false)
    expect(new Date(fromTs).getTime()).toBeLessThan(new Date(toTs).getTime())
    // from_ts 是本地周日 00:00（非 UTC 解析的 period_start）
    const localSunday = new Date()
    localSunday.setDate(localSunday.getDate() - localSunday.getDay())
    localSunday.setHours(0, 0, 0, 0)
    expect(fromTs).toBe(localSunday.toISOString())
    // period_start 仍是本地日期字符串（缓存键）
    expect(periodStartArg).toBe(
      `${localSunday.getFullYear()}-${String(localSunday.getMonth() + 1).padStart(2, '0')}-${String(localSunday.getDate()).padStart(2, '0')}`,
    )
    // to_ts = 本地下周日 00:00
    const localNextSunday = new Date(localSunday)
    localNextSunday.setDate(localNextSunday.getDate() + 7)
    expect(toTs).toBe(localNextSunday.toISOString())
  })

  it('切到本月 → 用 month 参数重新查询缓存', async () => {
    getSummaryMock.mockResolvedValue(null)
    render(<WeekView refreshKey={0} active />)
    await waitFor(() => expect(getSummaryMock).toHaveBeenCalledWith('week', expect.any(String)))
    await userEvent.click(screen.getByText('本月'))
    await waitFor(() => expect(getSummaryMock).toHaveBeenCalledWith('month', expect.any(String)))
  })

  it('生成失败 → 显示错误提示', async () => {
    getSummaryMock.mockResolvedValue(null)
    generateSummaryMock.mockRejectedValue(new Error('llm down'))
    render(<WeekView refreshKey={0} active />)
    const genBtn = await screen.findByText('生成本周总结')
    await userEvent.click(genBtn)
    expect(await screen.findByText('生成失败，请重试')).toBeTruthy()
  })

  it('active=false 不查询总结', () => {
    render(<WeekView refreshKey={0} active={false} />)
    expect(getSummaryMock).not.toHaveBeenCalled()
  })
})

describe('WeekView 顶部 streak + 本月计数条', () => {
  beforeEach(() => {
    listEntriesMock.mockReset().mockResolvedValue([])
    getSummaryMock.mockReset().mockResolvedValue(null)
    generateSummaryMock.mockReset()
  })

  it('渲染 streak（🔥 连续 N 天）', async () => {
    const today = new Date()
    const ts = (offset: number) => {
      const d = new Date(today); d.setDate(d.getDate() - offset)
      return d.toISOString()
    }
    listEntriesMock.mockResolvedValue([
      { id: '1', ts: ts(0), domain: 'food', raw_text: '', data: { meal: '早', items: [] }, parse_source: 'manual', tags: [] },
      { id: '2', ts: ts(1), domain: 'food', raw_text: '', data: { meal: '早', items: [] }, parse_source: 'manual', tags: [] },
    ])
    render(<WeekView refreshKey={0} active />)
    expect(await screen.findByText(/🔥.*连续.*2.*天/)).toBeTruthy()
  })

  it('渲染本月计数', async () => {
    listEntriesMock.mockResolvedValue([
      { id: '1', ts: new Date().toISOString(), domain: 'food', raw_text: '', data: { meal: '早', items: [] }, parse_source: 'manual', tags: [] },
    ])
    render(<WeekView refreshKey={0} active />)
    expect(await screen.findByText(/本月.*1.*条/)).toBeTruthy()
  })
})
