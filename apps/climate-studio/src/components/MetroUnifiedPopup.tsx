import React, { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useClimate } from "@climate-studio/core"
import { useTheme } from '../contexts/ThemeContext'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface MetroUnifiedPopupProps {
  metroName: string
  visible: boolean
  onClose: () => void
}

interface TemperatureData {
  name: string
  baseline_1995_2014: {
    avg_annual: number
    summer_avg: number
    winter_avg: number
    days_over_100: number
    days_over_110: number
  }
  projections: {
    [scenario: string]: {
      [year: string]: {
        annual_avg: number
        summer_avg: number
        winter_avg: number
        days_over_100: number
        days_over_110: number
      }
    }
  }
}

interface WetBulbData {
  name: string
  lat: number
  lon: number
  population_2024: number
  metro_population_2024: number
  baseline_humidity: number
  baseline_1995_2014: {
    avg_summer_humidity: number
    wet_bulb_events: number
    days_over_95F: number
  }
  projections: {
    [year: string]: {
      avg_summer_humidity: number
      peak_humidity: number
      wet_bulb_events: number
      days_over_95F: number
      days_over_100F: number
      estimated_at_risk_population: number
      casualty_rate_percent: number
      extent_radius_km: number
    }
  }
}

interface PopulationData {
  name: string
  lat: number
  lon: number
  climate_risk: string
  region: string
  megaregion: string
  populations: {
    [year: string]: number
  }
}

