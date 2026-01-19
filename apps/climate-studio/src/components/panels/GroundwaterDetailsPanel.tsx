import { X, Droplets, TrendingDown, AlertTriangle, Calendar, MapPin, Gauge } from 'lucide-react'
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
function getDepletionStatus(
  aquifer: SelectedAquifer | null, 
  projectionYear: number
): { label: string; color: string; severity: 'critical' | 'stressed' | 'moderate' | 'stable'; percentage: number } {
  if (!aquifer) return { label: 'Unknown', color: '#6b7280', severity: 'stable', percentage: 100 }
  
  // If already calculated (from WaterAccessView)
  if (aquifer.depletionSeverity && aquifer.depletionPercentage !== undefined) {
    const colorMap: Record<string, string> = {
      'critical': '#ef4444',
      'stressed': '#f97316',
      'moderate': '#3b82f6',
      'stable': '#22c55e'
    }
    const labelMap: Record<string, string> = {
      'critical': 'Critical',
      'stressed': 'Stressed',
      'moderate': 'Moderate',
      'stable': 'Stable'
    }
    return {
      label: labelMap[aquifer.depletionSeverity] || 'Unknown',
      color: colorMap[aquifer.depletionSeverity] || '#6b7280',
      severity: aquifer.depletionSeverity as 'critical' | 'stressed' | 'moderate' | 'stable',
      percentage: aquifer.depletionPercentage
    }
  }
  
  // Calculate from projections
  const baseline = aquifer.volume_gallons_2025 || aquifer.projections?.['2025']
  if (!baseline || !aquifer.projections) {
    return { label: 'Unknown', color: '#6b7280', severity: 'stable', percentage: 100 }
  }
  
  const currentVolume = getVolumeForYear(aquifer.projections, projectionYear)
  if (currentVolume === null) {
    return { label: 'Unknown', color: '#6b7280', severity: 'stable', percentage: 100 }
  }
  
  const percentage = (currentVolume / baseline) * 100
  
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

export function GroundwaterDetailsPanel({ selectedAquifer, projectionYear, onClose }: GroundwaterDetailsPanelProps) {
  if (!selectedAquifer) return null
  
  const status = getDepletionStatus(selectedAquifer, projectionYear)
  
  // Get volume for the selected year
  const currentVolume = selectedAquifer.currentVolume ?? 
    getVolumeForYear(selectedAquifer.projections, projectionYear)
  
  // Get baseline volume
  const baselineVolume = selectedAquifer.volume_gallons_2025 || selectedAquifer.projections?.['2025']
  
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
      <div className="grid grid-cols-2 gap-4">
        {/* Left Column */}
        <div className="space-y-3">
          {/* Status Badge with Percentage */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 6,
            background: `${status.color}20`,
            border: `1px solid ${status.color}40`,
            width: '100%'
          }}>
            {status.severity === 'critical' && <AlertTriangle size={14} style={{ color: status.color }} />}
            {status.severity === 'stressed' && <TrendingDown size={14} style={{ color: status.color }} />}
            {(status.severity === 'moderate' || status.severity === 'stable') && <Droplets size={14} style={{ color: status.color }} />}
            <span style={{ 
              fontSize: 12, 
              fontWeight: 600, 
              color: status.color 
            }}>
              {status.label} • {status.percentage.toFixed(1)}% of 2025 Capacity
            </span>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-background/50 border border-border/60">
              <div className="text-[11px] text-muted-foreground mb-1 uppercase tracking-wider">
                Volume ({projectionYear})
              </div>
              <div className="text-sm font-semibold" style={{ color: status.color }}>
                {formatVolume(currentVolume)}
              </div>
            </div>
            
            <div className="p-3 rounded-lg bg-background/50 border border-border/60">
              <div className="text-[11px] text-muted-foreground mb-1 uppercase tracking-wider">
                2025 Baseline
              </div>
              <div className="text-sm font-semibold text-green-500">
                {formatVolume(baselineVolume)}
              </div>
            </div>
          </div>

          {/* Capacity Gauge */}
          <div className="p-3 rounded-lg bg-background/50 border border-border/60">
            <div className="flex items-center gap-1.5 mb-2">
              <Gauge size={14} className="text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
                Capacity Remaining
              </span>
            </div>
            {/* Progress bar */}
            <div className="h-2 rounded bg-background/80 overflow-hidden">
              <div 
                className="h-full rounded transition-all duration-300"
                style={{
                  width: `${Math.min(100, status.percentage)}%`,
                  background: `linear-gradient(90deg, ${status.color}, ${status.color}cc)`
                }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground/60">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-3">
          {/* Year Outlook */}
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-center gap-1.5 mb-2">
              <Calendar size={14} className="text-blue-500" />
              <span className="text-xs font-semibold text-blue-500">
                {projectionYear} Projection
              </span>
            </div>
            <p className="m-0 text-[13px] text-foreground/80 leading-relaxed">
              {status.percentage >= 98 
                ? 'Aquifer capacity remains stable with sustainable recharge rates.'
                : status.percentage >= 90
                ? 'Moderate depletion detected. Monitoring recommended for sustainable usage.'
                : status.percentage >= 75
                ? 'Significant depletion observed. Conservation measures may be needed.'
                : 'Critical depletion level. Immediate intervention recommended to prevent irreversible damage.'
              }
            </p>
          </div>

          {/* Additional Info */}
          {(selectedAquifer.recharge_rate || selectedAquifer.consumption_factor) && (
            <div className="flex flex-col gap-1">
              {selectedAquifer.recharge_rate && (
                <div className="text-[11px] text-muted-foreground">
                  Recharge: <span className="text-foreground/70">{selectedAquifer.recharge_rate}</span>
                </div>
              )}
              {selectedAquifer.consumption_factor && (
                <div className="text-[11px] text-muted-foreground">
                  Consumption: <span className="text-foreground/70">{selectedAquifer.consumption_factor}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

