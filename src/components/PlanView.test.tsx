import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const trainPropsSpy = vi.fn()
vi.mock('./TrainView', () => ({
  TrainView: (props: { refreshKey: number; active: boolean }) => {
    trainPropsSpy(props)
    return <div data-testid="train-view" />
  },
}))

const travelMountSpy = vi.fn()
vi.mock('./TravelPlanView', () => ({
  TravelPlanView: () => { travelMountSpy(); return <div data-testid="travel-plan-view" /> },
}))

const learningMountSpy = vi.fn()
vi.mock('./LearningPlanView', () => ({
  LearningPlanView: () => { learningMountSpy(); return <div data-testid="learning-plan-view" /> },
}))

import { PlanView } from './PlanView'

describe('PlanView（V1.7 训练/旅行/学习三合一）', () => {
  beforeEach(() => {
    trainPropsSpy.mockClear()
    travelMountSpy.mockClear()
    learningMountSpy.mockClear()
  })

  it('默认展示训练 segment，训练 active 跟随外层，旅行/学习不挂载', () => {
    render(<PlanView refreshKey={0} active />)
    expect(screen.getByTestId('train-view')).toBeTruthy()
    expect(trainPropsSpy.mock.calls.at(-1)?.[0].active).toBe(true)
    expect(travelMountSpy).not.toHaveBeenCalled()
    expect(learningMountSpy).not.toHaveBeenCalled()
  })

  it('segment chip 复用 .summary-tabs（同回顾页），含训练/旅行/学习三个', () => {
    render(<PlanView refreshKey={0} active />)
    expect(document.querySelector('.summary-tabs')).toBeTruthy()
    expect(screen.getByText('训练')).toBeTruthy()
    expect(screen.getByText('旅行')).toBeTruthy()
    expect(screen.getByText('学习')).toBeTruthy()
  })

  it('点击「旅行」→ 挂载 TravelPlanView（内嵌，非 overlay），训练卸载', async () => {
    render(<PlanView refreshKey={0} active />)
    await userEvent.click(screen.getByText('旅行'))
    expect(screen.getByTestId('travel-plan-view')).toBeTruthy()
    expect(screen.queryByTestId('train-view')).toBeNull()
    expect(travelMountSpy).toHaveBeenCalledTimes(1)
  })

  it('点击「学习」→ 挂载 LearningPlanView（内嵌，非 overlay）', async () => {
    render(<PlanView refreshKey={0} active />)
    await userEvent.click(screen.getByText('学习'))
    expect(screen.getByTestId('learning-plan-view')).toBeTruthy()
    expect(learningMountSpy).toHaveBeenCalledTimes(1)
  })

  it('切回「训练」→ 旅行/学习卸载，训练重新挂载', async () => {
    render(<PlanView refreshKey={0} active />)
    await userEvent.click(screen.getByText('旅行'))
    await userEvent.click(screen.getByText('训练'))
    expect(screen.getByTestId('train-view')).toBeTruthy()
    expect(screen.queryByTestId('travel-plan-view')).toBeNull()
  })

  it('外层 active=false → 训练 segment 传 active=false', () => {
    render(<PlanView refreshKey={0} active={false} />)
    expect(trainPropsSpy.mock.calls.at(-1)?.[0].active).toBe(false)
  })

  it('refreshKey 透传给训练 segment', () => {
    render(<PlanView refreshKey={7} active />)
    expect(trainPropsSpy.mock.calls.at(-1)?.[0].refreshKey).toBe(7)
  })
})