export function MetroUnifiedPopup({ metroName, visible, onClose }: MetroUnifiedPopupProps) {
  const { controls } = useClimate()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  // Section toggle states (all enabled by default)
  const [showHumidityWetBulb, setShowHumidityWetBulb] = useState(true)
  const [showPopulation, setShowPopulation] = useState(true)
  const [showTemperature, setShowTemperature] = useState(true)

  // Expanded/collapsed states for each section
  const [humidityExpanded, setHumidityExpanded] = useState(true)
  const [populationExpanded, setPopulationExpanded] = useState(true)
  const [temperatureExpanded, setTemperatureExpanded] = useState(true)

  // Data states
  const [temperatureData, setTemperatureData] = useState<TemperatureData | null>(null)
  const [wetBulbData, setWetBulbData] = useState<WetBulbData | null>(null)
  const [populationData, setPopulationData] = useState<PopulationData | null>(null)
  const [loading, setLoading] = useState(true)

  // Get current year from slider (default 2050)
  const currentYear = controls.projectionYear || 2050

  // Determine scenario from map state (default ssp585)
  const scenario = controls.projectionScenario || 'ssp585'

  useEffect(() => {
    if (!visible) return

    const fetchData = async () => {
      try {
        setLoading(true)

        // Load all three data sources
        const [tempResponse, wetBulbResponse, popResponse] = await Promise.all([
          fetch('/data/metro_temperature_projections.json'),
          fetch('/data/expanded_wet_bulb_projections.json'),
          fetch('/data/megaregion-data.json')
        ])

        const tempJson = await tempResponse.json()
        const wetBulbJson = await wetBulbResponse.json()
        const popJson = await popResponse.json()

        // Find matching city data (handle name variations)
        const normalizedMetroName = metroName.trim().toLowerCase()

        // Temperature data
        const tempCity = Object.values(tempJson).find((city: any) =>
          city.name.toLowerCase().includes(normalizedMetroName) ||
          normalizedMetroName.includes(city.name.toLowerCase())
        )
        setTemperatureData(tempCity as TemperatureData || null)

        // Wet bulb data
        const wetBulbCity = Object.values(wetBulbJson).find((city: any) =>
          city.name.toLowerCase().includes(normalizedMetroName) ||
          normalizedMetroName.includes(city.name.toLowerCase())
        )
        setWetBulbData(wetBulbCity as WetBulbData || null)

        // Population data
        const popCity = popJson.metros?.find((city: any) =>
          city.name.toLowerCase().includes(normalizedMetroName) ||
          normalizedMetroName.includes(city.name.toLowerCase())
        )
        setPopulationData(popCity as PopulationData || null)

      } catch (error) {
        console.error('Failed to load metro data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [metroName, visible])

  // Force re-render when projection year or scenario changes
  // This ensures the calculated stats (temperature, population, wet bulb) update
  // even though the raw data doesn't need to be re-fetched
  useEffect(() => {
    // This effect intentionally does nothing except trigger a re-render
    // when currentYear or scenario changes, which causes the stats functions
    // (getTemperatureStats, getPopulationStats, getWetBulbStats) to recalculate
  }, [currentYear, scenario])

  if (!visible) return null

  if (loading) {
    return (
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-900 rounded-lg shadow-xl p-6 w-[480px] z-50">
        <div className="text-center text-gray-500">Loading metro data...</div>
      </div>
    )
  }

  // Helper to find closest year in projections
  const findClosestYear = (availableYears: number[], targetYear: number) => {
    return availableYears.reduce((prev, curr) =>
      Math.abs(curr - targetYear) < Math.abs(prev - targetYear) ? curr : prev
    )
  }

  // Calculate population change if data available
  const getPopulationStats = () => {
    if (!populationData?.populations) return null

    const years = Object.keys(populationData.populations).map(Number).sort((a, b) => a - b)
    const closestYear = findClosestYear(years, currentYear)
    const baselineYear = 2025

    const currentPop = populationData.populations[closestYear]
    const baselinePop = populationData.populations[baselineYear]

    const change = ((currentPop - baselinePop) / baselinePop) * 100

    return {
      current: currentPop,
      baseline: baselinePop,
      change: change,
      year: closestYear
    }
  }

  // Calculate temperature stats if data available
  const getTemperatureStats = () => {
    if (!temperatureData?.projections?.[scenario]) return null

    const decades = Object.keys(temperatureData.projections[scenario]).map(Number).sort((a, b) => a - b)
    const closestDecade = findClosestYear(decades, currentYear)

    const currentData = temperatureData.projections[scenario][closestDecade]
    const baseline = temperatureData.baseline_1995_2014

    return {
      current: currentData,
      baseline: baseline,
      decade: closestDecade,
      tempIncrease: currentData.annual_avg - baseline.avg_annual,
      daysOver100Increase: currentData.days_over_100 - baseline.days_over_100
    }
  }

  // Calculate wet bulb stats if data available
  const getWetBulbStats = () => {
    if (!wetBulbData?.projections) return null

    const years = Object.keys(wetBulbData.projections).map(Number).sort((a, b) => a - b)
    const closestYear = findClosestYear(years, currentYear)

    const currentData = wetBulbData.projections[closestYear]
    const baseline = wetBulbData.baseline_1995_2014

    return {
      current: currentData,
      baseline: baseline,
      year: closestYear
    }
  }

  const popStats = getPopulationStats()
  const tempStats = getTemperatureStats()
  const wetBulbStats = getWetBulbStats()

  // Prepare chart data for temperature section
  const temperatureChartData = tempStats ?
    Object.keys(temperatureData!.projections[scenario]).map(Number).sort((a, b) => a - b).map(year => ({
      year,
      temp: temperatureData!.projections[scenario][year].annual_avg,
      baseline: temperatureData!.baseline_1995_2014.avg_annual
    })) : []

  return (
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-900 rounded-lg shadow-xl w-[520px] z-50 max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-4 rounded-t-lg z-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{metroName}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Year: {currentYear} | Scenario: {scenario.toUpperCase()}
        </div>

        {/* Toggle Controls */}
        <div className="flex gap-3 mt-3 flex-wrap">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={showHumidityWetBulb}
              onChange={(e) => setShowHumidityWetBulb(e.target.checked)}
              className="rounded"
            />
            <span className="text-gray-700 dark:text-gray-300">Humidity & Wet Bulb</span>
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={showPopulation}
              onChange={(e) => setShowPopulation(e.target.checked)}
              className="rounded"
            />
            <span className="text-gray-700 dark:text-gray-300">Population</span>
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={showTemperature}
              onChange={(e) => setShowTemperature(e.target.checked)}
              className="rounded"
            />
            <span className="text-gray-700 dark:text-gray-300">Temperature</span>
          </label>
        </div>
      </div>

      {/* Content Sections */}
      <div className="p-4 space-y-3">
        {/* Section 1: Humidity & Wet Bulb Events */}
        {showHumidityWetBulb && wetBulbStats && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setHumidityExpanded(!humidityExpanded)}
              className="w-full flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
            >
              <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-200">
                Humidity & Wet Bulb Events
              </h3>
              {humidityExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {humidityExpanded && (
              <div className="p-3 space-y-2 bg-white dark:bg-gray-800">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Peak Humidity</div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white">
                      {wetBulbStats.current.peak_humidity}%
                    </div>
                    <div className="text-xs text-gray-500">
                      Baseline: {wetBulbStats.baseline.avg_summer_humidity}%
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Wet Bulb Events</div>
                    <div className="text-lg font-bold text-red-600 dark:text-red-400">
                      {wetBulbStats.current.wet_bulb_events}
                    </div>
                    <div className="text-xs text-gray-500">
                      Baseline: {wetBulbStats.baseline.wet_bulb_events}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Days over 100°F</div>
                    <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                      {wetBulbStats.current.days_over_100F || 0}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">At-Risk Population</div>
                    <div className="text-sm font-bold text-gray-900 dark:text-white">
                      {(wetBulbStats.current.estimated_at_risk_population || 0).toLocaleString()}
                    </div>
                  </div>
                </div>

                {wetBulbStats.current.wet_bulb_events > 30 && (
                  <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                    <p className="text-xs font-semibold text-red-800 dark:text-red-300">
                      High Risk Warning
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                      {wetBulbStats.current.wet_bulb_events} wet bulb events pose severe health risks
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Section 2: Population Change */}
        {showPopulation && popStats && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setPopulationExpanded(!populationExpanded)}
              className="w-full flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
            >
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                Population Change
              </h3>
              {populationExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {populationExpanded && (
              <div className="p-3 space-y-2 bg-white dark:bg-gray-800">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Projected ({popStats.year})</div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white">
                      {(popStats.current / 1000000).toFixed(2)}M
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Change from 2024</div>
                    <div className={`text-lg font-bold ${popStats.change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {popStats.change >= 0 ? '+' : ''}{popStats.change.toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400">2024 Baseline</div>
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {(popStats.baseline / 1000000).toFixed(2)}M people
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Section 3: Average Temperature Change */}
        {showTemperature && tempStats && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setTemperatureExpanded(!temperatureExpanded)}
              className="w-full flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            >
              <h3 className="text-sm font-semibold text-red-900 dark:text-red-200">
                Average Temperature Change
              </h3>
              {temperatureExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {temperatureExpanded && (
              <div className="p-3 space-y-2 bg-white dark:bg-gray-800">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Annual Avg ({tempStats.decade}s)</div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white">
                      {tempStats.current.annual_avg.toFixed(1)}°F
                    </div>
                    <div className="text-xs text-red-600 dark:text-red-400">
                      +{tempStats.tempIncrease.toFixed(1)}°F from baseline
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Days over 100°F</div>
                    <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                      {tempStats.current.days_over_100} days
                    </div>
                    {tempStats.daysOver100Increase > 0 && (
                      <div className="text-xs text-red-600 dark:text-red-400">
                        +{tempStats.daysOver100Increase} days
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Summer Avg</div>
                    <div className="text-sm font-bold text-gray-900 dark:text-white">
                      {tempStats.current.summer_avg.toFixed(1)}°F
                    </div>
                    <div className="text-xs text-gray-500">
                      Baseline: {tempStats.baseline.summer_avg.toFixed(1)}°F
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Winter Avg</div>
                    <div className="text-sm font-bold text-gray-900 dark:text-white">
                      {tempStats.current.winter_avg.toFixed(1)}°F
                    </div>
                    <div className="text-xs text-gray-500">
                      Baseline: {tempStats.baseline.winter_avg.toFixed(1)}°F
                    </div>
                  </div>
                </div>

                {/* Temperature Trend Chart */}
                {temperatureChartData.length > 0 && (
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 text-center">
                      Temperature Trend
                    </div>
                    <ResponsiveContainer width="100%" height={140}>
                      <LineChart data={temperatureChartData}>
                        <XAxis
                          dataKey="year"
                          tick={{ fontSize: 10, fill: isDark ? '#9ca3af' : '#697487' }}
                          stroke={isDark ? '#9ca3af' : '#697487'}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: isDark ? '#9ca3af' : '#697487' }}
                          stroke={isDark ? '#9ca3af' : '#697487'}
                          domain={['dataMin - 2', 'dataMax + 2']}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: isDark ? 'rgba(16,23,40,0.95)' : 'rgba(255,255,255,0.95)',
                            backdropFilter: 'blur(2px)',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '12px',
                            color: isDark ? '#ffffff' : '#101728'
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="baseline"
                          stroke={isDark ? '#9ca3af' : '#697487'}
                          strokeDasharray="3 3"
                          strokeWidth={1}
                          dot={false}
                          name="Baseline"
                        />
                        <Line
                          type="monotone"
                          dataKey="temp"
                          stroke="#ef4444"
                          strokeWidth={2}
                          dot={{ r: 3, fill: '#ef4444' }}
                          name="Projected"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {tempStats.current.days_over_110 > 60 && (
                  <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                    <p className="text-xs font-semibold text-red-800 dark:text-red-300">
                      Extreme Heat Warning
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                      {tempStats.current.days_over_110} days over 110°F makes outdoor work dangerous
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* No Data Available Message */}
        {!wetBulbStats && !popStats && !tempStats && (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <p>No projection data available for {metroName}</p>
            <p className="text-xs mt-2">Try selecting a major metropolitan area</p>
          </div>
        )}
      </div>
    </div>
  )
}
