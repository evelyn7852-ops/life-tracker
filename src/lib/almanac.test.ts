import { describe, it, expect } from 'vitest'
import { getSolarTerm, getHoliday, getAlmanacEvent } from './almanac'

describe('getSolarTerm 24节气（寿星公式）2026 锚点', () => {
  it('2026-02-04 立春', () => {
    expect(getSolarTerm(new Date(2026, 1, 4))?.name).toBe('立春')
  })
  it('2026-04-05 清明', () => {
    expect(getSolarTerm(new Date(2026, 3, 5))?.name).toBe('清明')
  })
  it('2026-06-21 夏至', () => {
    expect(getSolarTerm(new Date(2026, 5, 21))?.name).toBe('夏至')
  })
  it('2026-12-22 冬至', () => {
    expect(getSolarTerm(new Date(2026, 11, 22))?.name).toBe('冬至')
  })
  it('非节气当天返回 null', () => {
    expect(getSolarTerm(new Date(2026, 1, 5))).toBeNull()
  })
  it('每个节气都带 emoji', () => {
    const t = getSolarTerm(new Date(2026, 1, 4))
    expect(t?.emoji).toBeTruthy()
  })
})

describe('getHoliday 节假日', () => {
  it('阳历节日：元旦 01-01', () => {
    expect(getHoliday(new Date(2026, 0, 1))?.name).toBe('元旦')
  })
  it('阳历节日：圣诞 12-25', () => {
    expect(getHoliday(new Date(2026, 11, 25))?.name).toBe('圣诞节')
  })
  it('农历节日：2026 春节 = 02-17', () => {
    expect(getHoliday(new Date(2026, 1, 17))?.name).toBe('春节')
  })
  it('农历节日：2026 端午 = 06-19', () => {
    expect(getHoliday(new Date(2026, 5, 19))?.name).toBe('端午节')
  })
  it('农历节日：2027 中秋 = 09-15', () => {
    expect(getHoliday(new Date(2027, 8, 15))?.name).toBe('中秋节')
  })
  it('查表之外年份（2031）不猜测 → null', () => {
    expect(getHoliday(new Date(2031, 1, 1))).toBeNull()
  })
  it('无节日当天返回 null', () => {
    expect(getHoliday(new Date(2026, 2, 15))).toBeNull()
  })
})

describe('getAlmanacEvent 合并节日/节气', () => {
  it('节日优先于节气', () => {
    const e = getAlmanacEvent(new Date(2026, 0, 1))
    expect(e?.name).toBe('元旦')
  })
  it('无节日时回退节气', () => {
    const e = getAlmanacEvent(new Date(2026, 1, 4))
    expect(e?.name).toBe('立春')
  })
  it('都没有 → null', () => {
    expect(getAlmanacEvent(new Date(2026, 2, 15))).toBeNull()
  })
})
