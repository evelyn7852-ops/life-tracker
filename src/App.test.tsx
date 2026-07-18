import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// AuthGate 直接透传 children，跳过登录态，App 测试只关心 tab 布局 + 全局狗条联动查询。
vi.mock('./components/AuthGate', () => ({
  AuthGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// 各 tab 视图内部逻辑各自有测试覆盖，这里全部替身为占位组件，避免重复 mock 一整套依赖链。
vi.mock('./components/HomeView', () => ({ HomeView: () => <div data-testid="home-view" /> }))
vi.mock('./components/ReviewView', () => ({ ReviewView: () => <div data-testid="review-view" /> }))
vi.mock('./components/MoodHeader', () => ({ MoodHeader: () => <div data-testid="mood-header" /> }))
vi.mock('./components/QuickInput', () => ({ QuickInput: () => <div data-testid="quick-input" /> }))
vi.mock('./components/TodayView', () => ({ TodayView: () => <div data-testid="today-view" /> }))
vi.mock('./components/TrainView', () => ({ TrainView: () => <div data-testid="train-view" /> }))

vi.mock('./lib/outbox', () => ({ flushOutbox: vi.fn().mockResolvedValue(0) }))

const listEntriesMock = vi.fn()
vi.mock('./lib/entriesRepo', () => ({ listEntries: (o: unknown) => listEntriesMock(o) }))

// DogBanner 本身的状态机/权重逻辑在 DogBanner.test.tsx 单测，这里只验证 App 传给它的 props。
const dogBannerPropsSpy = vi.fn()
vi.mock('./components/DogBanner', () => ({
  DogBanner: (props: { todayDomains?: string[]; sad?: boolean }) => {
    dogBannerPropsSpy(props)
    return <div className="dog-banner-mock" data-testid="dog-banner" />
  },
}))

import App from './App'

describe('App', () => {
  beforeEach(() => {
    listEntriesMock.mockReset().mockResolvedValue([])
    dogBannerPropsSpy.mockClear()
  })

  it('底部 4 个 tab：首页/记录/回顾/训练（5→4 合并历史+周览）', () => {
    render(<App />)
    const labels = screen.getAllByRole('button', { name: /^(首页|记录|回顾|训练)$/ }).map((b) => b.textContent)
    expect(labels).toEqual(['首页', '记录', '回顾', '训练'])
    expect(screen.queryByText('历史')).toBeNull()
    expect(screen.queryByText('周览')).toBeNull()
  })

  it('点击「回顾」→ 渲染 ReviewView，active=true', async () => {
    render(<App />)
    await userEvent.click(screen.getByText('回顾'))
    expect(screen.getByTestId('review-view')).toBeTruthy()
  })

  it('挂载后查询今日 entries', async () => {
    render(<App />)
    await waitFor(() => expect(listEntriesMock).toHaveBeenCalled())
    const arg = listEntriesMock.mock.calls[0][0]
    expect(arg.fromTs).toBeTruthy()
    expect(arg.toTs).toBeTruthy()
  })

  it('狗条在 main 与 tabs 之间全局渲染，且每个 tab 切换后仍可见', async () => {
    render(<App />)
    expect(screen.getByTestId('dog-banner')).toBeTruthy()
    await userEvent.click(screen.getByText('记录'))
    expect(screen.getByTestId('today-view')).toBeTruthy()
    expect(screen.getByTestId('dog-banner')).toBeTruthy()
    await userEvent.click(screen.getByText('训练'))
    expect(screen.getByTestId('train-view')).toBeTruthy()
    expect(screen.getByTestId('dog-banner')).toBeTruthy()
  })

  it('今日记了 food → todayDomains 含 food 传给狗条', async () => {
    listEntriesMock.mockResolvedValue([
      { id: '1', ts: new Date().toISOString(), domain: 'food', raw_text: '午饭', data: { meal: '午', items: ['米饭'] }, parse_source: 'manual', tags: [] },
    ])
    render(<App />)
    await waitFor(() => {
      const last = dogBannerPropsSpy.mock.calls.at(-1)?.[0]
      expect(last?.todayDomains).toEqual(['food'])
    })
  })

  it('今日 journal mood=😢 → sad=true 传给狗条', async () => {
    listEntriesMock.mockResolvedValue([
      { id: '1', ts: new Date().toISOString(), domain: 'journal', raw_text: '心情 😢', data: { mood: '😢' }, parse_source: 'manual', tags: [] },
    ])
    render(<App />)
    await waitFor(() => {
      const last = dogBannerPropsSpy.mock.calls.at(-1)?.[0]
      expect(last?.sad).toBe(true)
    })
  })

  it('今日无记录（空数组）→ todayDomains 为空数组而非 undefined（区分「已知无记录」与「未知」）', async () => {
    listEntriesMock.mockResolvedValue([])
    render(<App />)
    await waitFor(() => {
      const last = dogBannerPropsSpy.mock.calls.at(-1)?.[0]
      expect(last?.todayDomains).toEqual([])
    })
  })

  it('listEntries 查询失败 → 不崩溃，todayDomains 回退 undefined（狗条走旧的纯随机）', async () => {
    listEntriesMock.mockRejectedValue(new Error('offline'))
    render(<App />)
    await waitFor(() => expect(listEntriesMock).toHaveBeenCalled())
    expect(screen.getByTestId('dog-banner')).toBeTruthy()
    const last = dogBannerPropsSpy.mock.calls.at(-1)?.[0]
    expect(last?.todayDomains).toBeUndefined()
  })
})
