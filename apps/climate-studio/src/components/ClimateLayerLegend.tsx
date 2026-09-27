import { useClimate } from "@climate-studio/core"
import { useSidebar } from "../contexts/SidebarContext"
import { PRECIPITATION_GRADIENT_CSS } from '../utils/precipitationTiles'

interface LegendItem {
  label: string
  gradient: string
  range: string
}

const LEGEND_CONFIGS: Record<string, LegendItem> = {
  precipitation: {
    label: 'Precipitation',
    // Same ramp as the tiles. Both metrics are drawn with it, and the service
    // stretches it to the visible area rather than a fixed 0-10 mm/day.
    gradient: PRECIPITATION_GRADIENT_CSS,
    range: 'dry to wet, stretched to the visible area'
  },
  drought_index: {
    label: 'Precipitation',
    // The map tiles are recoloured to this same ramp (utils/precipitationTiles.ts).
    gradient: PRECIPITATION_GRADIENT_CSS,
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
