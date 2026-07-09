import { useEffect, useState } from 'react'
import { listEntries, updateEntry } from '../lib/entriesRepo'
import { saveEntry } from '../lib/outbox'
import type { Entry, JournalData } from '../lib/types'

const MOODS = ['😊', '😐', '😮‍💨', '🥳', '😢', '🤒']
const WEEKDAY_ZH = ['日', '一', '二', '三', '四', '五', '六']

function formatDate(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getMonth() + 1}月${d.getDate()}日 周${WEEKDAY_ZH[d.getDay()]} ${hh}:${mm}`
}

function dayRange(d = new Date()): { fromTs: string; toTs: string } {
  const start = new Date(d); start.setHours(0, 0, 0, 0)
  const end = new Date(start); end.setDate(end.getDate() + 1)
  return { fromTs: start.toISOString(), toTs: end.toISOString() }
}

export function MoodHeader({ refreshKey, onSaved }: { refreshKey: number; onSaved: () => void }) {
  const [now, setNow] = useState(new Date())
  const [moodEntry, setMoodEntry] = useState<Entry | null>(null)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    listEntries({ ...dayRange(), domain: 'journal', limit: 100 }).then((rows) => {
      const latest = rows.find((e) => (e.data as JournalData).mood)
      setMoodEntry(latest ?? null)
    })
  }, [refreshKey])

  const pick = async (emoji: string) => {
    if (moodEntry) {
      await updateEntry(moodEntry.id, { raw_text: `心情 ${emoji}`, data: { mood: emoji } })
    } else {
      await saveEntry({
        ts: new Date().toISOString(),
        domain: 'journal',
        raw_text: `心情 ${emoji}`,
        data: { mood: emoji },
        parse_source: 'manual',
        tags: [],
      })
    }
    onSaved()
  }

  const selected = moodEntry ? (moodEntry.data as JournalData).mood : undefined

  return (
    <div className="mood-header">
      <p className="mood-date muted">{formatDate(now)}</p>
      <div className="mood-row">
        {MOODS.map((emoji) => (
          <button
            key={emoji}
            className={`mood-emoji ${selected === emoji ? 'on' : ''}`}
            onClick={() => pick(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
