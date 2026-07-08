import { describe, it, expect } from 'vitest'
import { parseEntry } from './parser'
import type { FoodData, WorkoutData } from './types'

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
