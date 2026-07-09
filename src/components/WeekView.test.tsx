import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const listEntriesMock = vi.fn()
vi.mock('../lib/entriesRepo', () => ({ listEntries: (o: unknown) => listEntriesMock(o) }))

const getSummaryMock = vi.fn()
const generateSummaryMock = vi.fn()
vi.mock('../lib/summaryRepo', () => ({
  getSummary: (t: string, s: string) => getSummaryMock(t, s),
  generateSummary: (t: string, s: string) => generateSummaryMock(t, s),
}))

import { WeekView } from './WeekView'

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
