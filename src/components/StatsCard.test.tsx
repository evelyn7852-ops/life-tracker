import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'

const listEntriesMock = vi.fn()
const countEntriesMock = vi.fn()
vi.mock('../lib/entriesRepo', () => ({
  listEntries: (o: unknown) => listEntriesMock(o),
  countEntries: (f: string, t: string) => countEntriesMock(f, t),
}))

const listWorkoutsMock = vi.fn()
vi.mock('../lib/workoutRepo', () => ({ listWorkouts: (o: unknown) => listWorkoutsMock(o) }))

import { StatsCard } from './StatsCard'

const journalEntry = (ts: string, mood: string) => ({
  id: ts, ts, domain: 'journal', raw_text: '', data: { mood }, parse_source: 'manual', tags: [],
})
const foodEntry = (ts: string) => ({
  id: ts, ts, domain: 'food', raw_text: '', data: { meal: '早', items: [] }, parse_source: 'manual', tags: [],
})

describe('StatsCard', () => {
  beforeEach(() => {
    listEntriesMock.mockReset().mockResolvedValue([])
    countEntriesMock.mockReset().mockResolvedValue(0)
    listWorkoutsMock.mockReset().mockResolvedValue([])
  })

  it('active=false 不发起任何查询', () => {
    render(<StatsCard refreshKey={0} active={false} />)
    expect(listEntriesMock).not.toHaveBeenCalled()
    expect(countEntriesMock).not.toHaveBeenCalled()
    expect(listWorkoutsMock).not.toHaveBeenCalled()
  })

  it('active=true → 拉近 60 天 entries（一次）+ 本月 workouts + 本年 count', async () => {
    render(<StatsCard refreshKey={0} active />)
    await waitFor(() => expect(listEntriesMock).toHaveBeenCalledTimes(1))
    expect(countEntriesMock).toHaveBeenCalledTimes(1)
    expect(listWorkoutsMock).toHaveBeenCalledTimes(1)
  })

  it('显示 streak（🔥 连续 N 天）', async () => {
    const today = new Date()
    const ts = (offset: number) => {
      const d = new Date(today); d.setDate(d.getDate() - offset)
      return d.toISOString()
    }
    listEntriesMock.mockResolvedValue([foodEntry(ts(0)), foodEntry(ts(1)), foodEntry(ts(2))])
    render(<StatsCard refreshKey={0} active />)
    expect(await screen.findByText(/🔥.*连续.*3.*天/)).toBeTruthy()
  })

  it('显示本月各域计数色块', async () => {
    render(<StatsCard refreshKey={0} active />)
    await waitFor(() => expect(listEntriesMock).toHaveBeenCalled())
    const domains = within(document.querySelector('.stats-domains')!)
    expect(await domains.findByText(/饮食/)).toBeTruthy()
    expect(domains.getByText(/运动/)).toBeTruthy()
    expect(domains.getByText(/旅行/)).toBeTruthy()
    expect(domains.getByText(/阅读/)).toBeTruthy()
    expect(domains.getByText(/日记/)).toBeTruthy()
    expect(domains.getByText(/学习/)).toBeTruthy()
  })

  it('显示近 14 天情绪 sparkline', async () => {
    const today = new Date()
    listEntriesMock.mockResolvedValue([journalEntry(today.toISOString(), '😊')])
    render(<StatsCard refreshKey={0} active />)
    expect(await screen.findByText('😊')).toBeTruthy()
  })

  it('显示年度积累（今年总记录数、本月阅读、本月训练完成、本年旅行）', async () => {
    countEntriesMock.mockResolvedValue(88)
    listWorkoutsMock.mockResolvedValue([
      { id: 'w1', date: '2026-07-01', template_id: null, title: 'A', blocks: [], status: 'done', performed: null, created_at: '' },
      { id: 'w2', date: '2026-07-02', template_id: null, title: 'B', blocks: [], status: 'planned', performed: null, created_at: '' },
    ])
    render(<StatsCard refreshKey={0} active />)
    expect(await screen.findByText(/88/)).toBeTruthy()
    expect(screen.getByText(/本月训练完成 1 次/)).toBeTruthy()
  })

  it('refreshKey 变化 → 重新拉取一次', async () => {
    const { rerender } = render(<StatsCard refreshKey={0} active />)
    await waitFor(() => expect(listEntriesMock).toHaveBeenCalledTimes(1))
    rerender(<StatsCard refreshKey={1} active />)
    await waitFor(() => expect(listEntriesMock).toHaveBeenCalledTimes(2))
  })
})
