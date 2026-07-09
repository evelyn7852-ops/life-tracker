import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/life-tracker/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Life Tracker',
        short_name: 'Life',
        lang: 'zh-CN',
        start_url: '/life-tracker/',
        scope: '/life-tracker/',
        display: 'standalone',
        background_color: '#002FA5',
        theme_color: '#002FA5',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: ['**/node_modules/**', '**/*.int.test.ts'],
  },
})
