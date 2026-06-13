import React, { useMemo } from 'react'
import { DashboardChart } from './DashboardChart'
import { loadMetroBundle } from '../../utils/metroResolver'
import {
  buildTemperatureTrajectory,
  buildSeasonalTemperatureSeries,
  buildDaysOver100Series,
  buildHumiditySeries,
  buildWetBulbSeries,
  getTemperatureStats,
  getWetBulbStats,
} from '../../utils/metroChartData'
import type { SspScenario } from '../../utils/scenarioMapping'
import { SSP_LABELS } from '../../utils/scenarioMapping'
import type { LocationSelection } from './LocationSearchBar'
import { cn } from '../../lib/utils'

const C = {
  temp: '#ef4444',
  summer: '#f97316',
  winter: '#3b82f6',
  baseline: '#737373',
  humidity: '#06b6d4',
  wetBulb: '#8b5cf6',
  heat: '#eab308',
}

type MetricTone = 'neutral' | 'orange' | 'blue' | 'red' | 'amber'

const METRIC_TONE_BG: Record<MetricTone, string> = {
  neutral: 'rgba(107, 114, 128, 0.1)',
  orange: 'rgba(249, 115, 22, 0.1)',
  blue: 'rgba(59, 130, 246, 0.1)',
  red: 'rgba(239, 68, 68, 0.1)',
  amber: 'rgba(234, 179, 8, 0.1)',
}

const METRIC_TONE_TEXT: Record<MetricTone, string> = {
  neutral: 'var(--cs-text-primary)',
  orange: 'var(--cs-tone-orange-text)',
  blue: 'var(--cs-tone-blue-text)',
  red: 'var(--cs-tone-red-text)',
  amber: 'var(--cs-tone-amber-text)',
}

interface MetricBoxProps {
  label: string
  value: React.ReactNode
  caption?: React.ReactNode
  tone?: MetricTone
}

function MetricBox({ label, value, caption, tone = 'neutral' }: MetricBoxProps) {
  return (
    <div
      className="flex min-h-[72px] flex-col gap-1 rounded-lg p-3"
      style={{ backgroundColor: METRIC_TONE_BG[tone] }}
    >
      <p className="m-0 text-[11px] font-normal text-[var(--cs-text-tertiary)]">{label}</p>
      <p
        className="m-0 text-sm font-semibold leading-tight"
        style={{ color: METRIC_TONE_TEXT[tone] }}
      >
        {value}
      </p>
      {caption && (
        <p className="m-0 text-[10px] text-[var(--cs-text-tertiary)]">{caption}</p>
      )}
    </div>
  )
}

interface LocationCityViewProps {
  location: LocationSelection
  scenario: SspScenario
  projectionYear: number
}

