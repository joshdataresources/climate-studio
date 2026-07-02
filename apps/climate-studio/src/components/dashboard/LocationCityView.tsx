import React, { useMemo } from 'react'
import { LocationMultiCityCharts } from './LocationMultiCityCharts'
import { LocationCityMetricsGrid } from './LocationCityMetricsGrid'
import { LocationOutlookPanel } from './LocationOutlookPanel'
import { loadMetroBundle } from '../../utils/metroResolver'
import {
  getTemperatureStats,
  hasTemperatureScenario,
} from '../../utils/metroChartData'
import type { SspScenario } from '../../utils/scenarioMapping'
import { SSP_LABELS } from '../../utils/scenarioMapping'
import type { LocationSelection } from './LocationSearchBar'
import { features } from '../../config/features'

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
  const showExtendedCards = features.cityDashboardCards

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

        {showExtendedCards && (
          <LocationOutlookPanel
            location={location}
            scenario={scenario}
            projectionYear={projectionYear}
          />
        )}

        <LocationCityMetricsGrid stats={tempStats} projectionYear={projectionYear} />
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
