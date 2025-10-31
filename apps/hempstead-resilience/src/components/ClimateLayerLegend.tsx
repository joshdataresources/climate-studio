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
  }
}

export function ClimateLayerLegend() {
  const { controls, isLayerActive } = useClimate()

  // Only show legend when precipitation/drought layer is active
  if (!isLayerActive('precipitation_drought')) {
    return null
  }

  const legendConfig = LEGEND_CONFIGS[controls.droughtMetric]

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