/** Climate Suite–aligned metro widgets (temperature + optional humidity/wet bulb). */
export function LocationCityView({ location, scenario, projectionYear }: LocationCityViewProps) {
  const bundle = useMemo(() => loadMetroBundle(location.metroKey), [location.metroKey])
  const temperature = bundle.temperature

  const tempStats = useMemo(
    () => getTemperatureStats(temperature, scenario, projectionYear, bundle.wetBulb),
    [temperature, scenario, projectionYear, bundle.wetBulb]
  )

  const wetBulbStats = useMemo(
    () => (bundle.wetBulb ? getWetBulbStats(bundle.wetBulb, projectionYear) : null),
    [bundle.wetBulb, projectionYear]
  )

  const annualChart = useMemo(
    () => buildTemperatureTrajectory(temperature, scenario),
    [temperature, scenario]
  )
  const seasonalChart = useMemo(
    () => buildSeasonalTemperatureSeries(temperature, scenario),
    [temperature, scenario]
  )
  const daysOver100Chart = useMemo(
    () => buildDaysOver100Series(temperature, scenario, bundle.wetBulb),
    [temperature, scenario, bundle.wetBulb]
  )
  const humidityChart = useMemo(
    () => (bundle.wetBulb ? buildHumiditySeries(bundle.wetBulb) : []),
    [bundle.wetBulb]
  )
  const wetBulbChart = useMemo(
    () => (bundle.wetBulb ? buildWetBulbSeries(bundle.wetBulb) : []),
    [bundle.wetBulb]
  )

  if (!tempStats || !annualChart.length) {
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
        <div className="mb-4 min-w-0">
          <h2 className="m-0 text-2xl font-semibold tracking-tight text-[var(--cs-text-primary)]">
            {location.metroName}
          </h2>
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

        <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-4')}>
          <MetricBox
            label="Annual avg"
            value={`${tempStats.current.annual_avg.toFixed(1)}°F`}
            caption={`Baseline ${tempStats.baseline.avg_annual.toFixed(1)}°F`}
            tone="neutral"
          />
          <MetricBox
            label="Summer avg"
            value={`${tempStats.current.summer_avg.toFixed(1)}°F`}
            caption={`Baseline ${tempStats.baseline.summer_avg.toFixed(1)}°F`}
            tone="orange"
          />
          <MetricBox
            label="Winter avg"
            value={`${tempStats.current.winter_avg.toFixed(1)}°F`}
            caption={`Baseline ${tempStats.baseline.winter_avg.toFixed(1)}°F`}
            tone="blue"
          />
          <MetricBox
            label="Days &gt;100°F"
            value={String(tempStats.current.days_over_100)}
            caption={
              tempStats.daysOver100Increase > 0
                ? `+${tempStats.daysOver100Increase} vs baseline`
                : `Baseline ${tempStats.baseline.days_over_100}`
            }
            tone="red"
          />
          <MetricBox
            label="Temp anomaly"
            value={`${tempStats.tempIncrease > 0 ? '+' : ''}${tempStats.tempIncrease.toFixed(1)}°F`}
            caption="Annual vs baseline"
            tone="orange"
          />
          <MetricBox
            label="Summer Δ"
            value={`${summerDelta > 0 ? '+' : ''}${summerDelta.toFixed(1)}°F`}
            caption="vs 1995–2014"
            tone="orange"
          />
          <MetricBox
            label="Winter Δ"
            value={`${winterDelta > 0 ? '+' : ''}${winterDelta.toFixed(1)}°F`}
            caption="vs 1995–2014"
            tone="blue"
          />
          <MetricBox
            label="Days &gt;110°F"
            value={String(tempStats.current.days_over_110)}
            caption={`Baseline ${tempStats.baseline.days_over_110}`}
            tone="amber"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DashboardChart
          chartId={`${location.metroKey}-annual`}
          title="Annual Temperature"
          subtitle="Projected annual average vs 1995–2014 baseline"
          data={annualChart}
          series={[
            { key: 'temp', label: 'Projected', color: C.temp },
            { key: 'baseline', label: 'Baseline', color: C.baseline, dashed: true },
          ]}
        />
        <DashboardChart
          chartId={`${location.metroKey}-seasonal`}
          title="Summer & Winter Temperature"
          subtitle="Seasonal averages by decade"
          data={seasonalChart}
          series={[
            { key: 'summer', label: 'Summer', color: C.summer },
            { key: 'winter', label: 'Winter', color: C.winter },
            { key: 'summerBaseline', label: 'Summer baseline', color: C.baseline, dashed: true },
            { key: 'winterBaseline', label: 'Winter baseline', color: C.baseline, dashed: true },
          ]}
        />
        <DashboardChart
          chartId={`${location.metroKey}-days100`}
          title="Days Over 100°F"
          subtitle="Per-city extreme heat days (humidity-adjusted dataset when available)"
          data={daysOver100Chart}
          series={[
            { key: 'daysOver100', label: 'Days >100°F', color: C.heat },
            { key: 'baseline', label: 'Baseline', color: C.baseline, dashed: true },
          ]}
        />
        {wetBulbStats && humidityChart.length > 0 && (
          <DashboardChart
            chartId={`${location.metroKey}-humidity`}
            title="Humidity & Wet Bulb"
            subtitle="Summer humidity and wet bulb events"
            data={humidityChart}
            series={[
              { key: 'humidity', label: 'Summer humidity %', color: C.humidity },
              { key: 'peak', label: 'Peak humidity %', color: C.wetBulb },
            ]}
          />
        )}
        {wetBulbStats && wetBulbChart.length > 0 && (
          <DashboardChart
            chartId={`${location.metroKey}-wetbulb`}
            title="Wet Bulb Events"
            subtitle="Dangerous heat-humidity days vs baseline"
            data={wetBulbChart}
            series={[
              { key: 'events', label: 'Events', color: C.wetBulb },
              { key: 'baseline', label: 'Baseline', color: C.baseline, dashed: true },
            ]}
          />
        )}
      </div>
    </div>
  )
}
