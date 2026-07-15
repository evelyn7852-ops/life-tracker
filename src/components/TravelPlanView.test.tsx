import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TravelPlanView } from './TravelPlanView'

describe('TravelPlanView', () => {
  it('渲染标题与粒度说明', () => {
    render(<TravelPlanView onClose={() => {}} />)
    expect(screen.getByText('旅行规划')).toBeTruthy()
    expect(screen.getByText(/五一\/十一\/圣诞/)).toBeTruthy()
  })

  it('当前年（2026）默认展开，可见其行程', () => {
    render(<TravelPlanView onClose={() => {}} />)
    expect(screen.getByText(/泰国·曼谷\+普吉岛/)).toBeTruthy()
  })

  it('未来年份默认折叠，点击后展开', async () => {
    render(<TravelPlanView onClose={() => {}} />)
    expect(screen.queryByText(/川西·色达/)).toBeFalsy()
    const btn = screen.getByText('2027年').closest('button')!
    await userEvent.click(btn)
    expect(screen.getByText(/川西·色达/)).toBeTruthy()
  })

  it('已完成行程显示 ✓', () => {
    render(<TravelPlanView onClose={() => {}} />)
    expect(screen.getAllByLabelText('已完成').length).toBeGreaterThan(0)
  })

  it('点击遮罩层触发 onClose', async () => {
    let closed = false
    render(<TravelPlanView onClose={() => { closed = true }} />)
    await userEvent.click(document.querySelector('.day-detail-overlay')!)
    expect(closed).toBe(true)
  })

  it('已排除清单折叠展开', async () => {
    render(<TravelPlanView onClose={() => {}} />)
    expect(screen.queryByText(/菲律宾/)).toBeFalsy()
    await userEvent.click(screen.getByText('已排除清单').closest('button')!)
    expect(screen.getByText(/菲律宾/)).toBeTruthy()
  })
})
