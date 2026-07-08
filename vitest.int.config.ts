import { defineConfig } from 'vitest/config'

// 集成测试专用配置：只跑 *.int.test.ts，需要 .env.local + 网络。
// node 环境即可（不需要 DOM），vitest 会自动加载 .env.local。
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.int.test.ts'],
  },
})
