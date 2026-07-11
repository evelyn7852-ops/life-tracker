import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const listWorkoutsMock = vi.fn()
const insertWorkoutMock = vi.fn()
const deleteWorkoutMock = vi.fn()
const archiveWorkoutMock = vi.fn()
vi.mock('../lib/workoutRepo', () => ({
  listWorkouts: (o: unknown) => listWorkoutsMock(o),
  insertWorkout: (d: unknown) => insertWorkoutMock(d),
  deleteWorkout: (id: unknown) => deleteWorkoutMock(id),
  archiveWorkout: (w: unknown) => archiveWorkoutMock(w),
}))

import { TrainView } from './TrainView'
import type { Workout } from '../lib/types'

const plannedWorkout: Workout = {
  id: 'w1',
  date: '2026-07-11',
  template_id: 'push-day',
  title: '推日',
  blocks: [
    { exerciseId: 'bench-press', sets: 4, reps: 6, restSec: 120 },
    { exerciseId: 'incline-bench-press', sets: 3, reps: 8, restSec: 90 },
  ],
  status: 'planned',
  performed: null,
  created_at: '2026-07-11T00:00:00Z',
}

beforeEach(() => {
  listWorkoutsMock.mockReset().mockResolvedValue([])
  insertWorkoutMock.mockReset().mockResolvedValue({ ...plannedWorkout })
  deleteWorkoutMock.mockReset().mockResolvedValue(undefined)
  archiveWorkoutMock.mockReset().mockResolvedValue({ ...plannedWorkout, status: 'done' })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})
afterEach(() => vi.restoreAllMocks())

describe('TrainView 今日计划', () => {
  it('active=false 不加载', () => {
    render(<TrainView refreshKey={0} active={false} />)
    expect(listWorkoutsMock).not.toHaveBeenCalled()
  })

  it('active=true 加载今日计划并展示', async () => {
    listWorkoutsMock.mockResolvedValue([plannedWorkout])
    render(<TrainView refreshKey={0} active />)
    expect(await screen.findByText('推日')).toBeTruthy()
  })

  it('无计划 → 空态提示', async () => {
    render(<TrainView refreshKey={0} active />)
    expect(await screen.findByText(/今天还没有排课/)).toBeTruthy()
  })

  it('点击完成 → 调用 archiveWorkout 并重新加载', async () => {
    listWorkoutsMock.mockResolvedValueOnce([plannedWorkout]).mockResolvedValueOnce([])
    render(<TrainView refreshKey={0} active />)
    await screen.findByText('推日')
    await userEvent.click(screen.getByText('完成'))
    await waitFor(() => expect(archiveWorkoutMock).toHaveBeenCalledWith(plannedWorkout))
    await waitFor(() => expect(listWorkoutsMock).toHaveBeenCalledTimes(2))
  })

  it('点击删 → 确认后调用 deleteWorkout 并重新加载', async () => {
    listWorkoutsMock.mockResolvedValueOnce([plannedWorkout]).mockResolvedValueOnce([])
    render(<TrainView refreshKey={0} active />)
    await screen.findByText('推日')
    await userEvent.click(screen.getByText('删'))
    await waitFor(() => expect(deleteWorkoutMock).toHaveBeenCalledWith('w1'))
    await waitFor(() => expect(listWorkoutsMock).toHaveBeenCalledTimes(2))
  })
})

describe('TrainView 课表库', () => {
  it('切到课表库 → 展示模板卡片', async () => {
    render(<TrainView refreshKey={0} active />)
    await userEvent.click(screen.getByText('课表库'))
    expect(await screen.findByText('推日')).toBeTruthy()
    expect(screen.getByText('拉日')).toBeTruthy()
    expect(screen.getByText('腿日')).toBeTruthy()
  })

  it('排入模板 → 默认日期今天，提交后调用 insertWorkout 带完整 blocks', async () => {
    render(<TrainView refreshKey={0} active />)
    await userEvent.click(screen.getByText('课表库'))
    const card = (await screen.findByText('推日')).closest('.card') as HTMLElement
    await userEvent.click(within(card).getByText('排入'))
    const dateInput = within(card).getByLabelText('日期') as HTMLInputElement
    const today = new Date().toISOString().slice(0, 10)
    expect(dateInput.value).toBe(today)
    await userEvent.click(within(card).getByText('确认排课'))
    await waitFor(() => expect(insertWorkoutMock).toHaveBeenCalled())
    const payload = insertWorkoutMock.mock.calls[0][0]
    expect(payload.title).toBe('推日')
    expect(payload.date).toBe(today)
    expect(payload.status).toBe('planned')
    expect(payload.blocks.length).toBe(5) // push-day 模板原有 5 个动作
  })

  it('排课前可删除模板里的动作行', async () => {
    render(<TrainView refreshKey={0} active />)
    await userEvent.click(screen.getByText('课表库'))
    const card = (await screen.findByText('推日')).closest('.card') as HTMLElement
    await userEvent.click(within(card).getByText('排入'))
    const removeButtons = within(card).getAllByLabelText('移除动作')
    await userEvent.click(removeButtons[0])
    await userEvent.click(within(card).getByText('确认排课'))
    await waitFor(() => expect(insertWorkoutMock).toHaveBeenCalled())
    const payload = insertWorkoutMock.mock.calls[0][0]
    expect(payload.blocks.length).toBe(4)
  })
})

describe('TrainView 动作库', () => {
  it('切到动作库 → 展示动作列表', async () => {
    render(<TrainView refreshKey={0} active />)
    await userEvent.click(screen.getByText('动作库'))
    expect(await screen.findByText('高杠深蹲')).toBeTruthy()
  })

  it('点击动作 → 展示详情（肌群/要点/常见错误/视频外链）', async () => {
    render(<TrainView refreshKey={0} active />)
    await userEvent.click(screen.getByText('动作库'))
    await userEvent.click(await screen.findByText('高杠深蹲'))
    expect(await screen.findByText(/股四头肌/)).toBeTruthy()
    const link = screen.getByText('观看教学视频') as HTMLAnchorElement
    expect(link.target).toBe('_blank')
    expect(link.href).toContain('bilibili.com')
  })
})
