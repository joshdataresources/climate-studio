import React, { useMemo, useEffect } from 'react'
import { DashboardChart } from './DashboardChart'
import { loadMetroBundle } from '../../utils/metroResolver'
import {
  metrosToChartInputs,
  buildMultiCityTemperatureTrajectory,
  buildMultiCitySummerSeries,
  buildMultiCityWinterSeries,
  buildMultiCityDaysOver100Series,
  buildMultiCityWetBulbSeries,
  buildTemperatureTrajectory,
  buildSummerTemperatureSeries,
  buildWinterTemperatureSeries,
  buildDaysOver100Series,
  buildWetBulbSeries,
  PROJECTION_YEARS,
} from '../../utils/metroChartData'
import {
  PRECIP_DROUGHT_SOURCE,
  useDashboardPrecipitationCharts,
} from '../../hooks/useDashboardPrecipitationCharts'
import {
  AQUIFER_SOURCE,
  buildAquiferStorageSeries,
  buildMultiCityAquiferStorageSeries,
  findAquiferAt,
} from '../../utils/metroAquiferData'
import type { SspScenario } from '../../utils/scenarioMapping'
import type { LocationSelection } from './LocationSearchBar'
import { cn } from '../../lib/utils'

const BASELINE_COLOR = '#737373'
const TEMP_COLOR = '#ef4444'
const SUMMER_COLOR = '#f97316'
const WINTER_COLOR = '#3b82f6'
const HEAT_COLOR = '#eab308'
const WET_BULB_COLOR = '#8b5cf6'
const PRECIP_COLOR = '#8b5cf6'
const DROUGHT_COLOR = '#f59e0b'
const AQUIFER_COLOR = '#06b6d4'

interface LocationMultiCityChartsProps {
  locations: LocationSelection[]
  scenario: SspScenario
  className?: string
  /** When true, skip outer bleed wrapper (nested inside compare panel). */
  embedded?: boolean
  /** Single-city mode: dashed baseline lines on projection charts. Defaults to true when one location. */
  showBaselines?: boolean
}

