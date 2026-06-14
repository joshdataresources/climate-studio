import React, { useMemo } from 'react'
import { loadMetroBundle } from '../../utils/metroResolver'
import { getTemperatureStats, getWetBulbStats } from '../../utils/metroChartData'
import { ImpactGrid, ImpactMetric } from '../ui/impact-grid'
import { LocationMultiCityCharts } from './LocationMultiCityCharts'
import type { SspScenario } from '../../utils/scenarioMapping'
import type { LocationSelection } from './LocationSearchBar'
import { cn } from '../../lib/utils'

interface LocationCompareViewProps {
  locations: LocationSelection[]
  scenario: SspScenario
  projectionYear: number
}

interface CompareRow {
  metroName: string
  tempAnomaly: string
  summerAvg: string
  winterAvg: string
  daysOver100: string
  humidity: string
  wetBulb: string
}

export function LocationCompareView({
  locations,
  scenario,
  projectionYear,
}: LocationCompareViewProps) {
  const rows = useMemo<CompareRow[]>(() => {
    return locations.map(loc => {
      const bundle = loadMetroBundle(loc.metroKey)
      const temp = getTemperatureStats(bundle.temperature, scenario, projectionYear, bundle.wetBulb)
      const wetBulb = getWetBulbStats(bundle.wetBulb, projectionYear)

      return {
        metroName: loc.metroName,
        tempAnomaly: temp ? `${temp.tempIncrease > 0 ? '+' : ''}${temp.tempIncrease.toFixed(1)}°F` : '—',
        summerAvg: temp ? `${temp.current.summer_avg.toFixed(1)}°F` : '—',
        winterAvg: temp ? `${temp.current.winter_avg.toFixed(1)}°F` : '—',
        daysOver100: temp ? String(temp.current.days_over_100) : '—',
        humidity: wetBulb ? `${wetBulb.current.peak_humidity ?? 0}%` : '—',
        wetBulb: wetBulb ? String(wetBulb.current.wet_bulb_events ?? 0) : '—',
      }
    })
  }, [locations, scenario, projectionYear])

  return (
    <div className="flex flex-col gap-4">
      <div className="widget-container">
        <h2 className="cs-h2 mb-4">City Comparison</h2>
        <p className="mb-4 text-xs text-[var(--cs-text-tertiary)]">
          Side-by-side metrics at projection year {projectionYear}. Line charts for all cities are
          below — one line per city, no baseline.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-[var(--cs-border-default)] text-left text-xs text-[var(--cs-text-tertiary)]">
                <th className="pb-2 pr-4 font-medium">Metro</th>
                <th className="pb-2 pr-4 font-medium">Temp anomaly</th>
                <th className="pb-2 pr-4 font-medium">Summer avg</th>
                <th className="pb-2 pr-4 font-medium">Winter avg</th>
                <th className="pb-2 pr-4 font-medium">Days &gt;100°F</th>
                <th className="pb-2 pr-4 font-medium">Peak humidity</th>
                <th className="pb-2 font-medium">Wet bulb events</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr
                  key={row.metroName}
                  className="border-b border-[var(--cs-border-muted)] last:border-0"
                >
                  <td className="py-3 pr-4 font-semibold text-[var(--cs-text-primary)]">
                    {row.metroName}
                  </td>
                  <td className="py-3 pr-4 text-[var(--cs-tone-orange-text)]">{row.tempAnomaly}</td>
                  <td className="py-3 pr-4">{row.summerAvg}</td>
                  <td className="py-3 pr-4">{row.winterAvg}</td>
                  <td className="py-3 pr-4 text-[var(--cs-tone-red-text)]">{row.daysOver100}</td>
                  <td className="py-3 pr-4 text-[var(--cs-tone-blue-text)]">{row.humidity}</td>
                  <td className="py-3 text-[var(--cs-tone-violet-text)]">{row.wetBulb}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div
        className={cn(
          'grid gap-4',
          'grid-cols-1 sm:grid-cols-2',
          locations.length >= 4 ? 'lg:grid-cols-4' : 'xl:grid-cols-3'
        )}
      >
        {locations.map(loc => {
          const bundle = loadMetroBundle(loc.metroKey)
          const temp = getTemperatureStats(bundle.temperature, scenario, projectionYear, bundle.wetBulb)
          const wetBulb = getWetBulbStats(bundle.wetBulb, projectionYear)

          return (
            <div key={loc.metroKey} className="widget-container">
              <h4 className="widget-title mb-3">{loc.metroName}</h4>
              <ImpactGrid>
                <ImpactMetric
                  label="Temp Δ"
                  value={temp ? `+${temp.tempIncrease.toFixed(1)}°F` : '—'}
                  tone="orange"
                />
                <ImpactMetric
                  label="Summer"
                  value={temp ? `${temp.current.summer_avg.toFixed(1)}°F` : '—'}
                  tone="orange"
                />
                <ImpactMetric
                  label="Winter"
                  value={temp ? `${temp.current.winter_avg.toFixed(1)}°F` : '—'}
                  tone="blue"
                />
                <ImpactMetric
                  label=">100°F"
                  value={temp ? String(temp.current.days_over_100) : '—'}
                  tone="red"
                />
                {wetBulb && (
                  <>
                    <ImpactMetric
                      label="Humidity"
                      value={`${wetBulb.current.peak_humidity}%`}
                      tone="blue"
                    />
                    <ImpactMetric
                      label="Wet bulb"
                      value={String(wetBulb.current.wet_bulb_events)}
                      tone="violet"
                    />
                  </>
                )}
              </ImpactGrid>
            </div>
          )
        })}
      </div>

      <div className="dashboard-shadow-bleed">
        <LocationMultiCityCharts locations={locations} scenario={scenario} embedded />
      </div>
    </div>
  )
}
