import { describe, it, expect } from 'vitest'
import { parseEntry } from './parser'
import type { FoodData, WorkoutData, ReadingData, LearningData, TravelData } from './types'

describe('parseEntry: food', () => {
  it('午餐 + 多个食物', () => {
    const r = parseEntry('午餐 鸡胸肉沙拉 黑咖啡')!
    expect(r.domain).toBe('food')
    const d = r.data as FoodData
    expect(d.meal).toBe('午')
    expect(d.items).toEqual(['鸡胸肉沙拉', '黑咖啡'])
  })
  it('早饭同义词', () => {
    expect((parseEntry('早饭 燕麦')!.data as FoodData).meal).toBe('早')
  })
  it('加餐', () => {
    expect((parseEntry('加餐 蛋白棒')!.data as FoodData).meal).toBe('加餐')
  })
})

describe('parseEntry: workout', () => {
  it('瑜伽45分钟', () => {
    const r = parseEntry('瑜伽45分钟')!
    expect(r.domain).toBe('workout')
    const d = r.data as WorkoutData
    expect(d.type).toBe('瑜伽')
    expect(d.duration_min).toBe(45)
  })
  it('小时换算', () => {
    expect((parseEntry('跑步1小时')!.data as WorkoutData).duration_min).toBe(60)
  })
  it('力量句式 卧推40kg 5x5', () => {
    const d = parseEntry('卧推40kg 5x5')!.data as WorkoutData
    expect(d.type).toBe('力量')
    expect(d.sets).toEqual([{ exercise: '卧推', weight_kg: 40, sets: 5, reps: 5 }])
  })
  it('多组动作', () => {
    const d = parseEntry('力量 深蹲60kg 3x8 硬拉80kg 3x5')!.data as WorkoutData
    expect(d.sets).toHaveLength(2)
    expect(d.sets![1]).toEqual({ exercise: '硬拉', weight_kg: 80, sets: 3, reps: 5 })
  })
  it('hyrox 大小写', () => {
    expect((parseEntry('Hyrox 60分钟')!.data as WorkoutData).type).toBe('hyrox')
  })
})

describe('parseEntry: 其余四域', () => {
  it('读书 + 页数', () => {
    const r = parseEntry('读 纳瓦尔宝典 30页')!
    expect(r.domain).toBe('reading')
    const d = r.data as ReadingData
    expect(d.title).toBe('纳瓦尔宝典')
    expect(d.pages).toBe(30)
  })
  it('阅读 + 分钟', () => {
    const d = parseEntry('阅读 尽头的回忆 40分钟')!.data as ReadingData
    expect(d.title).toBe('尽头的回忆')
    expect(d.minutes).toBe(40)
  })
  it('学习课程', () => {
    const r = parseEntry('学 MCP开发 90分钟')!
    expect(r.domain).toBe('learning')
    const d = r.data as LearningData
    expect(d.course).toBe('MCP开发')
    expect(d.minutes).toBe(90)
  })
  it('课(独立触发词)', () => {
    const r = parseEntry('课 Python实战 30分钟')!
    expect(r.domain).toBe('learning')
    const d = r.data as LearningData
    expect(d.course).toBe('Python实战')
    expect(d.minutes).toBe(30)
  })
  it('旅行到达', () => {
    const r = parseEntry('到达 清迈')!
    expect(r.domain).toBe('travel')
    expect((r.data as TravelData).place).toBe('清迈')
  })
  it('旅行(独立触发词)', () => {
    const r = parseEntry('旅行 清迈')!
    expect(r.domain).toBe('travel')
    expect((r.data as TravelData).place).toBe('清迈')
  })
  it('日记前缀', () => {
    expect(parseEntry('日记 今天很累但值得')!.domain).toBe('journal')
  })
  it('解不出返回 null', () => {
    expect(parseEntry('嗯')).toBeNull()
    expect(parseEntry('')).toBeNull()
  })
  it('午餐优先于学(含学字食物句)', () => {
    expect(parseEntry('午餐 学校食堂 鸡腿饭')!.domain).toBe('food')
  })
})
