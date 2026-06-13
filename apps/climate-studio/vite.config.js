import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  cacheDir: process.env.VITE_CACHE_DIR || 'node_modules/.vite',
  plugins: [
    react(),
    tsconfigPaths()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Force a single React instance — fixes the `import_react3 is not defined`
    // error that crops up when esbuild pre-bundles multiple deps that each
    // pull React in via CommonJS/ESM interop.
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: '0.0.0.0',
    port: 8080,
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
    // Explicitly include the React entry points so esbuild pre-bundles them
    // once, with consistent identifiers, instead of generating per-consumer
    // aliases (import_react, import_react2, …) that can desync.
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
    ],
    exclude: ['leaflet']
  }
})
