import { useEffect, useRef, useState } from 'react'
import type { Domain } from '../lib/types'

export type DogState = 'run' | 'nap' | 'eat' | 'scratch'
/** §D 点击互动：body 反应三选一随机播放；heart-static 是 reduced-motion 下的唯一分支，不参与随机。 */
export type BodyReaction = 'jump' | 'spin' | 'wag' | 'roll'
export type Reaction = BodyReaction | 'heart-static'

const STATES: DogState[] = ['run', 'nap', 'eat', 'scratch']
const MIN_DELAY_MS = 8000
const MAX_DELAY_MS = 20000
const BASE_WEIGHT = 1
const FADE_MS = 240 // 状态切换：先淡出再换姿态再淡入，240ms（150-250ms 区间内），避免跳变
const SNIFF_CHANCE = 0.4 // 走路中偶发「嗅地」停顿的触发概率
const SNIFF_MIN_MS = 2000
const SNIFF_MAX_MS = 6000
const SNIFF_DURATION_MS = 1500

const BODY_REACTIONS: BodyReaction[] = ['jump', 'spin', 'wag']
const REACTION_MS = 1000 // 普通反应播放时长，播完回归状态机
const ROLL_MS = 1800 // 连点彩蛋：慢速打滚一圈，时长比普通反应更长
const STATIC_HEART_MS = 600 // reduced-motion 下静态 ❤️ 展示时长
const TRIPLE_TAP_WINDOW_MS = 3000 // 连点彩蛋判定窗口

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

/**
 * 独立随机源（不走 Math.random），专供纯presentational 的「嗅地」触发时机使用。
 * 状态机测试用 vi.spyOn(Math,'random') 精确 mock 了 delay/pool-index 的调用序列，
 * 嗅地若也消耗 Math.random() 会打乱那套序列；用 crypto 隔开两者，逻辑互不影响。
 */
function pseudoRandom(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const arr = new Uint32Array(1)
    crypto.getRandomValues(arr)
    return arr[0] / 4294967296
  }
  return (Date.now() % 1000) / 1000
}

export interface DogBannerProps {
  /** 当日已记录的域集合。undefined = 未查询/查询失败 → 走旧的纯随机；已知（含空数组）→ 按权重偏向。 */
  todayDomains?: Domain[]
  /** 当日 mood 是否为「伤心」，命中则偏向安慰/依偎（复用趴卧姿势）。 */
  sad?: boolean
}

/** 全局底部矮条（贴 tab 栏上方）：装饰性小狗，随机在跑动/打盹/吃东西/挠痒间切换，可按当日记录偏向；
 * §D 狗本体可点，点击触发随机互动反应，打断当前状态播放约 1s 后回归状态机。 */
