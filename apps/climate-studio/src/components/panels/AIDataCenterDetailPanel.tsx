// AI Data Center Detail Panel - Compact, no-scroll detail card matching Figma design
import { X, AlertTriangle, CheckCircle2, Clock, MapPin, Thermometer, Factory as FactoryIcon } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

export interface SelectedDataCenter {
  id: string
  name: string
  company: string
  location: {
    city: string
    state: string
    county?: string
    coordinates: { lat: number; lon: number }
  }
  purpose: string
  status: string
  power_capacity_mw: number
  power_source: string
  cooling_type: string
  gpu_count: number
  gpu_type: string
  investment_usd: number
  campus_acres: number
  building_sqft: number
  jobs: {
    permanent: number
    construction: number
  }
  timeline: {
    announced: string
    construction_start?: string
    operational?: string
    expected_operational?: string
  }
  environmental_impact: {
    annual_electricity_mwh: number
    water_usage_gallons_per_day: number
    carbon_offset_commitment: boolean
    grid_strain: string
    power_equivalent: string
  }
  notes?: string
}

interface AIDataCenterDetailPanelProps {
  datacenter: SelectedDataCenter
  onClose: () => void
}

export function AIDataCenterDetailPanel({ datacenter, onClose }: AIDataCenterDetailPanelProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  // Power capacity risk level
  const getPowerRiskScore = (mw: number) => {
    if (mw >= 1000) return 9
    if (mw >= 500) return 7
    if (mw >= 200) return 5
    return 3
  }

  const powerRiskScore = getPowerRiskScore(datacenter.power_capacity_mw)

  // Dynamic impact color based on risk score — matches icon border on the map
  const getImpactColor = (score: number): { color: string; bgTint: string; label: string } => {
    if (score >= 9) return { color: '#ff3636', bgTint: 'rgba(255, 57, 57, 0.1)', label: 'Critical Impact' }
    if (score >= 7) return { color: '#e97b35', bgTint: 'rgba(233, 123, 53, 0.1)', label: 'High Impact' }
    if (score >= 5) return { color: '#eab308', bgTint: 'rgba(234, 179, 8, 0.1)', label: 'Moderate Impact' }
    return { color: '#22c55e', bgTint: 'rgba(34, 197, 94, 0.1)', label: 'Low Impact' }
  }

  const impactInfo = getImpactColor(powerRiskScore)

  // Determine panel variation
  const isBuilt = datacenter.status === 'operational'
  const isAnnounced = datacenter.status === 'announced' || datacenter.status === 'under_construction'
  const hasHighImpact = powerRiskScore >= 5

  // Format currency
  const formatCurrency = (amount: number) => {
    if (amount >= 1000000000) {
      return `$${(amount / 1000000000).toFixed(2)}B`
    }
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(0)}M`
    }
    return `$${amount.toLocaleString()}`
  }

  // Format large numbers
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`
    return num.toLocaleString()
  }

  return (
    <div className="widget-container">
      {/* Header - Figma style: Name as title, company + location as subtitle */}
      <div className="flex items-start justify-between pb-3">
        <div className="flex-1">
          <h2 className="text-[15px] font-bold mb-1" style={{ color: isDark ? '#fff' : '#000' }}>
            {datacenter.name}
          </h2>
          <div className="flex items-center gap-3 text-xs" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
            <span className="inline-flex items-center gap-1">
              <FactoryIcon size={14} />
              {datacenter.company}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin size={14} />
              {datacenter.location.city}, {datacenter.location.state}
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
        {/* LEFT COLUMN - Warnings & Environmental */}
        <div className="flex-1 flex flex-col gap-3">
          {/* Status Badges */}
          {isBuilt && hasHighImpact ? (
            // Variation 1: Built with warning - two badges side by side
            <div className="flex gap-2.5">
              <div
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg"
                style={{ backgroundColor: impactInfo.color, boxShadow: '0px 0px 8px 0px rgba(0,0,0,0.03)' }}
              >
                <AlertTriangle size={14} style={{ color: '#fff' }} />
                <span className="text-xs font-semibold text-white">{impactInfo.label}</span>
              </div>
              <div
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg"
                style={{ backgroundColor: '#00a03c', boxShadow: '0px 0px 8px 0px rgba(0,0,0,0.03)' }}
              >
                <AlertTriangle size={14} style={{ color: '#fff' }} />
                <span className="text-xs font-semibold text-white">Built</span>
              </div>
            </div>
          ) : isAnnounced && hasHighImpact ? (
            // Variation 3: Announced with warning - two badges side by side
            <div className="flex gap-2.5">
              <div
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg"
                style={{ backgroundColor: impactInfo.color, boxShadow: '0px 0px 8px 0px rgba(0,0,0,0.03)' }}
              >
                <AlertTriangle size={14} style={{ color: '#fff' }} />
                <span className="text-xs font-semibold text-white">{impactInfo.label}</span>
              </div>
              <div
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg"
                style={{ backgroundColor: '#5a7cec', boxShadow: '0px 0px 8px 0px rgba(0,0,0,0.03)' }}
              >
                <Clock size={14} style={{ color: '#fff' }} />
                <span className="text-xs font-semibold text-white">Announced</span>
              </div>
            </div>
          ) : (
            // Variation 2: Announced (no warning) - full-width badge
            <div
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg w-full"
              style={{ backgroundColor: '#5a7cec', boxShadow: '0px 0px 8px 0px rgba(0,0,0,0.03)' }}
            >
              <Clock size={14} style={{ color: '#fff' }} />
              <span className="text-xs font-semibold text-white">Announced</span>
            </div>
          )}

          {/* Energy Impact Box (for Built or Announced with warning) */}
          {(isBuilt || hasHighImpact) && (
            <div
              className="p-3 rounded-lg"
              style={{ backgroundColor: impactInfo.bgTint }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Thermometer size={18} style={{ color: impactInfo.color }} />
                <span className="text-xs font-semibold" style={{ color: impactInfo.color }}>
                  Energy Impact
                </span>
              </div>

              <div className="space-y-2 text-xs mb-3">
                <div className="flex justify-between">
                  <span style={{ color: isDark ? '#9ca3af' : '#697487' }}>Power Capacity</span>
                  <span className="font-semibold text-right" style={{ color: isDark ? '#e5e7eb' : '#101728' }}>
                    {datacenter.power_capacity_mw} MW
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: isDark ? '#9ca3af' : '#697487' }}>Annual Electricity</span>
                  <span className="font-semibold text-right" style={{ color: isDark ? '#e5e7eb' : '#101728' }}>
                    {formatNumber(datacenter.environmental_impact.annual_electricity_mwh)} MWh
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: isDark ? '#9ca3af' : '#697487' }}>Water Usage</span>
                  <span className="font-semibold text-right" style={{ color: isDark ? '#e5e7eb' : '#101728' }}>
                    {(datacenter.environmental_impact.water_usage_gallons_per_day / 1000000).toFixed(1)}M gal/day
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: isDark ? '#9ca3af' : '#697487' }}>Grid Strain</span>
                  <span className="font-semibold text-right" style={{ color: isDark ? '#e5e7eb' : '#101728' }}>
                    {datacenter.environmental_impact.grid_strain}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: isDark ? '#9ca3af' : '#697487' }}>Cooling System</span>
                  <span className="font-semibold text-right" style={{ color: isDark ? '#e5e7eb' : '#101728' }}>
                    {datacenter.cooling_type}
                  </span>
                </div>
              </div>

              {/* Divider + Description */}
              {datacenter.notes && (
                <>
                  <div className="h-px w-full mb-3" style={{ backgroundColor: '#e0e0e0' }} />
                  <p className="text-xs mb-0" style={{ color: isDark ? '#9ca3af' : '#697487' }}>
                    {datacenter.notes}
                  </p>
                </>
              )}
            </div>
          )}

          {/* Description Box (for Announced without warning - no Energy Impact) */}
          {isAnnounced && !hasHighImpact && datacenter.notes && (
            <div
              className="p-3 rounded-lg"
              style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}
            >
              <p className="text-xs mb-0" style={{ color: isDark ? '#9ca3af' : '#697487' }}>
                {datacenter.notes}
              </p>
            </div>
          )}

          {/* Bottom Info Boxes */}
          {isBuilt ? (
            // Built: Power Source + Carbon Offset (translucent green boxes)
            <div className="flex gap-3">
              <div
                className="flex-1 p-3 rounded-lg"
                style={{ backgroundColor: 'rgba(0, 160, 60, 0.1)' }}
              >
                <div className="text-[11px] mb-1" style={{ color: isDark ? '#9ca3af' : '#697487' }}>
                  Power Source
                </div>
                <div className="text-xs font-semibold" style={{ color: '#00a03c' }}>
                  {datacenter.power_source}
                </div>
              </div>
              <div
                className="flex-1 p-3 rounded-lg"
                style={{ backgroundColor: 'rgba(0, 160, 60, 0.1)' }}
              >
                <div className="text-[11px] mb-1" style={{ color: isDark ? '#9ca3af' : '#697487' }}>
                  Carbon Offset
                </div>
                <div className="text-xs font-semibold" style={{ color: '#00a03c' }}>
                  {datacenter.environmental_impact.carbon_offset_commitment ? 'Yes' : 'No'}
                </div>
              </div>
            </div>
          ) : (
            // Announced: Announced + Expected Operational (blue tint boxes)
            <div className="flex gap-3">
              <div
                className="flex-1 p-3 rounded-lg"
                style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}
              >
                <div className="text-[11px] mb-1" style={{ color: isDark ? '#9ca3af' : '#697487' }}>
                  Announced
                </div>
                <div className="text-xs font-semibold" style={{ color: isDark ? '#e5e7eb' : '#101728' }}>
                  Yes
                </div>
              </div>
              <div
                className="flex-1 p-3 rounded-lg"
                style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}
              >
                <div className="text-[11px] mb-1" style={{ color: isDark ? '#9ca3af' : '#697487' }}>
                  Expected Operational
                </div>
                <div className="text-xs font-semibold" style={{ color: isDark ? '#e5e7eb' : '#101728' }}>
                  {datacenter.timeline.expected_operational ? new Date(datacenter.timeline.expected_operational).getFullYear() : 'TBD'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN - Supporting Info */}
        <div className="flex-1 flex flex-col gap-3">
          {/* Row 1: Investment + Investment per Job */}
          <div className="flex gap-3">
            <div
              className="flex-1 p-3 border-t"
              style={{
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
              }}
            >
              <div className="text-[11px] mb-1" style={{ color: isDark ? '#9ca3af' : '#697487' }}>
                Investment
              </div>
              <div className="text-xs font-semibold" style={{ color: isDark ? '#fff' : '#000' }}>
                {formatCurrency(datacenter.investment_usd)}
              </div>
            </div>
            <div
              className="flex-1 p-3 border-t"
              style={{
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
              }}
            >
              <div className="text-[11px] mb-1" style={{ color: isDark ? '#9ca3af' : '#697487' }}>
                Investment per Job
              </div>
              <div className="text-xs font-semibold" style={{ color: isDark ? '#fff' : '#000' }}>
                {datacenter.jobs.permanent > 0 ? formatCurrency(datacenter.investment_usd / datacenter.jobs.permanent) : 'N/A'}
              </div>
            </div>
          </div>

          {/* Row 2: Permanent Jobs + Construction Jobs */}
          <div className="flex gap-3">
            <div
              className="flex-1 p-3 border-t"
              style={{
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
              }}
            >
              <div className="text-[11px] mb-1" style={{ color: isDark ? '#9ca3af' : '#697487' }}>
                Permanent Jobs
              </div>
              <div className="text-xs font-semibold" style={{ color: isDark ? '#fff' : '#000' }}>
                {datacenter.jobs.permanent.toLocaleString()}
              </div>
            </div>
            <div
              className="flex-1 p-3 border-t"
              style={{
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
              }}
            >
              <div className="text-[11px] mb-1" style={{ color: isDark ? '#9ca3af' : '#697487' }}>
                Construction Jobs
              </div>
              <div className="text-xs font-semibold" style={{ color: isDark ? '#fff' : '#000' }}>
                {datacenter.jobs.construction.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Row 3: GPU/Accelerator Count + Hardware Type */}
          <div className="flex gap-3">
            <div
              className="flex-1 p-3 border-t"
              style={{
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
              }}
            >
              <div className="text-[11px] mb-1" style={{ color: isDark ? '#9ca3af' : '#697487' }}>
                GPU/Accelerator Count
              </div>
              <div className="text-xs font-semibold" style={{ color: isDark ? '#fff' : '#000' }}>
                {formatNumber(datacenter.gpu_count)}
              </div>
            </div>
            <div
              className="flex-1 p-3 border-t"
              style={{
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
              }}
            >
              <div className="text-[11px] mb-1" style={{ color: isDark ? '#9ca3af' : '#697487' }}>
                Hardware Type
              </div>
              <div className="text-xs font-semibold" style={{ color: isDark ? '#fff' : '#000' }}>
                {datacenter.gpu_type}
              </div>
            </div>
          </div>

          {/* Row 4: Campus Size + Building Space */}
          <div className="flex gap-3">
            <div
              className="flex-1 p-3 border-t"
              style={{
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
              }}
            >
              <div className="text-[11px] mb-1" style={{ color: isDark ? '#9ca3af' : '#697487' }}>
                Campus Size
              </div>
              <div className="text-xs font-semibold" style={{ color: isDark ? '#fff' : '#000' }}>
                {datacenter.campus_acres.toLocaleString()} acres
              </div>
            </div>
            <div
              className="flex-1 p-3 border-t"
              style={{
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
              }}
            >
              <div className="text-[11px] mb-1" style={{ color: isDark ? '#9ca3af' : '#697487' }}>
                Building Space
              </div>
              <div className="text-xs font-semibold" style={{ color: isDark ? '#fff' : '#000' }}>
                {formatNumber(datacenter.building_sqft)} sq ft
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
