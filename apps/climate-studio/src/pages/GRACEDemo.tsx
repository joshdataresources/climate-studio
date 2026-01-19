/**
 * GRACE Groundwater Visualization Demo
 *
 * This page demonstrates NASA GRACE groundwater depletion data
 * over the High Plains Aquifer (Ogallala).
 *
 * To view: Navigate to /grace-demo in your browser
 */

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { GRACELayer } from '../components/GRACELayerDemo'

const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ||
  'pk.eyJ1Ijoiam9zaHVhYmJ1dGxlciIsImEiOiJjbWcwNXpyNXUwYTdrMmtva2tiZ2NjcGxhIn0.Fc3d_CloJGiw9-BE4nI_Kw'

mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN

export default function GRACEDemo() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [selectedAquifer, setSelectedAquifer] = useState<'high_plains' | 'central_valley' | 'mississippi_embayment' | 'all'>('high_plains')

  useEffect(() => {
    if (!mapContainer.current || map.current) return

    // Initialize map centered on High Plains Aquifer
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-100.5, 39.5], // Center of High Plains Aquifer
      zoom: 5,
      pitch: 0,
      bearing: 0
    })

    map.current.on('load', () => {
      setMapLoaded(true)
      console.log('✅ Map loaded, ready for GRACE data')
    })

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

    // Add fullscreen control
    map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right')

    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* Map container */}
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {/* GRACE Layer */}
      {mapLoaded && (
        <GRACELayer
          map={map.current}
          aquifer={selectedAquifer}
          resolution={6}
        />
      )}

      {/* Aquifer selector */}
      <div style={{
        position: 'absolute',
        top: 10,
        right: 10,
        background: 'rgba(255, 255, 255, 0.95)',
        padding: '15px',
        borderRadius: '5px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        zIndex: 1000,
        minWidth: '200px'
      }}>
        <div style={{
          fontWeight: 'bold',
          marginBottom: '10px',
          fontSize: '14px'
        }}>
          Select Aquifer
        </div>
        <select
          value={selectedAquifer}
          onChange={(e) => setSelectedAquifer(e.target.value as any)}
          style={{
            width: '100%',
            padding: '8px',
            borderRadius: '3px',
            border: '1px solid #ccc',
            fontSize: '12px'
          }}
        >
          <option value="high_plains">High Plains (Ogallala)</option>
          <option value="central_valley">Central Valley, CA</option>
          <option value="mississippi_embayment">Mississippi Embayment</option>
          <option value="all">All Aquifers</option>
        </select>

        <div style={{
          marginTop: '15px',
          fontSize: '11px',
          color: '#666',
          borderTop: '1px solid #eee',
          paddingTop: '10px'
        }}>
          <strong>About GRACE Data:</strong>
          <ul style={{ margin: '5px 0', paddingLeft: '15px' }}>
            <li>NASA satellite measurements</li>
            <li>Liquid water equivalent (cm)</li>
            <li>Negative = depletion</li>
            <li>Positive = recharge</li>
          </ul>
        </div>
      </div>

      {/* Title overlay */}
      <div style={{
        position: 'absolute',
        bottom: 20,
        left: 20,
        background: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        padding: '15px 20px',
        borderRadius: '5px',
        maxWidth: '400px',
        zIndex: 1000
      }}>
        <h2 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>
          GRACE Groundwater Depletion
        </h2>
        <p style={{ margin: 0, fontSize: '12px', lineHeight: '1.5' }}>
          Real-time visualization of groundwater storage changes from NASA's
          Gravity Recovery and Climate Experiment (GRACE) satellite mission.
          Click on hexagons to see detailed depletion data.
        </p>
      </div>
    </div>
  )
}
