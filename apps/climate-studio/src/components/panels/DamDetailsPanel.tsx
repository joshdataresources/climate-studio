import { X, Droplets, AlertTriangle, Zap, MapPin, TrendingDown } from 'lucide-react'
import { Button } from '../ui/button'

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

function getImpactColor(impact: string): string {
  switch (impact) {
    case 'extreme': return '#7f1d1d'
    case 'severe': return '#dc2626'
    case 'moderate': return '#f59e0b'
    default: return '#3b82f6'
  }
}

function getImpactLabel(impact: string): string {
  switch (impact) {
    case 'extreme': return 'Extreme Downstream Impact'
    case 'severe': return 'Severe Downstream Impact'
    case 'moderate': return 'Moderate Downstream Impact'
    default: return 'Low Downstream Impact'
  }
}

export function DamDetailsPanel({ selectedDam, onClose }: DamDetailsPanelProps) {
  if (!selectedDam) return null

  const impactColor = getImpactColor(selectedDam.downstream_impact)

  return (
    <div className="widget-container">
      {/* Header */}
      <div className="flex justify-between items-start mb-0 pb-3">
        <div className="flex-1 min-w-0 pr-2">
          <h3 className="m-0 text-[15px] font-semibold text-foreground leading-tight">
            {selectedDam.name}
          </h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <div className="flex items-center gap-1">
              <Droplets size={12} className="text-cyan-500" />
              <span className="text-xs text-muted-foreground">
                {selectedDam.river}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <MapPin size={12} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {selectedDam.state}
              </span>
            </div>
          </div>
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

      {/* Impact Badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 6,
        background: `${impactColor}20`,
        border: `1px solid ${impactColor}40`,
        marginBottom: 12,
        width: '100%'
      }}>
        <AlertTriangle size={14} style={{ color: impactColor }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: impactColor }}>
          {getImpactLabel(selectedDam.downstream_impact)}
        </span>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left Column - Dam Stats */}
        <div className="space-y-3">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg bg-background/50 border border-border/60">
              <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Year Built</div>
              <div className="text-xs font-semibold text-foreground">{selectedDam.year_completed}</div>
            </div>
            <div className="p-2 rounded-lg bg-background/50 border border-border/60">
              <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Height</div>
              <div className="text-xs font-semibold text-foreground">{selectedDam.height_ft.toLocaleString()} ft</div>
            </div>
          </div>

          {/* Type & Reservoir */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg bg-background/50 border border-border/60">
              <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Dam Type</div>
              <div className="text-xs font-semibold text-foreground">{selectedDam.dam_type}</div>
            </div>
            <div className="p-2 rounded-lg bg-background/50 border border-border/60">
              <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Reservoir</div>
              <div className="text-xs font-semibold text-foreground truncate">{selectedDam.reservoir}</div>
            </div>
          </div>

          {/* Storage & Power */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <div className="flex items-center gap-1 mb-1">
                <Droplets size={11} className="text-cyan-500" />
                <span className="text-[10px] text-cyan-500 uppercase tracking-wider">Storage</span>
              </div>
              <div className="text-xs font-semibold text-cyan-500">
                {formatStorage(selectedDam.storage_acre_ft)}
              </div>
            </div>
            {selectedDam.capacity_mw > 0 ? (
              <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <div className="flex items-center gap-1 mb-1">
                  <Zap size={11} className="text-yellow-500" />
                  <span className="text-[10px] text-yellow-500 uppercase tracking-wider">Power</span>
                </div>
                <div className="text-xs font-semibold text-yellow-500">
                  {selectedDam.capacity_mw.toLocaleString()} MW
                </div>
              </div>
            ) : (
              <div className="p-2 rounded-lg bg-background/50 border border-border/60">
                <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Power</div>
                <div className="text-xs font-semibold text-muted-foreground">No generation</div>
              </div>
            )}
          </div>

          {/* Serves */}
          <div className="p-2 rounded-lg bg-background/50 border border-border/60">
            <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Serves</div>
            <div className="text-xs text-foreground/80">{selectedDam.serves}</div>
          </div>
        </div>

        {/* Right Column - Impact & Infrastructure */}
        <div className="space-y-3">
          {/* Downstream Impact */}
          <div className="p-3 rounded-lg border flex-1" style={{
            background: `${impactColor}10`,
            borderColor: `${impactColor}40`
          }}>
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingDown size={14} style={{ color: impactColor }} />
              <span className="text-xs font-semibold" style={{ color: impactColor }}>
                Downstream Impact
              </span>
            </div>
            <p className="m-0 text-[12px] text-foreground/80 leading-relaxed">
              {selectedDam.impact_description}
            </p>
          </div>

          {/* Connected Infrastructure */}
          {selectedDam.connected_infrastructure && selectedDam.connected_infrastructure !== 'None' && (
            <div className="p-3 rounded-lg bg-background/50 border border-border/60">
              <div className="flex items-center gap-1.5 mb-2">
                <Zap size={13} className="text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Connected Infrastructure
                </span>
              </div>
              <div className="text-[12px] text-foreground/80 leading-relaxed">
                {selectedDam.connected_infrastructure}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
