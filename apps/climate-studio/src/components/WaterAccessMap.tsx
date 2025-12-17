import React, { useState } from 'react'
import Map, { Source, Layer, NavigationControl } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const MAPBOX_TOKEN = 'pk.eyJ1Ijoiam9zaC1idXRsZXIiLCJhIjoiY2x4MWY4bzVxMGw1MDJsczhkMzUwZ2I4dCJ9.OI5agPaD6UzeHa_9z-E-8Q'

export default function WaterAccessMap() {
  const [viewState, setViewState] = useState({
    longitude: -73.5,
    latitude: 40.8,
    zoom: 9
  })

  // Sample aquifer data (you can replace with real GeoJSON)
  const aquiferData = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [-73.8, 40.6],
            [-73.2, 40.6],
            [-73.2, 41.0],
            [-73.8, 41.0],
            [-73.8, 40.6]
          ]]
        },
        properties: {
          name: 'Lloyd Aquifer',
          depth: '200-800 ft',
          quality: 'Good',
          capacity: 'High'
        }
      }
    ]
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Map
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        mapStyle="mapbox://styles/mapbox/light-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="top-right" />

        <Source id="aquifers" type="geojson" data={aquiferData}>
          <Layer
            id="aquifer-fill"
            type="fill"
            paint={{
              'fill-color': '#4FC3F7',
              'fill-opacity': 0.4
            }}
          />
          <Layer
            id="aquifer-outline"
            type="line"
            paint={{
              'line-color': '#0277BD',
              'line-width': 2
            }}
          />
        </Source>
      </Map>

      {/* Info Panel */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        background: 'rgba(255, 255, 255, 0.95)',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        maxWidth: '300px',
        zIndex: 1
      }}>
        <h2 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 600 }}>
          Groundwater & Aquifer Access
        </h2>
        <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666' }}>
          Visualizing groundwater resources and aquifer systems in the region.
        </p>
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: '12px', marginBottom: '8px' }}>
            <span style={{
              display: 'inline-block',
              width: '16px',
              height: '16px',
              background: '#4FC3F7',
              marginRight: '8px',
              borderRadius: '2px'
            }}></span>
            <span style={{ fontWeight: 500 }}>Aquifer Zones</span>
          </div>
        </div>
      </div>
    </div>
  )
}
