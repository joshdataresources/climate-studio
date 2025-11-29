import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './globals.css'
import 'leaflet/dist/leaflet.css'

const rootElement = document.getElementById('root')
if (rootElement) {
  const root = createRoot(rootElement)
  root.render(<App />)
} else {
  console.error('Root element not found')
}