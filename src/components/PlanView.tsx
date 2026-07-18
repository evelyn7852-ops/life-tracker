import { useState } from 'react'
import { LearningPlanView } from './LearningPlanView'
import { TrainView } from './TrainView'
import { TravelPlanView } from './TravelPlanView'

type Segment = 'train' | 'travel' | 'learning'

/** 「规划」tab：训练/旅行/学习三合一容器（V1.7，替换原独立训练 tab + 首页规划卡片）。
 * segment chip 复用回顾页样式（.summary-tabs）。旅行/学习无内部 active-gating，
 * 用条件挂载实现「只有当前 segment fetch」——等价于原先 overlay 打开即挂载/关闭即卸载的语义。 */
export function PlanView({ refreshKey, active }: { refreshKey: number; active: boolean }) {
  const [segment, setSegment] = useState<Segment>('train')

  return (
    <div className="view">
      <div className="summary-tabs">
        <button className={segment === 'train' ? 'on' : ''} onClick={() => setSegment('train')}>训练</button>
        <button className={segment === 'travel' ? 'on' : ''} onClick={() => setSegment('travel')}>旅行</button>
        <button className={segment === 'learning' ? 'on' : ''} onClick={() => setSegment('learning')}>学习</button>
      </div>
      {segment === 'train' && <TrainView refreshKey={refreshKey} active={active} />}
      {segment === 'travel' && <TravelPlanView />}
      {segment === 'learning' && <LearningPlanView />}
    </div>
  )
}
