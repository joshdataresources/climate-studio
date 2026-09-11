import { useClimate } from "@climate-studio/core"
import { useSidebar } from "../contexts/SidebarContext"

interface LegendItem {
  label: string
  gradient: string
  range: string
}

const LEGEND_CONFIGS: Record<string, LegendItem> = {
  precipitation: {
    label: 'Precipitation',
    gradient: 'linear-gradient(90deg, #F5ED53 0%, #F5F3CE 50%, #6B9AF3 75%, #2357D2 100%)',
    range: '0 - 10 mm/day'
  },
  drought_index: {
    label: 'Precipitation',
    // Matches PALETTE in qgis-processing/services/precipitation_drought.py.
    gradient: 'linear-gradient(to right, #7f2704, #a63603, #d94801, #f16913, #fd8d3c, #fdbe85, #fee8c8, #f7f7f7, #d1e5f0, #92c5de, #4393c3, #2166ac, #053061)',
    range: 'dry to wet, stretched to the visible area'
  },
  megaregion_growth: {
    label: 'Population Growth Rate',
    gradient: 'linear-gradient(to right, #dc2626, #ef4444, #f97316, #eab308, #a855f7, #8b5cf6, #3b82f6, #0ea5e9, #06b6d4, #10b981)',
    range: '-5% (decline) to +10% (growth)'
  }
}

export function ClimateLayerLegend() {
  const { controls, isLayerActive } = useClimate()
  const { isMobile, panelsCollapsed } = useSidebar()

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

  const positionClass = isMobile
    ? 'absolute bottom-4 left-3 right-3 z-10'
    : 'absolute bottom-8 left-4 z-10'

  return (
    <div className={`${positionClass} bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-3`}>
      <div className="text-sm font-semibold text-gray-800 mb-2">
        {legendConfig.label}
      </div>
      <div className="flex flex-col gap-2">
        <div
          className={`h-6 rounded border border-gray-300 ${isMobile ? 'w-full' : 'w-48'}`}
          style={{ background: legendConfig.gradient }}
        />
        <div className="text-xs text-gray-600 text-center">
          {legendConfig.range}
        </div>
      </div>
    </div>
  )
}
