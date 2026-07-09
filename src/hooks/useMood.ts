import { useCallback, useEffect, useRef, useState } from 'react'
import { listEntries, updateEntry } from '../lib/entriesRepo'
import { saveEntry } from '../lib/outbox'
import type { Entry, JournalData } from '../lib/types'

function dayRange(d = new Date()): { fromTs: string; toTs: string } {
  const start = new Date(d); start.setHours(0, 0, 0, 0)
  const end = new Date(start); end.setDate(end.getDate() + 1)
  return { fromTs: start.toISOString(), toTs: end.toISOString() }
}

/** 今日心情读写逻辑，MoodHeader/HomeView 迁移时共用（原属 MoodHeader）。 */
export function useMood(refreshKey: number, onSaved: () => void, active: boolean) {
  const [moodEntry, setMoodEntry] = useState<Entry | null>(null)
  const lastFetched = useRef(-1)

  const load = useCallback(async () => {
    const rows = await listEntries({ ...dayRange(), domain: 'journal', limit: 100 })
    const latest = rows.find((e) => (e.data as JournalData).mood)
    setMoodEntry(latest ?? null)
  }, [])

  useEffect(() => {
    if (active && lastFetched.current !== refreshKey) {
      lastFetched.current = refreshKey
      load()
    }
  }, [active, refreshKey, load])

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
  return { selected, pick }
}
