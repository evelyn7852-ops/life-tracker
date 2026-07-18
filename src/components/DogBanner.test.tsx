import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act, fireEvent } from '@testing-library/react'
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

  it('8-20s 后先淡出 240ms（姿态不变），再切换到另一状态（打盹）', () => {
    vi.useFakeTimers()
    const randomSpy = vi.spyOn(Math, 'random')
    randomSpy.mockReturnValueOnce(0) // delay factor → 最短 8000ms
    randomSpy.mockReturnValueOnce(0) // 从排除当前状态的池中取第一个 → nap
    render(<DogBanner />)
    expect(document.querySelector('.dog-run')).toBeTruthy()
    act(() => { vi.advanceTimersByTime(8000) })
    // 240ms 淡出期间姿态仍是 run，只是叠加了淡出 class
    expect(document.querySelector('.dog-run')).toBeTruthy()
    expect(document.querySelector('.dog-run.dog-fading')).toBeTruthy()
    act(() => { vi.advanceTimersByTime(240) })
    expect(document.querySelector('.dog-nap')).toBeTruthy()
    expect(document.querySelector('.dog-run')).toBeNull()
    randomSpy.mockRestore()
  })

  it('打盹状态显示 💤 图标', () => {
    vi.useFakeTimers()
    const randomSpy = vi.spyOn(Math, 'random')
    randomSpy.mockReturnValueOnce(0).mockReturnValueOnce(0) // pool(排除run)=[nap,eat,scratch] → index0=nap
    render(<DogBanner />)
    act(() => { vi.advanceTimersByTime(8240) })
    expect(document.querySelector('.dog-zzz')).toBeTruthy()
    randomSpy.mockRestore()
  })

  it('吃东西状态显示 🦴 图标', () => {
    vi.useFakeTimers()
    const randomSpy = vi.spyOn(Math, 'random')
    randomSpy.mockReturnValueOnce(0).mockReturnValueOnce(0.34) // pool(排除run)=[nap,eat,scratch] → index1=eat
    render(<DogBanner />)
    act(() => { vi.advanceTimersByTime(8240) })
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
    act(() => { vi.advanceTimersByTime(8240) })
    // food 偏向 eat，权重最大（4/6），应命中 eat
    expect(document.querySelector('.dog-eat')).toBeTruthy()
    randomSpy.mockRestore()
  })

  it('§D 点击狗触发随机互动反应（打断当前状态），播完约 1s 后回归状态机', () => {
    vi.useFakeTimers()
    const cryptoSpy = vi.spyOn(crypto, 'getRandomValues').mockImplementation(((arr: Uint32Array) => {
      arr[0] = 0 // pseudoRandom()→0：BODY_REACTIONS[0]='jump'（嗅地判定也命中，但延迟 2s 起，晚于本测试窗口不影响断言）
      return arr
    }) as typeof crypto.getRandomValues)
    render(<DogBanner />)
    const dog = document.querySelector('.dog')!
    expect(document.querySelector('.dog-run')).toBeTruthy()
    act(() => { fireEvent.click(dog) })
    expect(document.querySelector('.dog-reaction-jump')).toBeTruthy()
    expect(document.querySelector('.dog-reaction-heart')).toBeTruthy() // jump 反应叠加 ❤️ 冒出
    expect(document.querySelector('.dog-run')).toBeNull() // 打断当前状态，run 类暂时不在
    act(() => { vi.advanceTimersByTime(1000) })
    expect(document.querySelector('.dog-reaction-jump')).toBeNull()
    expect(document.querySelector('.dog-run')).toBeTruthy() // 回归状态机
    cryptoSpy.mockRestore()
  })

  it('§D 3 秒内连点 3 次 → 触发慢速打滚彩蛋', () => {
    vi.useFakeTimers()
    const cryptoSpy = vi.spyOn(crypto, 'getRandomValues').mockImplementation(((arr: Uint32Array) => {
      arr[0] = 4294967295 // pseudoRandom()→≈1，避开嗅地触发概率区间（>0.4 不触发嗅地）
      return arr
    }) as typeof crypto.getRandomValues)
    render(<DogBanner />)
    const dog = document.querySelector('.dog')!
    act(() => {
      fireEvent.click(dog)
      fireEvent.click(dog)
      fireEvent.click(dog)
    })
    expect(document.querySelector('.dog-reaction-roll')).toBeTruthy()
    cryptoSpy.mockRestore()
  })

  it('§D reduced-motion 下点击只弹静态 ❤️，600ms 后消失', () => {
    mockMatchMedia(true)
    vi.useFakeTimers()
    render(<DogBanner />)
    const dog = document.querySelector('.dog-sit')!
    expect(document.querySelector('.dog-reaction-heart-static')).toBeNull()
    act(() => { fireEvent.click(dog) })
    expect(document.querySelector('.dog-reaction-heart-static')).toBeTruthy()
    act(() => { vi.advanceTimersByTime(600) })
    expect(document.querySelector('.dog-reaction-heart-static')).toBeNull()
  })

  it('走路中偶发嗅地：暂停后头部旋转 -8°，1.5s 后恢复', () => {
    vi.useFakeTimers()
    const cryptoSpy = vi.spyOn(crypto, 'getRandomValues').mockImplementation(((arr: Uint32Array) => {
      arr[0] = 0 // pseudoRandom() → 0：必定触发嗅地，且落在延迟窗口最短处
      return arr
    }) as typeof crypto.getRandomValues)
    render(<DogBanner />)
    act(() => { vi.advanceTimersByTime(2000) }) // SNIFF_MIN_MS：随机因子为 0 时的最短嗅地延迟
    expect(document.querySelector('.dog-sniffing')).toBeTruthy()
    act(() => { vi.advanceTimersByTime(1500) }) // SNIFF_DURATION_MS
    expect(document.querySelector('.dog-sniffing')).toBeNull()
    cryptoSpy.mockRestore()
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
