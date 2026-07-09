import { useState } from 'react'
import { deleteEntry, updateEntry } from '../lib/entriesRepo'
import { parseEntry } from '../lib/parser'
import { DOMAIN_LABEL, type Entry } from '../lib/types'

export function EntryCard({ entry, onChanged }: { entry: Entry; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(entry.raw_text)

  const time = new Date(entry.ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

  const saveEdit = async () => {
    const r = parseEntry(text)
    await updateEntry(entry.id, r
      ? { raw_text: text, domain: r.domain, data: r.data, parse_source: 'rule' }
      : { raw_text: text })
    setEditing(false); onChanged()
  }

  const remove = async () => {
    if (confirm('删除这条记录？')) { await deleteEntry(entry.id); onChanged() }
  }

  return (
    <div className="card">
      <div className="card-head">
        <span className={`dot dot-${entry.domain}`} />
        <span className="card-domain">{DOMAIN_LABEL[entry.domain]}</span>
        <span className="card-time">{time}</span>
      </div>
      {editing ? (
        <div className="card-edit">
          <input value={text} onChange={(e) => setText(e.target.value)} />
          <button onClick={saveEdit}>存</button>
          <button onClick={() => setEditing(false)}>取消</button>
        </div>
      ) : (
        <p className="card-text" onClick={() => setEditing(true)}>{entry.raw_text}</p>
      )}
      <button className="card-del" onClick={remove}>删</button>
    </div>
  )
}
