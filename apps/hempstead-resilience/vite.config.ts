import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  base: '/hempstead-resilience/',
  server: {
    port: 8083,
    host: '0.0.0.0'
  }
})
