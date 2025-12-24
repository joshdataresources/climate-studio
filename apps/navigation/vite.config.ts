import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'climate-studio': path.resolve(__dirname, '../climate-studio/src/index.tsx'),
      'climate-studio-styles': path.resolve(__dirname, '../climate-studio/src/globals.css'),
      '@climate-studio/core/config': path.resolve(__dirname, '../../packages/climate-core/src/config/climateLayers.ts'),
      '@climate-studio/core/contexts': path.resolve(__dirname, '../../packages/climate-core/src/contexts/ClimateContext.tsx'),
      '@climate-studio/core': path.resolve(__dirname, '../../packages/climate-core/src'),
      '@/': path.resolve(__dirname, '../climate-studio/src/'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true
      }
    }
  },
  css: {
    postcss: './postcss.config.cjs'
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  }
})
