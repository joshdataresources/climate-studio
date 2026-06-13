import { useEffect, useState } from 'react'
import {
  fetchDashboardEarthEngineSnapshot,
  type DashboardEarthEngineSnapshot,
} from '../utils/dashboardClimateApi'
import type { SspScenario } from '../utils/scenarioMapping'

export type EarthEngineLoadState = 'idle' | 'loading' | 'success' | 'error'

export function useDashboardEarthEngine(
  lat: number | undefined,
  lon: number | undefined,
  projectionYear: number,
  scenario: SspScenario
) {
  const [state, setState] = useState<EarthEngineLoadState>('idle')
  const [snapshot, setSnapshot] = useState<DashboardEarthEngineSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (lat == null || lon == null) {
      setState('idle')
      setSnapshot(null)
      setError(null)
      return
    }

    const controller = new AbortController()
    setState('loading')
    setError(null)

    fetchDashboardEarthEngineSnapshot(lat, lon, projectionYear, scenario, controller.signal)
      .then(result => {
        if (controller.signal.aborted) return
        setSnapshot(result)
        setState(result.isRealData ? 'success' : 'error')
        if (!result.isRealData) {
          setError('No Earth Engine values returned for this location')
        }
      })
      .catch(err => {
        if (controller.signal.aborted) return
        setSnapshot(null)
        setState('error')
        setError(err instanceof Error ? err.message : 'Earth Engine request failed')
      })

    return () => controller.abort()
  }, [lat, lon, projectionYear, scenario])

  return { state, snapshot, error }
}
