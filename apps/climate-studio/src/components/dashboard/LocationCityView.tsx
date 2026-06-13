import React, { useMemo } from 'react'
import { Callout } from '../ui/callout'
import { Spinner } from '../ui/spinner'
import { ImpactGrid, ImpactMetric } from '../ui/impact-grid'
import { LocationMultiCityCharts } from './LocationMultiCityCharts'
import { useDashboardEarthEngine } from '../../hooks/useDashboardEarthEngine'
import { loadMetroBundle } from '../../utils/metroResolver'
import {
  getTemperatureStats,
  hasTemperatureScenario,
} from '../../utils/metroChartData'
import type { SspScenario } from '../../utils/scenarioMapping'
import { SSP_LABELS } from '../../utils/scenarioMapping'
import type { LocationSelection } from './LocationSearchBar'

interface LocationCityViewProps {
  location: LocationSelection
  scenario: SspScenario
  projectionYear: number
}

/** Climate Suite–aligned metro widgets (temperature + optional humidity/wet bulb). */
export function LocationCityView({
  location,
  scenario,
  projectionYear,
}: LocationCityViewProps) {
  const { state: eeState, error: eeError } = useDashboardEarthEngine(
    location.lat,
    location.lon,
    projectionYear,
    scenario
  )

  const bundle = useMemo(() => loadMetroBundle(location.metroKey), [location.metroKey])
  const temperature = bundle.temperature

  const tempStats = useMemo(
    () => getTemperatureStats(temperature, scenario, projectionYear, bundle.wetBulb),
    [temperature, scenario, projectionYear, bundle.wetBulb]
  )

  const annualHasData = hasTemperatureScenario(temperature, scenario)

  if (!tempStats || !annualHasData) {
    return (
      <div className="widget-container py-12 text-center text-sm text-[var(--cs-text-tertiary)]">
        No temperature projection data for {location.metroName}.
      </div>
    )
  }

  const summerDelta = tempStats.current.summer_avg - tempStats.baseline.summer_avg
  const winterDelta = tempStats.current.winter_avg - tempStats.baseline.winter_avg

  return (
    <div key={location.metroKey} className="dashboard-shadow-bleed flex flex-col gap-4">
      <div className="widget-container">
        <div className="widget-header !mb-4 !pb-4">
          <div className="min-w-0">
            <h2 className="cs-h2">{location.metroName}</h2>
            {location.searchLabel && location.searchLabel !== location.metroName && (
              <p className="mt-1 text-xs text-[var(--cs-text-tertiary)]">
                Nearest metro
                {location.distanceKm ? ` · ${location.distanceKm} km` : ''}
              </p>
            )}
            <p className="mt-0.5 text-xs text-[var(--cs-text-secondary)]">
              {SSP_LABELS[scenario]} · {projectionYear} · baseline 1995–2014
            </p>
          </div>
        </div>

        {eeState === 'loading' && (
          <Callout
            status="info"
            className="mb-4"
            icon={<Spinner className="h-4 w-4 text-white" />}
            title="Loading Earth Engine snapshot…"
            description="Fetching live data for this metro."
          />
        )}
        {eeState === 'error' && (
          <Callout
            status="warning"
            className="mb-4"
            title="Earth Engine unavailable"
            description={
              eeError ??
              'Showing metro projection charts only. Check that the climate backend is running.'
            }
          />
        )}

        <ImpactGrid className="grid-cols-2 gap-3 sm:grid-cols-4">
          <ImpactMetric
            label="Annual avg"
            value={`${tempStats.current.annual_avg.toFixed(1)}°F`}
            caption={`Baseline ${tempStats.baseline.avg_annual.toFixed(1)}°F`}
            tone="neutral"
          />
          <ImpactMetric
            label="Summer avg"
            value={`${tempStats.current.summer_avg.toFixed(1)}°F`}
            caption={`Baseline ${tempStats.baseline.summer_avg.toFixed(1)}°F`}
            tone="orange"
          />
          <ImpactMetric
            label="Winter avg"
            value={`${tempStats.current.winter_avg.toFixed(1)}°F`}
            caption={`Baseline ${tempStats.baseline.winter_avg.toFixed(1)}°F`}
            tone="blue"
          />
          <ImpactMetric
            label="Days &gt;100°F"
            value={String(tempStats.current.days_over_100)}
            caption={
              tempStats.daysOver100Increase > 0
                ? `+${tempStats.daysOver100Increase} vs baseline`
                : `Baseline ${tempStats.baseline.days_over_100}`
            }
            tone="red"
          />
          <ImpactMetric
            label="Temp anomaly"
            value={`${tempStats.tempIncrease > 0 ? '+' : ''}${tempStats.tempIncrease.toFixed(1)}°F`}
            caption="Annual vs baseline"
            tone="orange"
          />
          <ImpactMetric
            label="Summer Δ"
            value={`${summerDelta > 0 ? '+' : ''}${summerDelta.toFixed(1)}°F`}
            caption="vs 1995–2014"
            tone="orange"
          />
          <ImpactMetric
            label="Winter Δ"
            value={`${winterDelta > 0 ? '+' : ''}${winterDelta.toFixed(1)}°F`}
            caption="vs 1995–2014"
            tone="blue"
          />
          <ImpactMetric
            label="Days &gt;110°F"
            value={String(tempStats.current.days_over_110)}
            caption={`Baseline ${tempStats.baseline.days_over_110}`}
            tone="amber"
          />
        </ImpactGrid>
      </div>

      <LocationMultiCityCharts
        locations={[location]}
        scenario={scenario}
        showBaselines
        embedded
      />
    </div>
  )
}
