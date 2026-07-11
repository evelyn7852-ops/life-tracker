import { describe, it, expect } from 'vitest'
import exercises from './exercises.json'
import templates from './workoutTemplates.json'

describe('workoutTemplates 引用完整性', () => {
  const exerciseIds = new Set(exercises.map((e) => e.id))

  it('动作库 id 唯一', () => {
    expect(exerciseIds.size).toBe(exercises.length)
  })

  it('模板库 id 唯一', () => {
    expect(new Set(templates.map((t) => t.id)).size).toBe(templates.length)
  })

  it('每个模板至少有一个动作块', () => {
    for (const t of templates) {
      expect(t.blocks.length).toBeGreaterThan(0)
    }
  })

  it('每个模板 block 的 exerciseId 都存在于动作库', () => {
    for (const t of templates) {
      for (const b of t.blocks) {
        expect(exerciseIds.has(b.exerciseId), `模板「${t.name}」引用了不存在的动作 id: ${b.exerciseId}`).toBe(true)
      }
    }
  })
})
