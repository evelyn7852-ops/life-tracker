import { useEffect, useRef, useState } from 'react'
import type { Domain } from '../lib/types'

export type DogState = 'run' | 'nap' | 'eat' | 'scratch'

const STATES: DogState[] = ['run', 'nap', 'eat', 'scratch']
const MIN_DELAY_MS = 8000
const MAX_DELAY_MS = 20000
const BASE_WEIGHT = 1

/** 从排除当前状态的池中随机取下一个状态，避免连续重复同一动作。（无当日数据时的旧行为，均匀随机） */
function nextState(current: DogState): DogState {
  const pool = STATES.filter((s) => s !== current)
  return pool[Math.floor(Math.random() * pool.length)]
}

/**
 * 纯函数：按当日已记录的域 + 是否伤心，给四个状态算权重。
 * 规则：food→偏吃(eat)；workout→偏跑(run)；reading/learning→复用趴卧(nap，「看书」不新建姿势)；
 * 当日无记录→偏睡(nap)；sad→叠加更大的 nap 权重（安慰/依偎，复用趴卧姿势），优先级最高。
 * 仍是「偏向」而非绑定：所有状态权重都 ≥ BASE_WEIGHT，随机切换时其余状态仍有机会出现。
 */
export function pickStateWeights(todayDomains: Domain[], sad: boolean): Record<DogState, number> {
  const w: Record<DogState, number> = { run: BASE_WEIGHT, nap: BASE_WEIGHT, eat: BASE_WEIGHT, scratch: BASE_WEIGHT }
  if (todayDomains.includes('food')) w.eat += 3
  if (todayDomains.includes('workout')) w.run += 3
  if (todayDomains.includes('reading') || todayDomains.includes('learning')) w.nap += 2
  if (todayDomains.length === 0) w.nap += 3
  if (sad) w.nap += 5
  return w
}

/** 按权重、排除当前状态，加权随机取下一个状态。 */
function nextStateWeighted(current: DogState, weights: Record<DogState, number>): DogState {
  const pool = STATES.filter((s) => s !== current)
  const total = pool.reduce((sum, s) => sum + weights[s], 0)
  let r = Math.random() * total
  for (const s of pool) {
    r -= weights[s]
    if (r < 0) return s
  }
  return pool[pool.length - 1]
}

function nextDelay(): number {
  return MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export interface DogBannerProps {
  /** 当日已记录的域集合。undefined = 未查询/查询失败 → 走旧的纯随机；已知（含空数组）→ 按权重偏向。 */
  todayDomains?: Domain[]
  /** 当日 mood 是否为「伤心」，命中则偏向安慰/依偎（复用趴卧姿势）。 */
  sad?: boolean
}

/** 全局底部矮条（贴 tab 栏上方）：装饰性小狗，随机在跑动/打盹/吃东西/挠痒间切换，可按当日记录偏向。纯装饰，aria-hidden。 */
export function DogBanner({ todayDomains, sad = false }: DogBannerProps = {}) {
  const [reduced] = useState(prefersReducedMotion)
  const [state, setState] = useState<DogState>('run')
  const weightsRef = useRef<Record<DogState, number> | null>(null)
  weightsRef.current = todayDomains !== undefined ? pickStateWeights(todayDomains, sad) : null

  useEffect(() => {
    if (reduced) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => {
      timer = setTimeout(() => {
        if (cancelled) return
        setState((prev) => {
          const w = weightsRef.current
          return w ? nextStateWeighted(prev, w) : nextState(prev)
        })
        schedule()
      }, nextDelay())
    }
    schedule()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [reduced])

  if (reduced) {
    return (
      <div className="dog-banner dog-banner-static" aria-hidden="true">
        <span className="dog dog-sit">🐕</span>
      </div>
    )
  }

  return (
    <div className="dog-banner" aria-hidden="true">
      <span className={`dog dog-${state}`}>
        🐕
        {state === 'nap' && <span className="dog-zzz">💤</span>}
        {state === 'eat' && <span className="dog-bone">🦴</span>}
      </span>
    </div>
  )
}