export function DogBanner({ todayDomains, sad = false }: DogBannerProps = {}) {
  const [reduced] = useState(prefersReducedMotion)
  const [state, setState] = useState<DogState>('run')
  const [phase, setPhase] = useState<'idle' | 'fading'>('idle')
  const [sniffing, setSniffing] = useState(false)
  const [reaction, setReaction] = useState<Reaction | null>(null)
  const reactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tapTimesRef = useRef<number[]>([]) // 连点彩蛋：滚动窗口内的点击时间戳
  const weightsRef = useRef<Record<DogState, number> | null>(null)
  weightsRef.current = todayDomains !== undefined ? pickStateWeights(todayDomains, sad) : null
  // React 的 setState(updater) 函数式写法把 updater 的执行推迟到渲染阶段，不是调用处同步执行；
  // 若沿用旧写法，紧跟其后同步调用的 schedule()→nextDelay() 反而会先于 updater 消耗掉 Math.random()，
  // 打乱调用顺序（测试对此有精确 mock）。改用 ref 同步读取「当前状态」，在此处就地同步算出下一状态。
  const stateRef = useRef<DogState>('run')

  // 状态机（逻辑不变）：延时到点先淡出 240ms，再换姿态，再淡入——不再是瞬间跳变。
  useEffect(() => {
    if (reduced) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    let fadeTimer: ReturnType<typeof setTimeout>
    const schedule = () => {
      timer = setTimeout(() => {
        if (cancelled) return
        setPhase('fading')
        fadeTimer = setTimeout(() => {
          if (cancelled) return
          const w = weightsRef.current
          const next = w ? nextStateWeighted(stateRef.current, w) : nextState(stateRef.current)
          stateRef.current = next
          setState(next)
          setPhase('idle')
          schedule()
        }, FADE_MS)
      }, nextDelay())
    }
    schedule()
    return () => {
      cancelled = true
      clearTimeout(timer)
      clearTimeout(fadeTimer)
    }
  }, [reduced])

  // 偶发嗅地：仅在「跑」状态且未处于淡出中时，按概率安排一次 1.5s 停顿（暂停位移+踏步，头部微低旋转）。
  useEffect(() => {
    if (reduced || state !== 'run' || phase !== 'idle') return
    if (pseudoRandom() > SNIFF_CHANCE) return
    let cancelled = false
    let startTimer: ReturnType<typeof setTimeout>
    let endTimer: ReturnType<typeof setTimeout>
    const delay = SNIFF_MIN_MS + pseudoRandom() * (SNIFF_MAX_MS - SNIFF_MIN_MS)
    startTimer = setTimeout(() => {
      if (cancelled) return
      setSniffing(true)
      endTimer = setTimeout(() => {
        if (cancelled) return
        setSniffing(false)
      }, SNIFF_DURATION_MS)
    }, delay)
    return () => {
      cancelled = true
      clearTimeout(startTimer)
      clearTimeout(endTimer)
    }
  }, [state, phase, reduced])

  // 反应播完后自动回归状态机；卸载时清理，避免 setState-after-unmount。
  useEffect(() => {
    return () => {
      if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current)
    }
  }, [])

  const triggerReaction = (r: Reaction, durationMs: number) => {
    if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current)
    setReaction(r)
    reactionTimerRef.current = setTimeout(() => {
      setReaction(null)
      reactionTimerRef.current = null
    }, durationMs)
  }

  /** 点击狗本体：reduced-motion 下永远只弹静态 ❤️；否则连点 3 次（3s 内）触发慢速打滚彩蛋，
   * 普通点击从 3 种反应里随机挑一种，均打断当前状态、播完回归状态机。 */
  const handleDogClick = () => {
    if (reduced) {
      triggerReaction('heart-static', STATIC_HEART_MS)
      return
    }
    const now = Date.now()
    const recent = tapTimesRef.current.filter((t) => now - t < TRIPLE_TAP_WINDOW_MS)
    recent.push(now)
    tapTimesRef.current = recent
    if (recent.length >= 3) {
      tapTimesRef.current = []
      triggerReaction('roll', ROLL_MS)
      return
    }
    const pick = BODY_REACTIONS[Math.floor(pseudoRandom() * BODY_REACTIONS.length)]
    triggerReaction(pick, REACTION_MS)
  }

  const handleDogKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleDogClick()
    }
  }

  if (reduced) {
    return (
      <div className="dog-banner dog-banner-static">
        <span className="dog dog-sit" role="button" aria-label="小狗" tabIndex={0} onClick={handleDogClick} onKeyDown={handleDogKeyDown}>
          🐕
          {reaction === 'heart-static' && <span className="dog-reaction-heart dog-reaction-heart-static">❤️</span>}
        </span>
      </div>
    )
  }

  // 反应播放期间整体替换 dog-${state}，打断当前状态的视觉（含淡出/嗅地），播完由 reaction=null 让下面的分支自然回归状态机。
  const outerClass = [
    'dog',
    reaction ? `dog-reaction-${reaction}` : `dog-${state}`,
    !reaction && phase === 'fading' ? 'dog-fading' : '',
    !reaction && state === 'run' && sniffing ? 'dog-walk-paused' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className="dog-banner">
      <span className={outerClass} role="button" aria-label="小狗" tabIndex={0} onClick={handleDogClick} onKeyDown={handleDogKeyDown}>
        {reaction ? (
          <>
            🐕
            {reaction === 'jump' && <span className="dog-reaction-heart">❤️</span>}
            {reaction === 'wag' && <span className="dog-reaction-bubble">汪</span>}
          </>
        ) : state === 'run' ? (
          <span className={`dog-bob${sniffing ? ' dog-bob-paused' : ''}`}>
            <span className={`dog-body${sniffing ? ' dog-sniffing' : ''}`}>🐕</span>
          </span>
        ) : (
          <>
            🐕
            {state === 'nap' && <span className="dog-zzz">💤</span>}
            {state === 'eat' && <span className="dog-bone">🦴</span>}
          </>
        )}
      </span>
    </div>
  )
}
