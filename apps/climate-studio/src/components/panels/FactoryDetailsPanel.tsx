import { X, Factory, Droplet, AlertTriangle, TrendingUp, MapPin, Briefcase, DollarSign, Users, Zap } from 'lucide-react'
import { Button } from '../ui/button'

export interface SelectedFactory {
  name: string
  company: string
  city: string
  state: string
  type: string
  investment?: number
  employees?: number
  yearEstablished?: number
  facilities?: string
  waterUsage?: {
    annual_acre_feet?: number
    daily_gallons?: number
    recycling_rate?: number
    target_recycling_rate?: number
    description?: string
  }
  environmental?: {
    stress_type?: string
    severity?: 'critical' | 'stressed' | 'moderate' | 'stable'
    drought_duration?: number
    aquifer_status?: string
    aquifer_name?: string
    aquifer_depletion?: string
    air_quality?: string
    air_quality_rank?: number
    air_pollutants?: string[]
    chemical_waste?: boolean
    health_impact?: string
    environmental_justice?: boolean
    impact_description?: string
  }
}

interface FactoryDetailsPanelProps {
  selectedFactory: SelectedFactory | null
  onClose: () => void
}

// Format large numbers
function formatCurrency(value?: number): string {
  if (!value) return 'N/A'

  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`

  return `$${value.toLocaleString()}`
}

function formatWaterUsage(gallons?: number): string {
  if (!gallons) return 'N/A'

  if (gallons >= 1e9) return `${(gallons / 1e9).toFixed(1)}B gal/day`
  if (gallons >= 1e6) return `${(gallons / 1e6).toFixed(1)}M gal/day`
  if (gallons >= 1e3) return `${(gallons / 1e3).toFixed(1)}K gal/day`

  return `${gallons.toLocaleString()} gal/day`
}

function getSeverityColor(severity?: string): string {
  switch (severity) {
    case 'critical': return '#ef4444'
    case 'stressed': return '#f97316'
    case 'moderate': return '#3b82f6'
    case 'stable': return '#22c55e'
    default: return '#6b7280'
  }
}

function getSeverityIcon(severity?: string) {
  switch (severity) {
    case 'critical': return AlertTriangle
    case 'stressed': return TrendingUp
    default: return Droplet
  }
}

export function FactoryDetailsPanel({ selectedFactory, onClose }: FactoryDetailsPanelProps) {
  if (!selectedFactory) return null

  const severity = selectedFactory.environmental?.severity || 'moderate'
  const severityColor = getSeverityColor(severity)
  const SeverityIcon = getSeverityIcon(severity)

  return (
    <div className="widget-container">
      {/* Header */}
      <div className="flex justify-between items-start mb-0 pb-3">
        <div className="flex-1 min-w-0 pr-2">
          <h3 className="m-0 text-[15px] font-semibold text-foreground leading-tight">
            {selectedFactory.name}
          </h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <div className="flex items-center gap-1">
              <Factory size={12} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {selectedFactory.company}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <MapPin size={12} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {selectedFactory.city}, {selectedFactory.state}
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

      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left Column - Facility Info */}
        <div className="space-y-3 flex flex-col">
          {/* Status Badge */}
          {selectedFactory.environmental && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 6,
              background: `${severityColor}20`,
              border: `1px solid ${severityColor}40`,
              width: '100%'
            }}>
              <SeverityIcon size={14} style={{ color: severityColor }} />
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color: severityColor
              }}>
                {selectedFactory.environmental.stress_type || 'Environmental Impact'}
              </span>
            </div>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-2">
            {selectedFactory.type && (
              <div className="p-2 rounded-lg bg-background/50 border border-border/60">
                <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">
                  Industry
                </div>
                <div className="text-xs font-semibold text-foreground">
                  {selectedFactory.type}
                </div>
              </div>
            )}

            {selectedFactory.yearEstablished && (
              <div className="p-2 rounded-lg bg-background/50 border border-border/60">
                <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">
                  Established
                </div>
                <div className="text-xs font-semibold text-foreground">
                  {selectedFactory.yearEstablished}
                </div>
              </div>
            )}
          </div>

          {/* Investment & Employees */}
          {(selectedFactory.investment || selectedFactory.employees) && (
            <div className="grid grid-cols-2 gap-2">
              {selectedFactory.investment && (
                <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-1 mb-1">
                    <DollarSign size={11} className="text-green-500" />
                    <span className="text-[10px] text-green-500 uppercase tracking-wider">
                      Investment
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-green-500">
                    {formatCurrency(selectedFactory.investment)}
                  </div>
                </div>
              )}

              {selectedFactory.employees && (
                <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-center gap-1 mb-1">
                    <Users size={11} className="text-blue-500" />
                    <span className="text-[10px] text-blue-500 uppercase tracking-wider">
                      Employees
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-blue-500">
                    {selectedFactory.employees.toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Facilities */}
          {selectedFactory.facilities ? (
            <div className="p-2 rounded-lg bg-background/50 border border-border/60 flex-1 flex flex-col">
              <div className="flex items-center gap-1 mb-1">
                <Briefcase size={11} className="text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Facilities
                </span>
              </div>
              <div className="text-xs text-foreground/80 flex-1">
                {selectedFactory.facilities}
              </div>
            </div>
          ) : (
            <div className="flex-1" />
          )}
        </div>

        {/* Right Column - Environmental Impact */}
        <div className="space-y-3">
          {/* Water Usage */}
          {selectedFactory.waterUsage && (
            <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <div className="flex items-center gap-1.5 mb-2">
                <Droplet size={14} className="text-cyan-500" />
                <span className="text-xs font-semibold text-cyan-500">
                  Water Usage
                </span>
              </div>
              <div className="space-y-1.5">
                {selectedFactory.waterUsage.daily_gallons && (
                  <div className="text-[13px] text-foreground/80">
                    <span className="font-semibold">{formatWaterUsage(selectedFactory.waterUsage.daily_gallons)}</span>
                  </div>
                )}
                {selectedFactory.waterUsage.recycling_rate !== undefined && (
                  <div className="text-xs text-foreground/70">
                    Recycling: {(selectedFactory.waterUsage.recycling_rate * 100).toFixed(0)}%
                    {selectedFactory.waterUsage.target_recycling_rate && (
                      <span className="text-muted-foreground">
                        {' '}→ {(selectedFactory.waterUsage.target_recycling_rate * 100).toFixed(0)}% target
                      </span>
                    )}
                  </div>
                )}
                {selectedFactory.waterUsage.description && (
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {selectedFactory.waterUsage.description}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Environmental Impact Details */}
          {selectedFactory.environmental && (
            <div className="p-3 rounded-lg border" style={{
              background: `${severityColor}10`,
              borderColor: `${severityColor}40`
            }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Zap size={14} style={{ color: severityColor }} />
                <span className="text-xs font-semibold" style={{ color: severityColor }}>
                  Environmental Impact
                </span>
              </div>
              <div className="space-y-2">
                {selectedFactory.environmental.impact_description && (
                  <p className="m-0 text-[12px] text-foreground/80 leading-relaxed">
                    {selectedFactory.environmental.impact_description}
                  </p>
                )}

                {/* Specific Environmental Factors */}
                <div className="space-y-1">
                  {selectedFactory.environmental.drought_duration && (
                    <div className="text-[11px] text-foreground/70">
                      <span className="text-muted-foreground">Drought:</span> {selectedFactory.environmental.drought_duration}+ years
                    </div>
                  )}
                  {selectedFactory.environmental.aquifer_name && (
                    <div className="text-[11px] text-foreground/70">
                      <span className="text-muted-foreground">Aquifer:</span> {selectedFactory.environmental.aquifer_name}
                      {selectedFactory.environmental.aquifer_depletion && (
                        <span className="text-orange-500"> ({selectedFactory.environmental.aquifer_depletion} depletion)</span>
                      )}
                    </div>
                  )}
                  {selectedFactory.environmental.air_pollutants && selectedFactory.environmental.air_pollutants.length > 0 && (
                    <div className="text-[11px] text-foreground/70">
                      <span className="text-muted-foreground">Air Pollutants:</span> {selectedFactory.environmental.air_pollutants.join(', ')}
                    </div>
                  )}
                  {selectedFactory.environmental.health_impact && (
                    <div className="text-[11px] text-red-500 font-medium">
                      ⚠️ {selectedFactory.environmental.health_impact}
                    </div>
                  )}
                  {selectedFactory.environmental.environmental_justice && (
                    <div className="text-[11px] text-orange-500 font-medium">
                      ⚠️ Environmental Justice Concern
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
