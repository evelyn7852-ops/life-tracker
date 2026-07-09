import { useEffect, useState } from 'react'
import { AuthGate } from './components/AuthGate'
import { HistoryView } from './components/HistoryView'
import { MoodHeader } from './components/MoodHeader'
import { QuickInput } from './components/QuickInput'
import { TodayView } from './components/TodayView'
import { WeekView } from './components/WeekView'
import { flushOutbox } from './lib/outbox'

type Tab = 'today' | 'history' | 'week'

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [refreshKey, setRefreshKey] = useState(0)
  const bump = () => setRefreshKey((k) => k + 1)

  useEffect(() => {
    flushOutbox().then((n) => { if (n > 0) bump() })
    const onOnline = () => flushOutbox().then((n) => { if (n > 0) bump() })
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])

  return (
    <AuthGate>
      <div className="app">
        <MoodHeader refreshKey={refreshKey} onSaved={bump} />
        <QuickInput onSaved={bump} />
        <main className="main">
          <div hidden={tab !== 'today'}><TodayView refreshKey={refreshKey} /></div>
          <div hidden={tab !== 'history'}><HistoryView refreshKey={refreshKey} /></div>
          <div hidden={tab !== 'week'}><WeekView refreshKey={refreshKey} /></div>
        </main>
        <nav className="tabs">
          {(['today', 'history', 'week'] as Tab[]).map((t) => (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
              {{ today: '今日', history: '历史', week: '周览' }[t]}
            </button>
          ))}
        </nav>
      </div>
    </AuthGate>
  )
}
