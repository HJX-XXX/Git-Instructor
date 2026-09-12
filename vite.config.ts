import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// 开发时用根路径（本地 localhost 可直接打开）；
// 构建产物仍使用 GitHub Pages 项目路径 /Git-Instructor/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/Git-Instructor/' : '/',
  server: {
    host: true,
    // 允许内网穿透域名（如 cpolar / ngrok）访问开发服务器
    allowedHosts: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}))
