import { describe, it, expect } from 'vitest'
import { parseGeneratedWorkout } from './generateWorkout'

const VALID_IDS = ['back-squat', 'bench-press', 'skierg', 'wall-ball', 'burpee-broad-jump']

describe('parseGeneratedWorkout', () => {
  it('合法响应 → 解析出 title + blocks', () => {
    const result = parseGeneratedWorkout(
      {
        title: 'Hyrox 混合日',
        blocks: [
          { exerciseId: 'skierg', distance_m: 1000, restSec: 60 },
          { exerciseId: 'wall-ball', reps: 20, restSec: 60 },
          { exerciseId: 'burpee-broad-jump', distance_m: 80, restSec: 90 },
        ],
      },
      VALID_IDS,
    )
    expect(result).toEqual({
      title: 'Hyrox 混合日',
      blocks: [
        { exerciseId: 'skierg', distance: 1000, restSec: 60 },
        { exerciseId: 'wall-ball', reps: 20, restSec: 60 },
        { exerciseId: 'burpee-broad-jump', distance: 80, restSec: 90 },
      ],
    })
  })

  it('剔除白名单外的 exerciseId，其余 block 保留', () => {
    const result = parseGeneratedWorkout(
      {
        title: '力量日',
        blocks: [
          { exerciseId: 'back-squat', sets: 4, reps: 8, restSec: 90 },
          { exerciseId: 'bench-press', sets: 3, reps: 10, restSec: 90 },
          { exerciseId: 'not-a-real-exercise', sets: 3, reps: 10, restSec: 90 },
          { exerciseId: 'skierg', distance_m: 500, restSec: 60 },
        ],
      },
      VALID_IDS,
    )
    expect(result?.blocks.map((b) => b.exerciseId)).toEqual(['back-squat', 'bench-press', 'skierg'])
  })

  it('有效 block 少于 3 个 → 返回 null', () => {
    const result = parseGeneratedWorkout(
      {
        title: '太短了',
        blocks: [
          { exerciseId: 'back-squat', sets: 4, reps: 8, restSec: 90 },
          { exerciseId: 'not-real', sets: 3, reps: 10, restSec: 90 },
        ],
      },
      VALID_IDS,
    )
    expect(result).toBeNull()
  })

  it('缺少 title → 返回 null', () => {
    const result = parseGeneratedWorkout(
      {
        blocks: [
          { exerciseId: 'back-squat', sets: 4, reps: 8, restSec: 90 },
          { exerciseId: 'bench-press', sets: 3, reps: 10, restSec: 90 },
          { exerciseId: 'skierg', distance_m: 500, restSec: 60 },
        ],
      },
      VALID_IDS,
    )
    expect(result).toBeNull()
  })

  it('blocks 不是数组 → 返回 null', () => {
    expect(parseGeneratedWorkout({ title: '标题', blocks: 'oops' }, VALID_IDS)).toBeNull()
  })

  it('顶层不是对象 → 返回 null', () => {
    expect(parseGeneratedWorkout(null, VALID_IDS)).toBeNull()
    expect(parseGeneratedWorkout('oops', VALID_IDS)).toBeNull()
  })

  it('数值字段从字符串强转', () => {
    const result = parseGeneratedWorkout(
      {
        title: '力量日',
        blocks: [
          { exerciseId: 'back-squat', sets: '4', reps: '8', restSec: '90' },
          { exerciseId: 'bench-press', sets: 3, reps: 10, restSec: 90 },
          { exerciseId: 'skierg', distance_m: '500', restSec: 60 },
        ],
      },
      VALID_IDS,
    )
    expect(result?.blocks[0]).toEqual({ exerciseId: 'back-squat', sets: 4, reps: 8, restSec: 90 })
  })

  it('sets/reps/restSec/duration_sec/distance_m 超界会被夹紧', () => {
    const result = parseGeneratedWorkout(
      {
        title: '越界测试',
        blocks: [
          { exerciseId: 'back-squat', sets: 99, reps: 999, restSec: 9999 },
          { exerciseId: 'bench-press', sets: 0, reps: 0, restSec: -10 },
          { exerciseId: 'skierg', duration_sec: 999999, distance_m: 999999 },
        ],
      },
      VALID_IDS,
    )
    expect(result?.blocks[0]).toEqual({ exerciseId: 'back-squat', sets: 10, reps: 50, restSec: 300 })
    expect(result?.blocks[1]).toEqual({ exerciseId: 'bench-press', sets: 1, reps: 1, restSec: 0 })
    expect(result?.blocks[2]).toEqual({ exerciseId: 'skierg', duration: 3600, distance: 5000 })
  })

  it('无效 block（非对象/缺 exerciseId）被剔除', () => {
    const result = parseGeneratedWorkout(
      {
        title: '标题',
        blocks: [
          { exerciseId: 'back-squat', sets: 4, reps: 8, restSec: 90 },
          { exerciseId: 'bench-press', sets: 3, reps: 10, restSec: 90 },
          null,
          { sets: 3, reps: 10 },
          { exerciseId: 'skierg', distance_m: 500, restSec: 60 },
        ],
      },
      VALID_IDS,
    )
    expect(result?.blocks.map((b) => b.exerciseId)).toEqual(['back-squat', 'bench-press', 'skierg'])
  })
})
