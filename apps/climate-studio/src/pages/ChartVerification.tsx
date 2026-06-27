import React, { useState, useEffect } from 'react'
import { LocationMultiCityCharts } from '../components/dashboard/LocationMultiCityCharts'
import { getAllSupportedMetros } from '../utils/metroResolver'
import type { LocationSelection } from '../components/dashboard/LocationSearchBar'

const ALL_METROS = getAllSupportedMetros()

export default function ChartVerification() {
  const [cityCount, setCityCount] = useState(7)
  const [refreshKey, setRefreshKey] = useState(0)

  // Get default test cities
  const defaultCities = ['New York', 'Seattle', 'Phoenix', 'Houston', 'Miami', 'Los Angeles', 'Chicago']
  const locations: LocationSelection[] = defaultCities.slice(0, cityCount).map(key => {
    const metro = ALL_METROS.find(m => m.key === key)
    if (!metro) return null
    return {
      metroKey: metro.key,
      metroName: metro.name,
      lat: metro.lat,
      lon: metro.lon
    }
  }).filter(Boolean) as LocationSelection[]

  // Auto-check for issues
  useEffect(() => {
    const checkInterval = setInterval(() => {
      const svgElements = document.querySelectorAll('svg path[stroke]')
      const paths = Array.from(svgElements).filter(el => {
        const stroke = el.getAttribute('stroke')
        return stroke && !stroke.includes('rgba') && stroke !== 'none'
      })

      console.log(`[ChartVerification] Check: ${locations.length} cities, ${paths.length} visible paths`)

      const status = document.getElementById('status')
      if (status) {
        status.textContent = `Cities: ${locations.length}, Visible Lines: ${Math.floor(paths.length / 2)} (2 paths per line)`
        status.className = paths.length >= locations.length * 2 ? 'text-green-500' : 'text-red-500'
      }
    }, 1000)

    return () => clearInterval(checkInterval)
  }, [locations.length])

  return (
    <div className="p-6 bg-[var(--cs-bg-primary)] min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Chart Verification Test</h1>

        <div className="mb-6 p-4 bg-[var(--cs-bg-secondary)] rounded-lg">
          <div className="flex items-center gap-4 mb-4">
            <label>Cities: {cityCount}</label>
            <input
              type="range"
              min="1"
              max="7"
              value={cityCount}
              onChange={(e) => setCityCount(Number(e.target.value))}
              className="flex-1"
            />
            <button
              onClick={() => setRefreshKey(k => k + 1)}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              Force Refresh
            </button>
          </div>

          <div className="text-sm">
            <div>Selected Cities: {locations.map(l => l.metroName).join(', ')}</div>
            <div id="status" className="mt-2 font-bold">Checking...</div>
          </div>
        </div>

        <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
          <h3 className="font-bold text-yellow-400 mb-2">Expected Behavior:</h3>
          <ul className="list-disc list-inside text-sm space-y-1">
            <li>Each chart should show exactly {cityCount} lines</li>
            <li>Each line should have a different color</li>
            <li>The legend should list all {cityCount} cities</li>
            <li>All cities should be toggleable in the legend</li>
            <li>No lines should be missing</li>
          </ul>
        </div>

        <div key={refreshKey}>
          <LocationMultiCityCharts
            locations={locations}
            scenario="ssp245"
          />
        </div>

        <div className="mt-6 p-4 bg-[var(--cs-bg-secondary)] rounded-lg">
          <h3 className="font-bold mb-2">Debug Info:</h3>
          <div className="text-xs font-mono">
            <div>Refresh Key: {refreshKey}</div>
            <div>Locations: {JSON.stringify(locations.map(l => l.metroKey))}</div>
            <div>Timestamp: {new Date().toISOString()}</div>
          </div>
        </div>
      </div>
    </div>
  )
}