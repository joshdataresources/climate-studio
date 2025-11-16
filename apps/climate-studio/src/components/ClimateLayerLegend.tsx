import { useClimate } from "@climate-studio/core"

interface LegendItem {
  label: string
  gradient: string
  range: string
}

const LEGEND_CONFIGS: Record<string, LegendItem> = {
  precipitation: {
    label: 'Precipitation',
    gradient: 'linear-gradient(to right, #ffffff, #e3f2fd, #90caf9, #42a5f5, #1e88e5, #1565c0, #0d47a1)',
    range: '0 - 10 mm/day'
  },
  drought_index: {
    label: 'Drought Index',
    gradient: 'linear-gradient(to right, #8b4513, #d2691e, #f4a460, #ffffff, #90ee90, #32cd32, #228b22)',
    range: '-2 (dry) to +2 (wet)'
  },
  soil_moisture: {
    label: 'Soil Moisture',
    gradient: 'linear-gradient(to right, #8b4513, #daa520, #f0e68c, #adff2f, #7cfc00, #32cd32)',
    range: '0 - 10 mm'
  },
  megaregion_growth: {
    label: 'Population Growth Rate',
    gradient: 'linear-gradient(to right, #3b82f6, #0ea5e9, #06b6d4, #10b981, #84cc16, #eab308, #f59e0b, #f97316, #ef4444, #dc2626)',
    range: '-50% (decline) to +150% (boom)'
  }
}

export function ClimateLayerLegend() {
  const { controls, isLayerActive } = useClimate()

  const precipitationActive = isLayerActive('precipitation_drought')
  const megaregionActive = isLayerActive('megaregion_timeseries')

  // Show legend when either precipitation/drought or megaregion layer is active
  if (!precipitationActive && !megaregionActive) {
    return null
  }

  // Determine which legend to show
  const legendConfig = megaregionActive
    ? LEGEND_CONFIGS['megaregion_growth']
    : LEGEND_CONFIGS[controls.droughtMetric]

  return (
    <div className="absolute bottom-8 left-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-3 z-10">
      <div className="text-sm font-semibold text-gray-800 mb-2">
        {legendConfig.label}
      </div>
      <div className="flex flex-col gap-2">
        <div
          className="h-6 w-48 rounded border border-gray-300"
          style={{ background: legendConfig.gradient }}
        />
        <div className="text-xs text-gray-600 text-center">
          {legendConfig.range}
        </div>
      </div>
    </div>
  )
}
