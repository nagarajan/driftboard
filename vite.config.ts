import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  // Use /apps/tasks/ base path for production build, / for dev server
  base: command === 'build' ? '/apps/tasks/' : '/',
  server: {
    port: 8095,
    host: '0.0.0.0',
  },
}))
