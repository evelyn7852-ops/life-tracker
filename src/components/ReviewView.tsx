import { useState } from 'react'
import { HistoryView } from './HistoryView'
import { WeekView } from './WeekView'

type Segment = 'history' | 'week'

/** 「回顾」tab：历史 / 周览合并容器，segment chip 样式复用训练页子 tab（.summary-tabs）。
 * active-gating：只把 active 传给当前可见 segment，隐藏的一侧不 fetch。 */
export function ReviewView({ refreshKey, active }: { refreshKey: number; active: boolean }) {
  const [segment, setSegment] = useState<Segment>('history')

  return (
    <div className="view">
      <div className="summary-tabs">
        <button className={segment === 'history' ? 'on' : ''} onClick={() => setSegment('history')}>历史</button>
        <button className={segment === 'week' ? 'on' : ''} onClick={() => setSegment('week')}>周览</button>
      </div>
      <div hidden={segment !== 'history'}>
        <HistoryView refreshKey={refreshKey} active={active && segment === 'history'} />
      </div>
      <div hidden={segment !== 'week'}>
        <WeekView refreshKey={refreshKey} active={active && segment === 'week'} />
      </div>
    </div>
  )
}
