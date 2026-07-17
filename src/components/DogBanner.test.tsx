import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { DogBanner, pickStateWeights } from './DogBanner'
import type { Domain } from '../lib/types'

function maxKey(w: Record<string, number>): string {
  return Object.entries(w).sort((a, b) => b[1] - a[1])[0][0]
}

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
}

describe('DogBanner', () => {
  beforeEach(() => {
    mockMatchMedia(false)
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('默认渲染跑动状态的小狗', () => {
    render(<DogBanner />)
    expect(document.querySelector('.dog-run')).toBeTruthy()
  })

  it('装饰性元素 aria-hidden，不干扰屏幕阅读器', () => {
    render(<DogBanner />)
    expect(document.querySelector('.dog-banner')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('prefers-reduced-motion → 渲染静态趴窝小狗，不设定时器、无动画类', () => {
    mockMatchMedia(true)
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    render(<DogBanner />)
    const box = document.querySelector('.dog-banner')
    expect(box?.className).toContain('dog-banner-static')
    expect(document.querySelector('.dog-sit')).toBeTruthy()
    expect(document.querySelector('.dog-run')).toBeNull()
    expect(setTimeoutSpy).not.toHaveBeenCalled()
    setTimeoutSpy.mockRestore()
  })

  it('8-20s 后随机切换到另一状态（打盹）', () => {
    vi.useFakeTimers()
    const randomSpy = vi.spyOn(Math, 'random')
    randomSpy.mockReturnValueOnce(0) // delay factor → 最短 8000ms
    randomSpy.mockReturnValueOnce(0) // 从排除当前状态的池中取第一个 → nap
    render(<DogBanner />)
    expect(document.querySelector('.dog-run')).toBeTruthy()
    act(() => { vi.advanceTimersByTime(8000) })
    expect(document.querySelector('.dog-nap')).toBeTruthy()
    expect(document.querySelector('.dog-run')).toBeNull()
    randomSpy.mockRestore()
  })

  it('打盹状态显示 💤 图标', () => {
    vi.useFakeTimers()
    const randomSpy = vi.spyOn(Math, 'random')
    randomSpy.mockReturnValueOnce(0).mockReturnValueOnce(0) // pool(排除run)=[nap,eat,scratch] → index0=nap
    render(<DogBanner />)
    act(() => { vi.advanceTimersByTime(8000) })
    expect(document.querySelector('.dog-zzz')).toBeTruthy()
    randomSpy.mockRestore()
  })

  it('吃东西状态显示 🦴 图标', () => {
    vi.useFakeTimers()
    const randomSpy = vi.spyOn(Math, 'random')
    randomSpy.mockReturnValueOnce(0).mockReturnValueOnce(0.34) // pool(排除run)=[nap,eat,scratch] → index1=eat
    render(<DogBanner />)
    act(() => { vi.advanceTimersByTime(8000) })
    expect(document.querySelector('.dog-bone')).toBeTruthy()
    randomSpy.mockRestore()
  })

  it('卸载后清除定时器', () => {
    vi.useFakeTimers()
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout')
    const { unmount } = render(<DogBanner />)
    unmount()
    expect(clearSpy).toHaveBeenCalled()
    clearSpy.mockRestore()
  })

  it('传入 todayDomains（含空数组）后按权重加权切换，不再是均匀随机', () => {
    vi.useFakeTimers()
    const randomSpy = vi.spyOn(Math, 'random')
    randomSpy.mockReturnValueOnce(0) // delay factor → 最短 8000ms
    randomSpy.mockReturnValueOnce(0.5) // 权重池 [nap:1,eat:4,scratch:1] 累计区间 [0,1)/[1,5)/[5,6)，0.5*6=3 落入 eat 区间
    render(<DogBanner todayDomains={['food']} />)
    act(() => { vi.advanceTimersByTime(8000) })
    // food 偏向 eat，权重最大（4/6），应命中 eat
    expect(document.querySelector('.dog-eat')).toBeTruthy()
    randomSpy.mockRestore()
  })
})

describe('pickStateWeights（纯函数：当日域集合 + sad → 状态权重）', () => {
  it('记了 food → eat 权重最高', () => {
    const w = pickStateWeights(['food'] as Domain[], false)
    expect(maxKey(w)).toBe('eat')
  })

  it('记了 workout → run 权重最高', () => {
    const w = pickStateWeights(['workout'] as Domain[], false)
    expect(maxKey(w)).toBe('run')
  })

  it('记了 reading/learning → nap（趴卧看书复用）权重最高', () => {
    expect(maxKey(pickStateWeights(['reading'] as Domain[], false))).toBe('nap')
    expect(maxKey(pickStateWeights(['learning'] as Domain[], false))).toBe('nap')
  })

  it('当日无记录（空数组）→ nap 权重最高', () => {
    const w = pickStateWeights([], false)
    expect(maxKey(w)).toBe('nap')
  })

  it('sad=true → nap（安慰/依偎）权重最高，即使当天记了 workout 也优先安慰', () => {
    const w = pickStateWeights(['workout'] as Domain[], true)
    expect(maxKey(w)).toBe('nap')
  })

  it('所有状态权重仍 ≥ 1（偏向而非绑定，仍有随机机会）', () => {
    const w = pickStateWeights(['food'] as Domain[], false)
    expect(Object.values(w).every((v) => v >= 1)).toBe(true)
  })
})
