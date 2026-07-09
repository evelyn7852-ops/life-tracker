import { useEffect, useState } from 'react'
import { AuthGate } from './components/AuthGate'
import { QuickInput } from './components/QuickInput'
import { TodayView } from './components/TodayView'
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
        <QuickInput onSaved={bump} />
        <main className="main">
          {tab === 'today' && <TodayView refreshKey={refreshKey} />}
          {tab === 'history' && <p className="muted empty">历史（Task 11）</p>}
          {tab === 'week' && <p className="muted empty">周览（Task 11）</p>}
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
