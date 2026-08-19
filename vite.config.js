import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // 项目 GitHub Pages 部署在 /homeland-idle/ 子路径下，资源需用该前缀；
  // 本地预览与 Netlify Drop（部署在根路径）仍用 '/'。
  base: process.env.GH_PAGES ? '/homeland-idle/' : '/',
  server: {
    host: '0.0.0.0',
    port: 5173
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.js'],
  }
})
