import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LearningPlanView } from './LearningPlanView'
import { PROGRESS_KEY } from '../lib/learningPlan'

describe('LearningPlanView', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('渲染标题与单设备提示', () => {
    render(<LearningPlanView onClose={() => {}} />)
    expect(screen.getByText('学习规划')).toBeTruthy()
    expect(screen.getByText(/云同步待 V1.5/)).toBeTruthy()
  })

  it('第 1 周默认展开', () => {
    render(<LearningPlanView onClose={() => {}} />)
    expect(screen.getByText(/打地基 \+ 写问题陈述/)).toBeTruthy()
  })

  it('勾选一个学习条目 → 写入 localStorage（key: ai_bootcamp_progress_v3）', async () => {
    render(<LearningPlanView onClose={() => {}} />)
    const checkboxes = screen.getAllByRole('checkbox')
    await userEvent.click(checkboxes[0])
    const stored = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '{}')
    expect(Object.values(stored).some(Boolean)).toBe(true)
  })

  it('点击第 2 周展开该周内容', async () => {
    render(<LearningPlanView onClose={() => {}} />)
    await userEvent.click(screen.getByText(/第2周/).closest('button')!)
    expect(screen.getByText(/Cowork 上手/)).toBeTruthy()
  })

  it('点击遮罩层触发 onClose', async () => {
    let closed = false
    render(<LearningPlanView onClose={() => { closed = true }} />)
    await userEvent.click(document.querySelector('.day-detail-overlay')!)
    expect(closed).toBe(true)
  })
})
