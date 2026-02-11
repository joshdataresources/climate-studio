import { X, Droplets, TrendingDown, AlertTriangle, Calendar, MapPin, Gauge, Thermometer } from 'lucide-react'
import { Button } from '../ui/button'

// Projections object with year keys and volume values
interface Projections {
  [year: string]: number
}

export interface SelectedAquifer {
  name: string
  state?: string
  region?: string
  rock_type?: string
  recharge_rate?: string
  consumption_factor?: string
  volume_gallons_2025?: number
  projections?: Projections
  currentVolume?: number
  depletionStatus?: string
  depletionSeverity?: string
  depletionPercentage?: number
}

interface GroundwaterDetailsPanelProps {
  selectedAquifer: SelectedAquifer | null
  projectionYear: number
  onClose: () => void
}

// Helper to get volume for a specific year from projections
function getVolumeForYear(projections: Projections | undefined, year: number): number | null {
  if (!projections) return null

  const availableYears = Object.keys(projections).map(Number).sort((a, b) => a - b)

  if (projections[year.toString()]) {
    return projections[year.toString()]
  }

  let lowerYear = availableYears[0]
  let upperYear = availableYears[availableYears.length - 1]

  for (let i = 0; i < availableYears.length - 1; i++) {
    if (availableYears[i] <= year && availableYears[i + 1] >= year) {
      lowerYear = availableYears[i]
      upperYear = availableYears[i + 1]
      break
    }
  }

  if (year <= lowerYear) return projections[lowerYear.toString()]
  if (year >= upperYear) return projections[upperYear.toString()]

  const lowerVol = projections[lowerYear.toString()]
  const upperVol = projections[upperYear.toString()]
  const ratio = (year - lowerYear) / (upperYear - lowerYear)

  return lowerVol + (upperVol - lowerVol) * ratio
}

// Get depletion status based on percentage of 2025 baseline
// Always recalculates from projections when available so it responds to slider changes
function getDepletionStatus(
  aquifer: SelectedAquifer | null,
  projectionYear: number
): { label: string; color: string; severity: 'critical' | 'stressed' | 'moderate' | 'stable'; percentage: number } {
  if (!aquifer) return { label: 'Unknown', color: '#6b7280', severity: 'stable', percentage: 100 }

  // Always try to calculate from projections first (so slider changes recalculate)
  const baseline = aquifer.volume_gallons_2025 || aquifer.projections?.['2025']
  if (baseline && aquifer.projections) {
    const currentVolume = getVolumeForYear(aquifer.projections, projectionYear)
    if (currentVolume !== null) {
      const percentage = (currentVolume / baseline) * 100
      return classifyPercentage(percentage)
    }
  }

  // Fallback to pre-calculated values from WaterAccessView (static snapshot from click)
  if (aquifer.depletionSeverity && aquifer.depletionPercentage !== undefined) {
    const pct = typeof aquifer.depletionPercentage === 'string'
      ? parseFloat(aquifer.depletionPercentage)
      : aquifer.depletionPercentage
    if (!isNaN(pct)) {
      return classifyPercentage(pct)
    }
  }

  return { label: 'Unknown', color: '#6b7280', severity: 'stable', percentage: 100 }
}

function classifyPercentage(percentage: number): { label: string; color: string; severity: 'critical' | 'stressed' | 'moderate' | 'stable'; percentage: number } {
  if (percentage >= 98) {
    return { label: 'Stable', color: '#22c55e', severity: 'stable', percentage }
  }
  if (percentage >= 90) {
    return { label: 'Moderate', color: '#3b82f6', severity: 'moderate', percentage }
  }
  if (percentage >= 75) {
    return { label: 'Stressed', color: '#f97316', severity: 'stressed', percentage }
  }
  return { label: 'Critical', color: '#ef4444', severity: 'critical', percentage }
}

