import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './globals.css'
import 'leaflet/dist/leaflet.css'

const rootElement = document.getElementById('root')
if (rootElement) {
  console.log('✅ Root element found, initializing React app...')
  try {
    const root = createRoot(rootElement)
    console.log('✅ React root created, rendering App...')
    root.render(<App />)
    console.log('✅ App rendered successfully')
  } catch (error) {
    console.error('❌ Error rendering app:', error)
    rootElement.innerHTML = `
      <div style="padding: 20px; font-family: system-ui; color: red;">
        <h2>Error Loading Application</h2>
        <p>${error instanceof Error ? error.message : String(error)}</p>
        <pre style="background: #f5f5f5; padding: 10px; overflow: auto;">${error instanceof Error ? error.stack : ''}</pre>
      </div>
    `
  }
} else {
  console.error('❌ Root element not found')
}