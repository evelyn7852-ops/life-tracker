import { describe, it, expect } from 'vitest'
import exercises from '../data/exercises.json'
// vite ?raw：把 Edge Function 源码作为字符串导入，无需 node 类型
import fnSrc from '../../supabase/functions/generate-workout/index.ts?raw'

/**
 * 漂移守卫：generate-workout Edge Function 目录自包含部署，无法 import src/data，
 * 故内联了一份 exerciseId 白名单副本。这里断言它与主库 id 集合完全一致——
 * 以后增删动作若忘了同步 Edge Function，此测试会红，避免生成时静默剔除新动作。
 */
describe('generate-workout Edge Function 白名单与 exercises.json 同步', () => {
  it('两侧 exerciseId 集合逐一相等', () => {
    const fnIds = [...(fnSrc as string).matchAll(/\{ id: '([^']+)', name:/g)].map((m) => m[1]).sort()
    const dataIds = exercises.map((e) => e.id).sort()

    expect(fnIds.length).toBeGreaterThan(0)
    expect(fnIds).toEqual(dataIds)
  })
})
