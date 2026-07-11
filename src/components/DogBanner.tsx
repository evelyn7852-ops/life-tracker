import { useEffect, useState } from 'react'

type DogState = 'run' | 'nap' | 'eat' | 'scratch'

const STATES: DogState[] = ['run', 'nap', 'eat', 'scratch']
const MIN_DELAY_MS = 8000
const MAX_DELAY_MS = 20000

/** 从排除当前状态的池中随机取下一个状态，避免连续重复同一动作。 */
function nextState(current: DogState): DogState {
  const pool = STATES.filter((s) => s !== current)
  return pool[Math.floor(Math.random() * pool.length)]
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

/** 首页底部矮条：装饰性小狗，随机在跑动/打盹/吃东西/挠痒间切换。纯装饰，aria-hidden。 */
export function DogBanner() {
  const [reduced] = useState(prefersReducedMotion)
  const [state, setState] = useState<DogState>('run')

  useEffect(() => {
    if (reduced) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => {
      timer = setTimeout(() => {
        if (cancelled) return
        setState((prev) => nextState(prev))
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
