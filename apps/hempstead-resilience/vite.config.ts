import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig(({ command }) => ({
  plugins: [react(), tsconfigPaths()],
  base: command === 'build' ? '/hempstead-resilience/' : '/',
  server: {
    port: 8083,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true
      }
    }
  },
  assetsInclude: ['**/*.geojson'],
  json: {
    stringify: false
  }
}))
