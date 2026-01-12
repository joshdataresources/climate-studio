import React, { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useClimate } from "@climate-studio/core"
import { MetroTooltipBubble } from './MetroTooltipBubble'
import { useTheme } from '../contexts/ThemeContext'

interface MetroTemperaturePopupProps {
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

export function MetroTemperaturePopup({ metroName, visible, onClose }: MetroTemperaturePopupProps) {
  const { controls } = useClimate()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [data, setData] = useState<TemperatureData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showChart, setShowChart] = useState(false)

  // Get current year from slider (default 2050)
  const currentYear = controls.projectionYear || 2050

  // Determine scenario from map state (default ssp585)
  const scenario = controls.projectionScenario || 'ssp585'

  useEffect(() => {
    if (!visible) return

    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/climate/metro-temperature/${metroName}?scenario=${scenario}`)
        const result = await response.json()

        if (result.success) {
          setData(result.data)
        }
      } catch (error) {
        console.error('Failed to load temperature data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [metroName, scenario, visible])

  if (!visible) return null

  if (loading) {
    return (
      <div className="absolute top-4 right-4 bg-white dark:bg-gray-900 rounded-lg shadow-xl p-6 w-96 z-50">
        <div className="text-center text-gray-500">Loading temperature data...</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="absolute top-4 right-4 bg-white dark:bg-gray-900 rounded-lg shadow-xl p-6 w-96 z-50">
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-400 hover:text-gray-600">
          ✕
        </button>
        <div className="text-center text-red-500">Failed to load data</div>
      </div>
    )
  }

  // Find closest decade to current year
  const decades = Object.keys(data.projections[scenario]).map(Number).sort((a, b) => a - b)
  const closestDecade = decades.reduce((prev, curr) =>
    Math.abs(curr - currentYear) < Math.abs(prev - currentYear) ? curr : prev
  )

  const currentData = data.projections[scenario][closestDecade]
  const baseline = data.baseline_1995_2014

  const tempIncrease = currentData.annual_avg - baseline.avg_annual
  const daysOver100Increase = currentData.days_over_100 - baseline.days_over_100
  const daysOver110Increase = currentData.days_over_110 - baseline.days_over_110

  // Prepare chart data
  const chartData = decades.map(year => ({
    year,
    temp: data.projections[scenario][year].annual_avg,
    baseline: baseline.avg_annual
  }))

  const summerTempChange = ((currentData.summer_avg - baseline.summer_avg) / baseline.summer_avg * 100).toFixed(0)
  const winterTempChange = ((currentData.winter_avg - baseline.winter_avg) / baseline.winter_avg * 100).toFixed(0)

  return (
    <>
      <MetroTooltipBubble
        metroName={metroName}
        populationChange="(+25%)"
        summerTemp={`${currentData.summer_avg.toFixed(0)}°`}
        summerTempChange={`(+${summerTempChange}%)`}
        winterTemp={`${currentData.winter_avg.toFixed(0)}°`}
        winterTempChange={`(+${winterTempChange}%)`}
        visible={visible}
        onClose={onClose}
        onHover={() => setShowChart(true)}
        onHoverEnd={() => setShowChart(false)}
      />

      {/* Extended info on hover */}
      {showChart && (
        <div style={{
          position: 'absolute',
          top: '100%',
          marginTop: '8px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '420px',
          zIndex: 200
        }}>
          <div className={`backdrop-blur-[2px] rounded-[8px] p-3 shadow-xl ${
            isDark ? 'bg-[rgb(16,23,40)]/50' : 'bg-white/50'
          }`}>
          {/* Additional Stats */}
          <div className="space-y-2 mb-3">
            <div className={`text-xs font-semibold mb-2 ${
              isDark ? 'text-white' : 'text-[#101728]'
            }`}>
              Detailed Statistics ({closestDecade}s - {scenario.toUpperCase()})
            </div>

            {/* Annual Temperature */}
            <div className="flex justify-between items-center">
              <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-[#697487]'}`}>
                Annual Avg Temp
              </span>
              <div className="text-right">
                <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-[#101728]'}`}>
                  {currentData.annual_avg.toFixed(1)}°F
                </span>
                <span className={`text-[10px] ml-1 ${isDark ? 'text-gray-400' : 'text-[#697487]'}`}>
                  (+{tempIncrease.toFixed(1)}°F)
                </span>
              </div>
            </div>

            {/* Days over 100°F */}
            <div className={`flex justify-between items-center pt-1 border-t ${
              isDark ? 'border-gray-600/30' : 'border-white/30'
            }`}>
              <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-[#697487]'}`}>
                Days over 100°F
              </span>
              <div className="text-right">
                <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-[#101728]'}`}>
                  {currentData.days_over_100} days
                </span>
                {daysOver100Increase > 0 && (
                  <span className="text-[10px] text-red-500 ml-1">
                    +{daysOver100Increase}
                  </span>
                )}
              </div>
            </div>

            {/* Days over 110°F */}
            {currentData.days_over_110 > 0 && (
              <div className="flex justify-between items-center">
                <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-[#697487]'}`}>
                  Days over 110°F
                </span>
                <div className="text-right">
                  <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-[#101728]'}`}>
                    {currentData.days_over_110} days
                  </span>
                  {daysOver110Increase > 0 && (
                    <span className="text-[10px] text-red-600 ml-1">
                      +{daysOver110Increase}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Chart */}
          <div className={`pt-2 border-t ${isDark ? 'border-gray-600/30' : 'border-white/30'}`}>
            <div className={`text-[10px] mb-2 text-center ${
              isDark ? 'text-gray-400' : 'text-[#697487]'
            }`}>
              Temperature Trend
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={chartData}>
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
                  labelStyle={{ color: isDark ? '#ffffff' : '#101728' }}
                />
                <Line
                  type="monotone"
                  dataKey="baseline"
                  stroke={isDark ? '#9ca3af' : '#697487'}
                  strokeDasharray="3 3"
                  strokeWidth={1}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="temp"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#ef4444' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Warning for extreme cases */}
          {currentData.days_over_110 > 60 && (
            <div className={`mt-3 pt-2 border-t ${isDark ? 'border-gray-600/30' : 'border-white/30'}`}>
              <div className={`backdrop-blur-sm border rounded-md p-2 ${
                isDark
                  ? 'bg-red-900/30 border-red-700/50'
                  : 'bg-red-50/80 border-red-200/50'
              }`}>
                <p className={`text-[10px] font-semibold ${
                  isDark ? 'text-red-300' : 'text-red-800'
                }`}>
                  ⚠️ Extreme Heat Warning
                </p>
                <p className={`text-[10px] mt-1 ${
                  isDark ? 'text-red-400' : 'text-red-600'
                }`}>
                  {currentData.days_over_110} days over 110°F makes outdoor work dangerous
                </p>
              </div>
            </div>
          )}

          {/* Baseline comparison */}
          <div className={`mt-2 pt-2 border-t ${isDark ? 'border-gray-600/30' : 'border-white/30'}`}>
            <div className={`text-[10px] text-center ${
              isDark ? 'text-gray-400' : 'text-[#697487]'
            }`}>
              Baseline (1995-2014): {baseline.avg_annual.toFixed(1)}°F annual avg • {baseline.days_over_100} days over 100°F
            </div>
          </div>
          </div>
        </div>
      )}
    </>
  )
}
