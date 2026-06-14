import React, { useMemo } from 'react'
import { Callout } from '../ui/callout'
import { Spinner } from '../ui/spinner'
import { ImpactGrid, ImpactMetric } from '../ui/impact-grid'
import { LocationMultiCityCharts } from './LocationMultiCityCharts'
import { LocationOutlookPanel } from './LocationOutlookPanel'
import { useDashboardEarthEngine } from '../../hooks/useDashboardEarthEngine'
import { loadMetroBundle } from '../../utils/metroResolver'
import {
  getTemperatureStats,
  getWetBulbStats,
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

/** City-specific outlook: trajectory risk tags + domain drivers (not in Compare tab). */
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

  const wetBulbStats = useMemo(
    () => getWetBulbStats(bundle.wetBulb, projectionYear),
    [bundle.wetBulb, projectionYear]
  )

  const annualHasData = hasTemperatureScenario(temperature, scenario)

  if (!tempStats || !annualHasData) {
    return (
      <div className="widget-container py-12 text-center text-sm text-[var(--cs-text-tertiary)]">
        No temperature projection data for {location.metroName}.
      </div>
    )
  }

  return (
    <div key={location.metroKey} className="flex flex-col gap-4">
      <div className="widget-container flex flex-col gap-4">
        <div className="widget-header !mb-0 !pb-0">
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
            icon={<Spinner className="h-4 w-4 text-white" />}
            title="Loading Earth Engine snapshot…"
            description="Fetching live data for this metro."
          />
        )}
        {eeState === 'error' && (
          <Callout
            status="warning"
            title="Earth Engine unavailable"
            description={
              eeError ??
              'Showing metro projection charts only. Check that the climate backend is running.'
            }
          />
        )}

        <LocationOutlookPanel
          location={location}
          scenario={scenario}
          projectionYear={projectionYear}
        />

        <ImpactGrid className="grid-cols-2 gap-4 sm:grid-cols-4">
          <ImpactMetric
            label="Annual avg"
            value={`${tempStats.current.annual_avg.toFixed(1)}°F`}
            caption={`Baseline ${tempStats.baseline.avg_annual.toFixed(1)}°F`}
            tone="neutral"
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
          {wetBulbStats && (
            <ImpactMetric
              label="Wet bulb events"
              value={String(wetBulbStats.current.wet_bulb_events ?? '—')}
              caption={`Baseline ${wetBulbStats.baseline.wet_bulb_events ?? '—'}`}
              tone="violet"
            />
          )}
          <ImpactMetric
            label="Temp anomaly"
            value={`${tempStats.tempIncrease > 0 ? '+' : ''}${tempStats.tempIncrease.toFixed(1)}°F`}
            caption={`At ${projectionYear}`}
            tone="orange"
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
