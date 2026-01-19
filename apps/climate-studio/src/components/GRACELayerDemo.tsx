/**
 * GRACE Groundwater Layer - Proof of Concept
 *
 * This component demonstrates how to add a GRACE groundwater depletion layer
 * to the map using real data from NASA's GRACE satellite.
 *
 * Usage: Import this component and add it to your map view
 */

import { useEffect, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import graceMockData from '../data/grace-mock-data.json'

interface GRACELayerProps {
  map: mapboxgl.Map | null
  aquifer?: 'high_plains' | 'central_valley' | 'mississippi_embayment' | 'all'
  resolution?: number
}

export function GRACELayer({ map, aquifer = 'high_plains', resolution = 6 }: GRACELayerProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dataLoaded, setDataLoaded] = useState(false)

  useEffect(() => {
    if (!map) return

    // Adaptive resolution based on zoom level
    const currentZoom = map.getZoom()
    let adaptiveResolution = resolution

    // Zoom-adaptive resolution for better performance and visibility
    if (currentZoom < 4) {
      adaptiveResolution = 4  // Very large hexagons for country view
    } else if (currentZoom < 6) {
      adaptiveResolution = 5  // Large hexagons for state view
    } else if (currentZoom < 8) {
      adaptiveResolution = 6  // Medium hexagons for region view
    } else {
      adaptiveResolution = 7  // Small hexagons for city view
    }

    console.log(`📊 GRACE: zoom=${currentZoom.toFixed(1)}, resolution=${adaptiveResolution}`)

    const loadGRACEData = async () => {
      setLoading(true)
      setError(null)

      try {
        let data

        // Try to fetch from API, fall back to mock data if it fails
        try {
          // Get current map bounds
          const bounds = map.getBounds()
          const boundsObj = {
            west: bounds.getWest(),
            east: bounds.getEast(),
            south: bounds.getSouth(),
            north: bounds.getNorth()
          }

          // Use environment variable or default to localhost:5001
          const apiUrl = import.meta.env.VITE_CLIMATE_API_URL || 'http://localhost:5001'

          // Use viewport bounds instead of fixed aquifer with adaptive resolution
          const boundsParam = encodeURIComponent(JSON.stringify(boundsObj))
          const response = await fetch(
            `${apiUrl}/api/climate/groundwater?bounds=${boundsParam}&resolution=${adaptiveResolution}`,
            { signal: AbortSignal.timeout(10000) } // 10 second timeout for larger queries
          )

          if (response.ok) {
            const apiData = await response.json()
            if (!apiData.error) {
              data = apiData
            }
          }
        } catch (apiError) {
          console.warn('API fetch failed, using mock data:', apiError)
        }

        // Use mock data if API failed
        if (!data) {
          console.log('📊 Using mock GRACE data for demonstration')
          data = graceMockData
        }

        console.log('🌍 GRACE data loaded:', {
          features: data.features?.length,
          aquifer,
          resolution
        })

        // Add the GRACE data source
        if (!map.getSource('grace-groundwater')) {
          map.addSource('grace-groundwater', {
            type: 'geojson',
            data: data
          })
        } else {
          const source = map.getSource('grace-groundwater') as mapboxgl.GeoJSONSource
          source.setData(data)
        }

        // Find the first label layer to insert GRACE layers before labels
        const layers = map.getStyle().layers
        let firstLabelLayerId: string | undefined
        for (const layer of layers) {
          if (layer.type === 'symbol' && layer.layout && layer.layout['text-field']) {
            firstLabelLayerId = layer.id
            break
          }
        }

        // Add fill layer showing depletion with color gradient
        if (!map.getLayer('grace-groundwater-fill')) {
          map.addLayer({
            id: 'grace-groundwater-fill',
            type: 'fill',
            source: 'grace-groundwater',
            paint: {
              'fill-color': [
                'interpolate',
                ['linear'],
                ['get', 'trendCmPerYear'],
                -3,   '#8b0000',  // Dark red - severe depletion
                -2,   '#dc143c',  // Crimson - high depletion
                -1,   '#ff6347',  // Tomato - moderate depletion
                -0.5, '#ffa500',  // Orange - mild depletion
                0,    '#90ee90',  // Light green - stable
                0.5,  '#32cd32',  // Lime green - recharge
                1,    '#228b22'   // Forest green - strong recharge
              ],
              'fill-opacity': 0.7  // Slightly more opaque to stand out
            }
          }, firstLabelLayerId) // Insert before labels so text is readable
        }

        // Add border layer for hexagons (hexacomb pattern) - on top of fill
        if (!map.getLayer('grace-groundwater-border')) {
          map.addLayer({
            id: 'grace-groundwater-border',
            type: 'line',
            source: 'grace-groundwater',
            paint: {
              'line-color': '#ffffff',  // White borders for better contrast
              'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                3, 1.5,     // Thicker lines when zoomed out
                6, 2,
                10, 2.5     // Even thicker when zoomed in
              ],
              'line-opacity': 0.9  // Very visible borders for hexacomb pattern
            }
          }, firstLabelLayerId) // Also before labels
        }

        // Add click handler for popup
        map.on('click', 'grace-groundwater-fill', (e) => {
          if (!e.features || e.features.length === 0) return

          const feature = e.features[0]
          const props = feature.properties

          if (!props) return

          const html = `
            <div style="padding: 10px; min-width: 200px;">
              <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold;">
                ${props.aquifer || 'GRACE Groundwater Data'}
              </h3>
              <div style="font-size: 12px;">
                <div style="margin: 5px 0;">
                  <strong>Trend:</strong> ${parseFloat(props.trendCmPerYear).toFixed(2)} cm/year
                </div>
                <div style="margin: 5px 0;">
                  <strong>Total Change:</strong> ${parseFloat(props.totalChangeCm).toFixed(1)} cm
                </div>
                <div style="margin: 5px 0;">
                  <strong>Status:</strong>
                  <span style="color: ${getStatusColor(props.status)};">
                    ${formatStatus(props.status)}
                  </span>
                </div>
              </div>
              <div style="margin-top: 10px; font-size: 10px; color: #666;">
                Data: NASA GRACE satellite
              </div>
            </div>
          `

          new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(html)
            .addTo(map)
        })

        // Change cursor on hover
        map.on('mouseenter', 'grace-groundwater-fill', () => {
          map.getCanvas().style.cursor = 'pointer'
        })

        map.on('mouseleave', 'grace-groundwater-fill', () => {
          map.getCanvas().style.cursor = ''
        })

        setDataLoaded(true)
        setLoading(false)
      } catch (err) {
        console.error('❌ Failed to load GRACE data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load GRACE data')
        setLoading(false)
      }
    }

    loadGRACEData()

    // Track current resolution to reload when it changes
    let currentResolution = adaptiveResolution

    // Add zoom listener to reload data when crossing resolution boundaries
    const handleZoom = () => {
      const zoom = map.getZoom()

      // Calculate what resolution we should be at
      let newResolution = resolution
      if (zoom < 4) {
        newResolution = 4
      } else if (zoom < 6) {
        newResolution = 5
      } else if (zoom < 8) {
        newResolution = 6
      } else {
        newResolution = 7
      }

      // Reload if resolution changed
      if (newResolution !== currentResolution) {
        console.log(`🔄 Resolution changed: ${currentResolution} → ${newResolution}`)
        currentResolution = newResolution
        setDataLoaded(false)
      }
    }

    // Add moveend listener to reload data when panning (but not on every tiny move)
    let moveTimeout: NodeJS.Timeout
    const handleMoveEnd = () => {
      clearTimeout(moveTimeout)
      moveTimeout = setTimeout(() => {
        setDataLoaded(false) // Force reload after pan
      }, 500) // Debounce 500ms
    }

    map.on('zoom', handleZoom)
    map.on('moveend', handleMoveEnd)

    // Cleanup
    return () => {
      map.off('zoom', handleZoom)
      map.off('moveend', handleMoveEnd)

      if (map.getLayer('grace-groundwater-fill')) {
        map.removeLayer('grace-groundwater-fill')
      }
      if (map.getLayer('grace-groundwater-border')) {
        map.removeLayer('grace-groundwater-border')
      }
      if (map.getSource('grace-groundwater')) {
        map.removeSource('grace-groundwater')
      }
    }
  }, [map, aquifer, resolution, dataLoaded])

  // Helper functions
  function getStatusColor(status: string): string {
    switch (status) {
      case 'severe_depletion': return '#dc143c'
      case 'moderate_depletion': return '#ff6347'
      case 'stable': return '#90ee90'
      case 'recharge': return '#32cd32'
      default: return '#666'
    }
  }

  function formatStatus(status: string): string {
    return status.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  // Don't render debug overlay - data is visible on map
  return null
}
