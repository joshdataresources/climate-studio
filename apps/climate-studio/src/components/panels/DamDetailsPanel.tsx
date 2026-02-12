// Dam Details Panel - Compact detail card matching Figma design
import { X, AlertTriangle, MapPin, Droplets, Thermometer } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

export interface SelectedDam {
  id: string
  name: string
  state: string
  reservoir: string
  river: string
  year_completed: number
  height_ft: number
  storage_acre_ft: number
  capacity_mw: number
  serves: string
  downstream_impact: string
  impact_description: string
  connected_infrastructure: string
  dam_type: string
}

interface DamDetailsPanelProps {
  selectedDam: SelectedDam | null
  onClose: () => void
}

function formatStorage(acres: number): string {
  if (acres >= 1e6) return `${(acres / 1e6).toFixed(1)}M acre-ft`
  if (acres >= 1e3) return `${(acres / 1e3).toFixed(0)}K acre-ft`
  return `${acres.toLocaleString()} acre-ft`
}

// Impact severity → badge color + label
function getImpactInfo(impact: string): { label: string; color: string; bgTint: string } {
  switch (impact) {
    case 'extreme':
      return { label: 'Critical Impact', color: '#ff3636', bgTint: 'rgba(255, 57, 57, 0.1)' }
    case 'severe':
      return { label: 'High Impact', color: '#ff3636', bgTint: 'rgba(255, 57, 57, 0.1)' }
    case 'moderate':
      return { label: 'Moderate Impact', color: '#e97b35', bgTint: 'rgba(233, 123, 53, 0.1)' }
    default:
      return { label: 'Low Impact', color: '#22c55e', bgTint: 'rgba(34, 197, 94, 0.1)' }
  }
}

