import { useEffect, useState } from 'react'
import { AuthGate } from './components/AuthGate'
import { HistoryView } from './components/HistoryView'
import { HomeView } from './components/HomeView'
import { MoodHeader } from './components/MoodHeader'
import { QuickInput } from './components/QuickInput'
import { TodayView } from './components/TodayView'
import { WeekView } from './components/WeekView'
import { flushOutbox } from './lib/outbox'

type Tab = 'home' | 'today' | 'history' | 'week'

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
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
        <main className="main">
          <div hidden={tab !== 'home'}><HomeView refreshKey={refreshKey} onSaved={bump} active={tab === 'home'} /></div>
          <div hidden={tab !== 'today'}>
            <MoodHeader />
            <QuickInput onSaved={bump} />
            <TodayView refreshKey={refreshKey} active={tab === 'today'} />
          </div>
          <div hidden={tab !== 'history'}><HistoryView refreshKey={refreshKey} active={tab === 'history'} /></div>
          <div hidden={tab !== 'week'}><WeekView refreshKey={refreshKey} active={tab === 'week'} /></div>
        </main>
        <nav className="tabs">
          {(['home', 'today', 'history', 'week'] as Tab[]).map((t) => (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
              {{ home: '首页', today: '记录', history: '历史', week: '周览' }[t]}
            </button>
          ))}
        </nav>
      </div>
    </AuthGate>
  )
}
