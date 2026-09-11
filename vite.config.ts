import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  // GitHub Pages 项目页路径：https://<user>.github.io/Git-Instructor/
  base: '/Git-Instructor/',
  server: {
    host: true,
    // 允许内网穿透域名（如 cpolar / ngrok）访问开发服务器
    allowedHosts: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