// Format large numbers
function formatVolume(value?: number | string): string {
  if (!value) return 'N/A'
  if (typeof value === 'string') return value

  if (value >= 1e15) return `${(value / 1e15).toFixed(1)} Quadrillion gal`
  if (value >= 1e12) return `${(value / 1e12).toFixed(1)} Trillion gal`
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)} Billion gal`
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)} Million gal`

  return value.toLocaleString() + ' gal'
}

function formatDepletionRate(value?: number | string): string {
  if (!value) return 'N/A'
  if (typeof value === 'string') return value

  if (value >= 1e12) return `${(value / 1e12).toFixed(1)} Trillion gal/yr`
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)} Billion gal/yr`
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)} Million gal/yr`

  return value.toLocaleString() + ' gal/yr'
}

// Generate a light tinted background from the status color
function getStatusBgColor(color: string): string {
  const bgMap: Record<string, string> = {
    '#ef4444': 'rgba(239, 68, 68, 0.1)',   // Critical - light red
    '#f97316': 'rgba(249, 115, 22, 0.1)',   // Stressed - light orange
    '#3b82f6': 'rgba(59, 130, 246, 0.1)',   // Moderate - light blue
    '#22c55e': 'rgba(34, 197, 94, 0.1)',    // Stable - light green
    '#6b7280': 'rgba(107, 114, 128, 0.1)',  // Unknown - light gray
  }
  return bgMap[color] || 'rgba(107, 114, 128, 0.1)'
}