export function DamDetailsPanel({ selectedDam, onClose }: DamDetailsPanelProps) {
  if (!selectedDam) return null

  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const impact = getImpactInfo(selectedDam.downstream_impact)

  return (
    <div className="widget-container">
      {/* Header - Name as title, river + state as subtitle */}
      <div className="flex items-start justify-between pb-3">
        <div className="flex-1">
          <h2 className="text-[15px] font-bold mb-1" style={{ color: isDark ? '#fff' : '#000' }}>
            {selectedDam.name}
          </h2>
          <div className="flex items-center gap-3 text-xs" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
            <span className="inline-flex items-center gap-1">
              <Droplets size={14} />
              {selectedDam.river}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin size={14} />
              {selectedDam.state}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="ml-4 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
          style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Content - Two Column Layout */}
      <div className="flex gap-4">
        {/* LEFT COLUMN - Impact & Stats */}
        <div className="flex-1 flex flex-col gap-3">
          {/* Impact Badge - solid color */}
          <div
            className="flex items-center justify-center gap-3 px-3 py-2 rounded-lg w-full"
            style={{
              backgroundColor: impact.color,
              boxShadow: '0px 0px 8px 0px rgba(0,0,0,0.03)'
            }}
          >
            <AlertTriangle size={16} style={{ color: '#fff', height: '13.818px', width: '16px' }} />
            <span className="text-xs font-semibold text-white">
              {impact.label}
            </span>
          </div>

          {/* Downstream Impact Box */}
          <div
            className="p-3 rounded-lg w-full"
            style={{ backgroundColor: impact.bgTint }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Thermometer size={20} style={{ color: impact.color }} />
              <span className="text-xs font-semibold" style={{ color: impact.color }}>
                Downstream Impact
              </span>
            </div>

            <p className="m-0 text-xs leading-relaxed" style={{ color: isDark ? '#9ca3af' : '#697487' }}>
              {selectedDam.impact_description}
            </p>

            {/* Divider + Serves */}
            {selectedDam.serves && (
              <>
                <div className="h-px w-full my-2" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
                <div className="flex flex-col gap-1">
                  <p className="m-0 text-[11px]" style={{ color: isDark ? '#9ca3af' : '#697487' }}>
                    Serves
                  </p>
                  <p className="m-0 text-xs" style={{ color: isDark ? '#e5e7eb' : '#000' }}>
                    {selectedDam.serves}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Water + Storage boxes */}
          <div className="flex gap-3">
            <div
              className="flex-1 p-3 rounded-lg"
              style={{ backgroundColor: 'rgba(16, 132, 254, 0.1)' }}
            >
              <div className="text-[11px] mb-1" style={{ color: isDark ? '#9ca3af' : '#697487' }}>
                Water
              </div>
              <div className="text-xs font-semibold" style={{ color: '#1084fe' }}>
                {formatStorage(selectedDam.storage_acre_ft)}
              </div>
            </div>
            <div
              className="flex-1 p-3 rounded-lg"
              style={{ backgroundColor: 'rgba(227, 197, 2, 0.1)' }}
            >
              <div className="text-[11px] mb-1" style={{ color: isDark ? '#9ca3af' : '#697487' }}>
                Storage
              </div>
              <div className="text-xs font-semibold" style={{ color: '#e3c502' }}>
                {selectedDam.capacity_mw > 0 ? `${selectedDam.capacity_mw.toLocaleString()} MW` : 'No generation'}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN - Supporting Info */}
        <div className="flex-1 flex flex-col gap-3 self-stretch">
          {/* Row 1: Year Built + Height */}
          <div className="flex flex-1 gap-3 items-center w-full">
            <div
              className="flex-1 flex gap-3 h-full items-start p-3 border-t border-solid"
              style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
            >
              <div className="flex flex-col gap-1 items-start">
                <p className="m-0 text-[11px] font-normal" style={{ color: isDark ? '#9ca3af' : '#697487' }}>
                  Year Built
                </p>
                <p className="m-0 text-xs font-semibold text-center" style={{ color: isDark ? '#e5e7eb' : '#000' }}>
                  {selectedDam.year_completed}
                </p>
              </div>
            </div>

            <div
              className="flex-1 flex gap-3 h-full items-start p-3 border-t border-solid"
              style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
            >
              <div className="flex flex-col gap-1 items-start">
                <p className="m-0 text-[11px] font-normal" style={{ color: isDark ? '#9ca3af' : '#697487' }}>
                  Height
                </p>
                <p className="m-0 text-xs font-semibold text-center" style={{ color: isDark ? '#e5e7eb' : '#000' }}>
                  {selectedDam.height_ft.toLocaleString()} ft
                </p>
              </div>
            </div>
          </div>

          {/* Row 2: Dam Type + Reservoir */}
          <div className="flex flex-1 gap-3 items-center w-full">
            <div
              className="flex-1 flex gap-3 h-full items-start p-3 border-t border-solid"
              style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
            >
              <div className="flex flex-col gap-1 items-start">
                <p className="m-0 text-[11px] font-normal" style={{ color: isDark ? '#9ca3af' : '#697487' }}>
                  Dam Type
                </p>
                <p className="m-0 text-xs font-semibold text-center" style={{ color: isDark ? '#e5e7eb' : '#000' }}>
                  {selectedDam.dam_type}
                </p>
              </div>
            </div>

            <div
              className="flex-1 flex gap-3 h-full items-start p-3 border-t border-solid"
              style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
            >
              <div className="flex flex-col gap-1 items-start">
                <p className="m-0 text-[11px] font-normal" style={{ color: isDark ? '#9ca3af' : '#697487' }}>
                  Reservoir
                </p>
                <p className="m-0 text-xs font-semibold text-center" style={{ color: isDark ? '#e5e7eb' : '#000' }}>
                  {selectedDam.reservoir}
                </p>
              </div>
            </div>
          </div>

          {/* Row 3: Connected Infrastructure (full width) */}
          {selectedDam.connected_infrastructure && selectedDam.connected_infrastructure !== 'None' && (
            <div className="flex flex-1 items-center w-full">
              <div
                className="flex-1 flex gap-3 h-full items-start p-3 border-t border-solid"
                style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
              >
                <div className="flex flex-col gap-1 items-start flex-1">
                  <p className="m-0 text-[11px] font-normal" style={{ color: isDark ? '#9ca3af' : '#697487' }}>
                    Connected Infrastructure
                  </p>
                  <p className="m-0 text-xs font-semibold" style={{ color: isDark ? '#e5e7eb' : '#000' }}>
                    {selectedDam.connected_infrastructure}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