/** Climate charts grid — temperature, wet bulb, precipitation & drought. */
export function LocationMultiCityCharts({
  locations,
  scenario,
  className,
  embedded = false,
  showBaselines,
}: LocationMultiCityChartsProps) {
  const compareMode = locations.length > 1
  const withBaselines = showBaselines ?? !compareMode
  const { charts: eeCharts, trajectories, singleCityBaselines } = useDashboardPrecipitationCharts(
    locations,
    scenario
  )

  const locationsKey = locations.map(l => l.metroKey).join('|')
  // Remove chart key from individual charts to prevent remounting when cities change
  // The key prop on charts was causing React to unmount/remount when cities were added/removed

  // Build chart metros with proper memoization - use locationsKey for proper dependency tracking
  const chartMetros = useMemo(
    () => metrosToChartInputs(locations, loadMetroBundle),
    [locationsKey]
  )

  const cityLabels = locations.map(l => l.metroName).join(' · ')

  const annualChart = useMemo(
    () => buildMultiCityTemperatureTrajectory(chartMetros, scenario),
    [chartMetros, scenario]
  )

  const summerChart = useMemo(
    () => buildMultiCitySummerSeries(chartMetros, scenario),
    [chartMetros, scenario]
  )

  const winterChart = useMemo(
    () => buildMultiCityWinterSeries(chartMetros, scenario),
    [chartMetros, scenario]
  )

  const daysOver100Chart = useMemo(
    () => buildMultiCityDaysOver100Series(chartMetros, scenario),
    [chartMetros, scenario]
  )

  const wetBulbChart = useMemo(
    () => buildMultiCityWetBulbSeries(chartMetros),
    [chartMetros]
  )

  const precipChart = eeCharts.precipitation
  const droughtChart = eeCharts.drought

  const aquiferCompare = useMemo(
    () => buildMultiCityAquiferStorageSeries(locations),
    [locations]
  )

  const singleAquifer = useMemo(() => {
    if (compareMode || locations.length !== 1) return null
    const loc = locations[0]
    const match = findAquiferAt(loc.lat, loc.lon)
    const data = buildAquiferStorageSeries(loc.lat, loc.lon)
    if (!match || !data.length) return null
    return { loc, match, data }
  }, [compareMode, locations])

  const singleCityEeCharts = useMemo(() => {
    if (compareMode || !withBaselines || trajectories.length !== 1) return null
    const { points } = trajectories[0]
    const baselinePrecip = singleCityBaselines?.baselinePrecip
    const baselineDrought = singleCityBaselines?.baselineDrought

    const precip = PROJECTION_YEARS.flatMap(year => {
      const point = points.find(p => p.year === year)
      if (point?.precipitationMm == null || baselinePrecip == null) return []
      return [{ year, precip: point.precipitationMm, baseline: baselinePrecip }]
    })

    const drought = PROJECTION_YEARS.flatMap(year => {
      const point = points.find(p => p.year === year)
      if (point?.droughtIndex == null) return []
      return [
        {
          year,
          droughtIndex: point.droughtIndex,
          ...(baselineDrought != null ? { baseline: baselineDrought } : {}),
        },
      ]
    })

    return { precip, drought }
  }, [compareMode, withBaselines, trajectories, singleCityBaselines])

  const singleCityCharts = useMemo(() => {
    if (compareMode || !withBaselines || chartMetros.length !== 1) return null
    const metro = chartMetros[0]
    const temperature = metro.temperature
    if (!temperature) return null

    return {
      loc: locations[0],
      annual: buildTemperatureTrajectory(temperature, scenario),
      summer: buildSummerTemperatureSeries(temperature, scenario),
      winter: buildWinterTemperatureSeries(temperature, scenario),
      days100: buildDaysOver100Series(temperature, scenario, metro.wetBulb ?? null),
      wetBulb: metro.wetBulb ? buildWetBulbSeries(metro.wetBulb) : [],
      precip: singleCityEeCharts?.precip ?? [],
      drought: singleCityEeCharts?.drought ?? [],
    }
  }, [compareMode, withBaselines, chartMetros, scenario, locations, singleCityEeCharts])

  const hasWetBulbChart = wetBulbChart.series.some(s =>
    wetBulbChart.data.some(row => typeof row[s.key] === 'number')
  )
  const hasPrecipCompare = precipChart.data.length > 0 && precipChart.series.length > 0
  const hasDroughtCompare = droughtChart.data.length > 0 && droughtChart.series.length > 0
  const hasAquiferCompare = aquiferCompare.data.length > 0 && aquiferCompare.series.length > 0

  const compareSubtitle = compareMode
    ? `${locations.length} ${locations.length === 1 ? 'city' : 'cities'}`
    : undefined

  if (
    compareMode &&
    annualChart.data.length === 0 &&
    !hasPrecipCompare &&
    !hasDroughtCompare
  ) {
    return null
  }

  if (!compareMode && withBaselines && singleCityCharts && singleCityCharts.annual.length === 0) {
    return null
  }

  if (singleCityCharts && withBaselines) {
    const { loc, annual, summer, winter, days100, wetBulb, precip, drought } = singleCityCharts

    return (
      <div
        className={cn(
          'grid grid-cols-1 gap-4 lg:grid-cols-2 dashboard-shadow-bleed',
          className
        )}
      >
        {annual.length > 0 && (
          <DashboardChart
            chartId={`${loc.metroKey}-annual`}
            title="Annual Temperature"
            subtitle="Projected annual average vs 1995–2014 baseline"
            yAxisLabel="°F"
            data={annual}
            series={[
              { key: 'temp', label: 'Projected', color: TEMP_COLOR },
              { key: 'baseline', label: 'Baseline', color: BASELINE_COLOR, dashed: true },
            ]}
          />
        )}
        {summer.length > 0 && (
          <DashboardChart
            chartId={`${loc.metroKey}-summer`}
            title="Summer Average"
            subtitle="Seasonal average vs 1995–2014 baseline"
            yAxisLabel="°F"
            data={summer}
            series={[
              { key: 'summer', label: 'Summer', color: SUMMER_COLOR },
              { key: 'baseline', label: 'Baseline', color: BASELINE_COLOR, dashed: true },
            ]}
          />
        )}
        {winter.length > 0 && (
          <DashboardChart
            chartId={`${loc.metroKey}-winter`}
            title="Winter Average"
            subtitle="Seasonal average vs 1995–2014 baseline"
            yAxisLabel="°F"
            data={winter}
            series={[
              { key: 'winter', label: 'Winter', color: WINTER_COLOR },
              { key: 'baseline', label: 'Baseline', color: BASELINE_COLOR, dashed: true },
            ]}
          />
        )}
        {days100.length > 0 && (
          <DashboardChart
            chartId={`${loc.metroKey}-days100`}
            title="Days Over 100°F"
            subtitle="Extreme heat days vs baseline"
            yAxisLabel="days"
            data={days100}
            series={[
              { key: 'daysOver100', label: 'Days >100°F', color: HEAT_COLOR },
              { key: 'baseline', label: 'Baseline', color: BASELINE_COLOR, dashed: true },
            ]}
          />
        )}
        {wetBulb.length > 0 && (
          <DashboardChart
            chartId={`${loc.metroKey}-wetbulb`}
            title="Wet Bulb Events"
            subtitle="Dangerous heat-humidity days vs baseline"
            yAxisLabel="events"
            data={wetBulb}
            series={[
              { key: 'events', label: 'Events', color: WET_BULB_COLOR },
              { key: 'baseline', label: 'Baseline', color: BASELINE_COLOR, dashed: true },
            ]}
          />
        )}
        {precip.length > 0 && (
          <DashboardChart
            chartId={`${loc.metroKey}-precip`}
            title="Precipitation & Drought"
            subtitle="Mean daily precipitation (mm/day)"
            yAxisLabel="mm/day"
            source={PRECIP_DROUGHT_SOURCE}
            data={precip}
            series={[
              { key: 'precip', label: 'Projected', color: PRECIP_COLOR },
              { key: 'baseline', label: 'CHIRPS baseline', color: BASELINE_COLOR, dashed: true },
            ]}
          />
        )}
        {drought.length > 0 && (
          <DashboardChart
            chartId={`${loc.metroKey}-drought`}
            title="Drought Index"
            subtitle="Higher = drier · derived from precipitation"
            yAxisLabel="index (0–10)"
            source={PRECIP_DROUGHT_SOURCE}
            data={drought}
            fitYDomain
            yClamp={[0, 10]}
            series={[
              { key: 'droughtIndex', label: 'Drought index', color: DROUGHT_COLOR },
              ...(drought[0]?.baseline != null
                ? [
                    {
                      key: 'baseline',
                      label: 'Baseline',
                      color: BASELINE_COLOR,
                      dashed: true,
                    },
                  ]
                : []),
            ]}
          />
        )}
        {singleAquifer && (
          <DashboardChart
            chartId={`${loc.metroKey}-aquifer`}
            title="Aquifer Storage"
            subtitle={singleAquifer.match.name}
            yAxisLabel="% of 2025 storage"
            source={AQUIFER_SOURCE}
            data={singleAquifer.data}
            series={[
              { key: 'remainingPct', label: 'Storage remaining', color: AQUIFER_COLOR },
              { key: 'baseline', label: '2025 baseline', color: BASELINE_COLOR, dashed: true },
            ]}
            yDomain={[75, 100]}
          />
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4 lg:grid-cols-2 dashboard-shadow-bleed',
        className
      )}
    >
      {annualChart.series.length > 0 && (
        <DashboardChart
          chartId={`compare-annual`}
          title="Annual Temperature"
          subtitle={compareSubtitle ?? 'Projected annual average vs 1995–2014 baseline'}
          yAxisLabel="°F"
          data={annualChart.data}
          series={annualChart.series}
        />
      )}
      {summerChart.series.length > 0 && (
        <DashboardChart
          chartId={`compare-summer`}
          title="Summer Average"
          subtitle={compareSubtitle ?? 'Seasonal averages by decade'}
          yAxisLabel="°F"
          data={summerChart.data}
          series={summerChart.series}
        />
      )}
      {winterChart.series.length > 0 && (
        <DashboardChart
          chartId={`compare-winter`}
          title="Winter Average"
          subtitle={compareSubtitle ?? 'Seasonal averages by decade'}
          yAxisLabel="°F"
          data={winterChart.data}
          series={winterChart.series}
        />
      )}
      {daysOver100Chart.series.length > 0 && (
        <DashboardChart
          chartId={`compare-days100`}
          title="Days Over 100°F"
          subtitle={compareSubtitle ?? 'Extreme heat days per metro'}
          yAxisLabel="days"
          data={daysOver100Chart.data}
          series={daysOver100Chart.series}
        />
      )}
      {hasWetBulbChart && (
        <DashboardChart
          chartId={`compare-wetbulb`}
          title="Wet Bulb Events"
          subtitle={compareSubtitle ?? 'Dangerous heat-humidity days'}
          yAxisLabel="events"
          data={wetBulbChart.data}
          series={wetBulbChart.series}
        />
      )}
      {compareMode && hasPrecipCompare && (
        <DashboardChart
          chartId={`compare-precip`}
          title="Precipitation & Drought"
          subtitle={compareMode ? 'mm/day' : `${cityLabels} · mm/day`}
          yAxisLabel="mm/day"
          source={PRECIP_DROUGHT_SOURCE}
          data={precipChart.data}
          series={precipChart.series}
        />
      )}
      {compareMode && hasDroughtCompare && (
        <DashboardChart
          chartId={`compare-drought`}
          title="Drought Index"
          subtitle={compareMode ? 'Higher = drier' : `${cityLabels} · higher = drier`}
          yAxisLabel="index (0–10)"
          source={PRECIP_DROUGHT_SOURCE}
          data={droughtChart.data}
          series={droughtChart.series}
          fitYDomain
          yClamp={[0, 10]}
        />
      )}
      {compareMode && hasAquiferCompare && (
        <DashboardChart
          chartId={`compare-aquifer`}
          title="Aquifer Storage"
          subtitle={compareMode ? '% of 2025 volume' : `${cityLabels} · % of 2025 volume at city coordinates`}
          yAxisLabel="% of 2025 storage"
          source={AQUIFER_SOURCE}
          data={aquiferCompare.data}
          series={aquiferCompare.series}
          yDomain={[75, 100]}
        />
      )}
    </div>
  )
}