export function GroundwaterDetailsPanel({ selectedAquifer, projectionYear, onClose }: GroundwaterDetailsPanelProps) {
  if (!selectedAquifer) return null

  const status = getDepletionStatus(selectedAquifer, projectionYear)

  // Safe percentage - ensure it's a valid number for .toFixed()
  const safePercentage = typeof status.percentage === 'number' && !isNaN(status.percentage)
    ? status.percentage
    : 100

  // Get volume for the selected year (recalculate from projections if available)
  const currentVolume = selectedAquifer.projections
    ? getVolumeForYear(selectedAquifer.projections, projectionYear)
    : (selectedAquifer.currentVolume ?? null)

  // Get baseline volume
  const baselineVolume = selectedAquifer.volume_gallons_2025 || selectedAquifer.projections?.['2025']

  // Dynamic colors based on status
  const statusColor = status.color
  const statusBg = getStatusBgColor(statusColor)

  return (
    <div className="widget-container">
      {/* Header */}
      <div className="flex justify-between items-start mb-0 pb-3">
        <div className="flex-1 min-w-0 pr-2">
          <h3 className="m-0 text-[15px] font-semibold text-foreground leading-tight">
            {selectedAquifer.name}
          </h3>
          {selectedAquifer.rock_type && (
            <div className="flex items-center gap-1 mt-1">
              <MapPin size={12} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {selectedAquifer.rock_type}
              </span>
            </div>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 flex-shrink-0"
          onClick={onClose}
        >
          <X size={16} />
        </Button>
      </div>

      {/* Two Column Layout */}
      <div className="flex gap-4">
        {/* Left Column - Warning & Projection */}
        <div className="flex-1 flex flex-col gap-3">
          {/* Status Warning Badge */}
          <div
            className="flex items-center justify-center gap-3 px-3 py-2 rounded-lg border border-solid w-full"
            style={{
              backgroundColor: statusColor,
              borderColor: statusColor,
              boxShadow: '0px 0px 8px 0px rgba(0,0,0,0.03)'
            }}
          >
            <AlertTriangle size={16} style={{ color: '#fff', height: '13.818px', width: '16px' }} />
            <span className="text-xs font-semibold text-white text-center">
              {status.label} • {safePercentage.toFixed(0)}% of 2025 Capacity
            </span>
          </div>

          {/* Projection Box */}
          <div className="flex flex-col items-start w-full">
            <div
              className="flex flex-col gap-3 items-start p-3 rounded-lg w-full"
              style={{ backgroundColor: statusBg }}
            >
              <div className="flex flex-col gap-1 items-start w-full">
                <div className="flex items-center gap-2 w-full">
                  <Thermometer size={20} style={{ color: statusColor }} />
                  <span className="text-xs font-semibold text-center" style={{ color: statusColor }}>
                    {projectionYear} Projection
                  </span>
                </div>

                <div className="text-xs w-full" style={{ color: '#697487' }}>
                  <p className="m-0 mb-0">
                    {safePercentage >= 98
                      ? 'Aquifer capacity remains stable with sustainable recharge rates.'
                      : safePercentage >= 90
                        ? 'Moderate depletion detected. Monitoring recommended.'
                        : 'Significant depletion observed.'}
                  </p>
                  <p className="m-0">
                    {safePercentage < 90 && 'Conservation Measures may be needed'}
                  </p>
                </div>
              </div>

              {/* Capacity Remaining */}
              <div className="flex flex-col gap-1 items-start w-full">
                <p className="m-0 text-[11px] font-normal" style={{ color: '#697487' }}>
                  Capacity Remaining
                </p>
                <div className="h-2.5 rounded-full overflow-clip w-full relative" style={{ backgroundColor: 'rgba(90, 124, 236, 0.1)' }}>
                  <div
                    className="absolute h-2.5 left-0 rounded-full top-0"
                    style={{
                      width: `${Math.min(100, safePercentage)}%`,
                      backgroundColor: statusColor
                    }}
                  />
                </div>
                <div className="flex items-center justify-between w-full text-[11px] font-normal" style={{ color: '#697487' }}>
                  <p className="m-0">0%</p>
                  <p className="m-0">50%</p>
                  <p className="m-0">100%</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Supporting Info */}
        <div className="flex-1 flex flex-col gap-3 self-stretch">
          {/* Top Row */}
          <div className="flex flex-1 gap-3 items-start w-full">
            <div
              className="flex-1 flex gap-3 h-full items-start p-3 rounded-lg"
              style={{ backgroundColor: statusBg }}
            >
              <div className="flex-1 flex flex-col gap-1 items-start">
                <p className="m-0 text-[11px] font-normal" style={{ color: '#697487' }}>
                  Volume
                </p>
                <p className="flex-1 m-0 text-xs font-semibold whitespace-pre-wrap" style={{ color: statusColor }}>
                  {formatVolume(currentVolume)}
                </p>
              </div>
            </div>

            <div
              className="flex-1 flex gap-3 h-full items-start p-3 rounded-lg"
              style={{ backgroundColor: statusBg }}
            >
              <div className="flex-1 flex flex-col gap-1 items-start">
                <p className="m-0 text-[11px] font-normal" style={{ color: '#697487' }}>
                  2025 Baseline
                </p>
                <p className="flex-1 m-0 text-xs font-semibold whitespace-pre-wrap" style={{ color: '#4fc660' }}>
                  {formatVolume(baselineVolume)}
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Row */}
          <div className="flex flex-1 gap-3 items-center w-full">
            <div
              className="flex-1 flex gap-3 h-full items-start p-3 rounded-lg"
              style={{ backgroundColor: statusBg }}
            >
              <div className="flex-1 flex flex-col gap-1 items-start">
                <p className="m-0 text-[11px] font-normal" style={{ color: '#697487' }}>
                  Recharge
                </p>
                <p className="flex-1 m-0 text-xs font-semibold whitespace-pre-wrap" style={{ color: statusColor }}>
                  {selectedAquifer.recharge_rate || 'Low (<1 in/yr)'}
                </p>
              </div>
            </div>

            <div
              className="flex-1 flex gap-3 h-full items-start p-3 rounded-lg"
              style={{ backgroundColor: statusBg }}
            >
              <div className="flex-1 flex flex-col gap-1 items-start">
                <p className="m-0 text-[11px] font-normal" style={{ color: '#697487' }}>
                  Consumption
                </p>
                <p className="flex-1 m-0 text-xs font-semibold whitespace-pre-wrap" style={{ color: statusColor }}>
                  {selectedAquifer.consumption_factor || 'Very High (Agriculture)'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

