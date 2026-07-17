import { useEffect, useState } from 'react'
import { AuthGate } from './components/AuthGate'
import { DogBanner } from './components/DogBanner'
import { HistoryView } from './components/HistoryView'
import { HomeView } from './components/HomeView'
import { MoodHeader } from './components/MoodHeader'
import { QuickInput } from './components/QuickInput'
import { TodayView } from './components/TodayView'
import { TrainView } from './components/TrainView'
import { WeekView } from './components/WeekView'
import { listEntries } from './lib/entriesRepo'
import { flushOutbox } from './lib/outbox'
import type { Domain, JournalData } from './lib/types'

type Tab = 'home' | 'today' | 'history' | 'week' | 'train'

/** 当天 [00:00, 次日00:00) 范围，与 TodayView/useMood 同款写法。 */
function dayRange(d = new Date()): { fromTs: string; toTs: string } {
  const start = new Date(d); start.setHours(0, 0, 0, 0)
  const end = new Date(start); end.setDate(end.getDate() + 1)
  return { fromTs: start.toISOString(), toTs: end.toISOString() }
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [refreshKey, setRefreshKey] = useState(0)
  const bump = () => setRefreshKey((k) => k + 1)
  // 全局狗条按当日记录联动状态偏向：undefined = 未知/查询失败 → 走旧的纯随机；已知（含空数组）→ 按权重偏向。
  const [todayDomains, setTodayDomains] = useState<Domain[] | undefined>(undefined)
  const [sad, setSad] = useState(false)

  useEffect(() => {
    flushOutbox().then((n) => { if (n > 0) bump() })
    const onOnline = () => flushOutbox().then((n) => { if (n > 0) bump() })
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])

  useEffect(() => {
    let cancelled = false
    listEntries({ ...dayRange(), limit: 100 })
      .then((rows) => {
        if (cancelled) return
        const domains = Array.from(new Set(rows.map((r) => r.domain)))
        const hasSadMood = rows.some((r) => r.domain === 'journal' && (r.data as JournalData).mood === '😢')
        setTodayDomains(domains)
        setSad(hasSadMood)
      })
      .catch(() => {
        if (cancelled) return
        // 查询失败（离线/表不存在等）→ 回退旧的纯随机行为，不崩
        setTodayDomains(undefined)
        setSad(false)
      })
    return () => { cancelled = true }
  }, [refreshKey])

  return (
    <AuthGate>
      <div className="app">
        <main className="main">
          <div hidden={tab !== 'home'}><HomeView refreshKey={refreshKey} onSaved={bump} active={tab === 'home'} /></div>
          <div hidden={tab !== 'today'}>
            <MoodHeader />
            <QuickInput onSaved={bump} />
            <TodayView refreshKey={refreshKey} active={tab === 'today'} />
          </div>
          <div hidden={tab !== 'history'}><HistoryView refreshKey={refreshKey} active={tab === 'history'} /></div>
          <div hidden={tab !== 'week'}><WeekView refreshKey={refreshKey} active={tab === 'week'} /></div>
          <div hidden={tab !== 'train'}><TrainView refreshKey={refreshKey} active={tab === 'train'} /></div>
        </main>
        <DogBanner todayDomains={todayDomains} sad={sad} />
        <nav className="tabs">
          {(['home', 'today', 'history', 'week', 'train'] as Tab[]).map((t) => (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
              {{ home: '首页', today: '记录', history: '历史', week: '周览', train: '训练' }[t]}
            </button>
          ))}
        </nav>
      </div>
    </AuthGate>
  )
}
