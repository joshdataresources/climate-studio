import { useEffect, useMemo, useState } from 'react'
import {
  buildPrecipitationChartsFromTrajectories,
  fetchPrecipitationTrajectory,
} from '../utils/dashboardClimateApi'
import { PROJECTION_YEARS } from '../utils/metroChartData'
import type { LocationSelection } from '../components/dashboard/LocationSearchBar'
import type { SspScenario } from '../utils/scenarioMapping'

const PRECIP_BASELINE_YEAR = 2025

function droughtIndexFromPrecip(precipMm: number): number {
  return Math.round(Math.max(0, Math.min(10, 10 - precipMm)) * 100) / 100
}

/** Real per-decade CMIP6 precipitation at each metro (same source as the map tiles). */
export function useDashboardPrecipitationCharts(
  locations: LocationSelection[],
  scenario: SspScenario
) {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [trajectories, setTrajectories] = useState<
    Array<{
      metroKey: string
      metroName: string
      points: Array<{
        year: number
        precipitationMm: number | null
        droughtIndex: number | null
        soilMoisture: number | null
      }>
    }>
  >([])

  const locationKey = locations.map(l => `${l.metroKey}:${l.lat}:${l.lon}`).join('|')

  useEffect(() => {
    if (!locations.length) {
      setTrajectories([])
      setState('idle')
      return
    }

    const controller = new AbortController()
    setState('loading')
    setError(null)

    // Keep series count in sync while EE fetches — placeholders for new metros
    setTrajectories(prev => {
      const byKey = new Map(prev.map(t => [t.metroKey, t]))
      return locations.map(loc =>
        byKey.get(loc.metroKey) ?? {
          metroKey: loc.metroKey,
          metroName: loc.metroName,
          points: [],
        }
      )
    })

    Promise.all(
      locations.map(async loc => {
        const rows = await fetchPrecipitationTrajectory(
          loc.lat,
          loc.lon,
          scenario,
          controller.signal
        )
        const byYear = new Map(rows.map(r => [r.year, r.precipitationMm]))

        const points = PROJECTION_YEARS.map(year => {
          const precip = byYear.get(year) ?? null
          return {
            year,
            precipitationMm: precip,
            droughtIndex: precip != null ? droughtIndexFromPrecip(precip) : null,
            soilMoisture: null,
          }
        })

        return { metroKey: loc.metroKey, metroName: loc.metroName, points }
      })
    )
      .then(results => {
        if (controller.signal.aborted) return
        setTrajectories(results)
        setState('success')
      })
      .catch(err => {
        if (controller.signal.aborted) return
        setTrajectories([])
        setState('error')
        setError(err instanceof Error ? err.message : 'Earth Engine precipitation request failed')
      })

    return () => controller.abort()
  }, [locationKey, locations, scenario])

  const charts = useMemo(() => {
    const trajectoryByKey = new Map(trajectories.map(t => [t.metroKey, t]))
    const aligned = locations.map(loc =>
      trajectoryByKey.get(loc.metroKey) ?? {
        metroKey: loc.metroKey,
        metroName: loc.metroName,
        points: [],
      }
    )
    return buildPrecipitationChartsFromTrajectories(aligned)
  }, [trajectories, locations])

  const singleCityBaselines = useMemo(() => {
    if (locations.length !== 1 || !trajectories.length) return null
    const points = trajectories[0].points
    const baselinePrecip =
      points.find(p => p.year === PRECIP_BASELINE_YEAR)?.precipitationMm ??
      points[0]?.precipitationMm ??
      null
    const baselineDrought =
      points.find(p => p.year === PRECIP_BASELINE_YEAR)?.droughtIndex ??
      points[0]?.droughtIndex ??
      null
    return { baselinePrecip, baselineDrought }
  }, [locations.length, trajectories])

  return { state, error, charts, trajectories, singleCityBaselines }
}

export const PRECIP_DROUGHT_SOURCE =
  'NASA NEX-GDDP-CMIP6 (pr, single model) · drought index derived from precipitation'
