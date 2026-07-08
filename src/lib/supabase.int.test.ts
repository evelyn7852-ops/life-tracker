import { describe, it, expect } from 'vitest'
import { supabase } from './supabase'

// 集成测试：需要 .env.local + 网络。CI/日常 npm test 排除（见下）。
describe('supabase connectivity', () => {
  it('anon 能连上（未登录查询返回空数组而非网络错）', async () => {
    const { data, error } = await supabase.from('entries').select('id').limit(1)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })
})
