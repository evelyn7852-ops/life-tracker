import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TravelPlanView } from './TravelPlanView'
import type { TripRow } from '../lib/tripRepo'

const seedTripsIfEmptyMock = vi.fn()
const listTripsMock = vi.fn()
const insertTripMock = vi.fn()
const updateTripMock = vi.fn()
const deleteTripMock = vi.fn()

vi.mock('../lib/tripRepo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/tripRepo')>()
  return {
    ...actual,
    seedTripsIfEmpty: (...a: unknown[]) => seedTripsIfEmptyMock(...a),
    listTrips: (...a: unknown[]) => listTripsMock(...a),
    insertTrip: (...a: unknown[]) => insertTripMock(...a),
    updateTrip: (...a: unknown[]) => updateTripMock(...a),
    deleteTrip: (...a: unknown[]) => deleteTripMock(...a),
  }
})

function row(overrides: Partial<TripRow> = {}): TripRow {
  return {
    id: 'id-1', year: 2026, slot: '五一', period_hint: '已完成', destination: '泰国·曼谷+普吉岛',
    country: '泰国', trip_type: 'intl', days: null, status: 'done', budget_cny: 8000, budget_stale: false,
    notes: '', seed_key: '2026-五一-泰国·曼谷+普吉岛', created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

const sampleRows: TripRow[] = [
  row({}),
  row({
    id: 'id-2', year: 2027, slot: '五一', destination: '川西·色达+炉霍+新都桥', country: '中国',
    status: 'planned', period_hint: '7天', budget_cny: 4000, seed_key: '2027-五一-川西·色达+炉霍+新都桥',
  }),
]

beforeEach(() => {
  seedTripsIfEmptyMock.mockReset().mockResolvedValue(undefined)
  listTripsMock.mockReset().mockResolvedValue(sampleRows)
  insertTripMock.mockReset()
  updateTripMock.mockReset()
  deleteTripMock.mockReset()
})

describe('TravelPlanView', () => {
  it('渲染标题与粒度说明', () => {
    render(<TravelPlanView onClose={() => {}} />)
    expect(screen.getByText('旅行规划')).toBeTruthy()
    expect(screen.getByText(/五一\/十一\/圣诞/)).toBeTruthy()
  })

  it('打开时先种子导入再读取列表', async () => {
    render(<TravelPlanView onClose={() => {}} />)
    await waitFor(() => expect(seedTripsIfEmptyMock).toHaveBeenCalledTimes(1))
    expect(listTripsMock).toHaveBeenCalled()
  })

  it('当前年（2026）默认展开，可见其行程', async () => {
    render(<TravelPlanView onClose={() => {}} />)
    expect(await screen.findByText(/泰国·曼谷\+普吉岛/)).toBeTruthy()
  })

  it('未来年份默认折叠，点击后展开', async () => {
    render(<TravelPlanView onClose={() => {}} />)
    await screen.findByText(/泰国·曼谷\+普吉岛/)
    expect(screen.queryByText(/川西·色达/)).toBeFalsy()
    const btn = screen.getByText('2027年').closest('button')!
    await userEvent.click(btn)
    expect(screen.getByText(/川西·色达/)).toBeTruthy()
  })

  it('已完成行程显示 ✓', async () => {
    render(<TravelPlanView onClose={() => {}} />)
    await screen.findByText(/泰国·曼谷\+普吉岛/)
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
    await screen.findByText(/泰国·曼谷\+普吉岛/)
    expect(screen.queryByText(/菲律宾/)).toBeFalsy()
    await userEvent.click(screen.getByText('已排除清单').closest('button')!)
    expect(screen.getByText(/菲律宾/)).toBeTruthy()
  })

  it('点击目的地进入编辑态，修改后点「存」调用 updateTrip', async () => {
    updateTripMock.mockResolvedValue({ ...sampleRows[0], destination: '泰国·曼谷' })
    render(<TravelPlanView onClose={() => {}} />)
    const dest = await screen.findByText(/泰国·曼谷\+普吉岛/)
    await userEvent.click(dest)

    const input = screen.getByDisplayValue('泰国·曼谷+普吉岛')
    await userEvent.clear(input)
    await userEvent.type(input, '泰国·曼谷')
    await userEvent.click(screen.getByText('存'))

    await waitFor(() => expect(updateTripMock).toHaveBeenCalledTimes(1))
    expect(updateTripMock).toHaveBeenCalledWith('id-1', expect.objectContaining({ destination: '泰国·曼谷' }))
    expect(listTripsMock).toHaveBeenCalledTimes(2) // 首次加载 + 保存后 reload
  })

  it('编辑态点「删」并确认后调用 deleteTrip', async () => {
    deleteTripMock.mockResolvedValue(undefined)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<TravelPlanView onClose={() => {}} />)
    const dest = await screen.findByText(/泰国·曼谷\+普吉岛/)
    await userEvent.click(dest)
    await userEvent.click(screen.getByText('删'))
    await waitFor(() => expect(deleteTripMock).toHaveBeenCalledWith('id-1'))
    confirmSpy.mockRestore()
  })

  it('取消确认框则不调用 deleteTrip', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<TravelPlanView onClose={() => {}} />)
    const dest = await screen.findByText(/泰国·曼谷\+普吉岛/)
    await userEvent.click(dest)
    await userEvent.click(screen.getByText('删'))
    expect(deleteTripMock).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('编辑态把年份改到已有行程的年份 → 显示⚠️同年已有N程（不自动重排）', async () => {
    render(<TravelPlanView onClose={() => {}} />)
    const dest = await screen.findByText(/泰国·曼谷\+普吉岛/) // id-1，年份 2026
    await userEvent.click(dest)
    const yearInput = screen.getByLabelText('年份')
    await userEvent.clear(yearInput)
    await userEvent.type(yearInput, '2027')
    expect(await screen.findByText(/⚠️同年已有1程/)).toBeTruthy()
    // 未点存，不应调用 updateTrip
    expect(updateTripMock).not.toHaveBeenCalled()
  })

  it('本季（当年当季）有 planned/booked 行程时，顶部显示「本季计划」提醒', async () => {
    listTripsMock.mockResolvedValue([
      ...sampleRows,
      row({ id: 'q3', year: 2026, slot: '7月', destination: '内蒙古草原', status: 'planned', seed_key: null }),
    ])
    render(<TravelPlanView onClose={() => {}} />)
    expect(await screen.findByText(/本季计划/)).toBeTruthy()
    expect(screen.getAllByText(/内蒙古草原/).length).toBeGreaterThan(0)
  })

  it('本季无 planned/booked 行程时不显示提醒', async () => {
    render(<TravelPlanView onClose={() => {}} />) // sampleRows 里 2026 年只有五一(已完成)，当季(7月/Q3)无命中
    await screen.findByText(/泰国·曼谷\+普吉岛/)
    expect(screen.queryByText(/本季计划/)).toBeFalsy()
  })

  it('点击「+ 加行程」填写目的地和时段后保存，调用 insertTrip', async () => {
    insertTripMock.mockResolvedValue(row({ id: 'new-1', destination: '新目的地' }))
    render(<TravelPlanView onClose={() => {}} />)
    await screen.findByText(/泰国·曼谷\+普吉岛/)

    await userEvent.click(screen.getByText('+ 加行程'))
    const inputs = screen.getAllByPlaceholderText('目的地')
    await userEvent.type(inputs[0], '新目的地')
    const slotInputs = screen.getAllByPlaceholderText('时段（如 五一/十一/7月）')
    await userEvent.type(slotInputs[0], '春节')
    const saveButtons = screen.getAllByText('存')
    await userEvent.click(saveButtons[saveButtons.length - 1])

    await waitFor(() => expect(insertTripMock).toHaveBeenCalledTimes(1))
    expect(insertTripMock).toHaveBeenCalledWith(expect.objectContaining({
      year: 2026, slot: '春节', destination: '新目的地', seed_key: null,
    }))
  })

  it('不填目的地点「+ 加行程」的存不调用 insertTrip', async () => {
    render(<TravelPlanView onClose={() => {}} />)
    await screen.findByText(/泰国·曼谷\+普吉岛/)
    await userEvent.click(screen.getByText('+ 加行程'))
    const saveButtons = screen.getAllByText('存')
    await userEvent.click(saveButtons[saveButtons.length - 1])
    expect(insertTripMock).not.toHaveBeenCalled()
  })
})
