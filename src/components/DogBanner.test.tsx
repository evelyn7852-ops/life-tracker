import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { DogBanner } from './DogBanner'

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
})
