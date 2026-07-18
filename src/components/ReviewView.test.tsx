import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const historyPropsSpy = vi.fn()
vi.mock('./HistoryView', () => ({
  HistoryView: (props: { refreshKey: number; active: boolean }) => {
    historyPropsSpy(props)
    return <div data-testid="history-view" />
  },
}))

const weekPropsSpy = vi.fn()
vi.mock('./WeekView', () => ({
  WeekView: (props: { refreshKey: number; active: boolean }) => {
    weekPropsSpy(props)
    return <div data-testid="week-view" />
  },
}))

import { ReviewView } from './ReviewView'

describe('ReviewView', () => {
  beforeEach(() => {
    historyPropsSpy.mockClear()
    weekPropsSpy.mockClear()
  })

  it('默认展示历史 segment，历史 active=true，周览 active=false', () => {
    render(<ReviewView refreshKey={0} active />)
    expect(screen.getByTestId('history-view')).toBeTruthy()
    expect(historyPropsSpy.mock.calls.at(-1)?.[0].active).toBe(true)
    expect(weekPropsSpy.mock.calls.at(-1)?.[0].active).toBe(false)
  })

  it('segment chip 样式与训练页子 tab 一致（复用 .summary-tabs）', () => {
    render(<ReviewView refreshKey={0} active />)
    expect(document.querySelector('.summary-tabs')).toBeTruthy()
    expect(screen.getByText('历史')).toBeTruthy()
    expect(screen.getByText('周览')).toBeTruthy()
  })

  it('点击「周览」chip → 切换后周览 active=true，历史 active=false（隐藏侧不 fetch）', async () => {
    render(<ReviewView refreshKey={0} active />)
    await userEvent.click(screen.getByText('周览'))
    expect(weekPropsSpy.mock.calls.at(-1)?.[0].active).toBe(true)
    expect(historyPropsSpy.mock.calls.at(-1)?.[0].active).toBe(false)
  })

  it('切回「历史」chip → 历史重新 active，周览 active=false', async () => {
    render(<ReviewView refreshKey={0} active />)
    await userEvent.click(screen.getByText('周览'))
    await userEvent.click(screen.getByText('历史'))
    expect(historyPropsSpy.mock.calls.at(-1)?.[0].active).toBe(true)
    expect(weekPropsSpy.mock.calls.at(-1)?.[0].active).toBe(false)
  })

  it('外层 active=false → 两个 segment 均不 active，即便可见', () => {
    render(<ReviewView refreshKey={0} active={false} />)
    expect(historyPropsSpy.mock.calls.at(-1)?.[0].active).toBe(false)
    expect(weekPropsSpy.mock.calls.at(-1)?.[0].active).toBe(false)
  })

  it('refreshKey 原样透传给两个 segment', () => {
    render(<ReviewView refreshKey={7} active />)
    expect(historyPropsSpy.mock.calls.at(-1)?.[0].refreshKey).toBe(7)
    expect(weekPropsSpy.mock.calls.at(-1)?.[0].refreshKey).toBe(7)
  })
})
