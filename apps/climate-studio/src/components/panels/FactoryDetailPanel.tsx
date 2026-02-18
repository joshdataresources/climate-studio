// Factory Detail Panel - Compact detail card matching Figma design
import { X, AlertTriangle, MapPin, Factory as FactoryIcon, Thermometer } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

export interface SelectedFactory {
  id: string
  name: string
  company: string
  location: {
    city: string
    state: string
    coordinates: { lat: number; lon: number }
  }
  sector: string
  status: string
  investment: {
    total: number
    chips_act_grant?: number
    chips_act_loan?: number
    state_grants?: number
    private: number
  }
  jobs: {
    promised: number
    actual?: number
    construction?: number
  }
  environmental_risk: {
    water_stress?: string
    water_usage_gallons_per_day?: number
    heat_risk?: string
    drought_risk?: string
    wildfire_risk?: string
    water_risk?: string
    flood_risk?: string
    hurricane_risk?: string
    overall_risk_score: number
    climate_projection_2040: string
  }
  ownership: {
    type: string
    country: string
    parent_company?: string
    us_ownership_pct?: number
    state_backed?: boolean
    publicly_traded?: boolean
    major_foreign_investor?: string
  }
  timeline: {
    announced: string
    construction_start?: string
    operational?: string
    expected_operational?: string
    paused?: string
    failed?: string
  }
  incentives?: {
    state_grants?: number
    property_tax_abatement?: number
    infrastructure_investment?: number
    workforce_training?: number
    total_state_local?: number
    cost_per_job?: number
    state_committed?: number
    actual_paid?: number
    clawed_back?: number
  }
  national_security_flags?: string[]
  assessment?: string
  water_source?: string
  proximity_concerns?: {
    military_bases_within_50mi?: string[]
    sensitive_infrastructure?: string[]
  }
  community_impact?: {
    homes_demolished?: number
    land_seized_acres?: number
    environmental_damage?: string
  }
  status_notes?: string
}

interface FactoryDetailPanelProps {
  factory: SelectedFactory
  onClose: () => void
}

// Water stress severity → badge color + label
function getWaterStressInfo(stress?: string): { label: string; color: string; bgTint: string; show: boolean } {
  if (!stress) return { label: '', color: '#6b7280', bgTint: 'rgba(107,114,128,0.1)', show: false }

  switch (stress.toLowerCase()) {
    case 'extreme':
      return { label: 'Extreme Water Stress', color: '#ff3636', bgTint: 'rgba(255, 57, 57, 0.1)', show: true }
    case 'high':
      return { label: 'High Water Stress', color: '#e97b35', bgTint: 'rgba(233, 123, 53, 0.1)', show: true }
    case 'moderate':
      return { label: 'Moderate Water Stress', color: '#eab308', bgTint: 'rgba(234, 179, 8, 0.1)', show: true }
    case 'low':
      return { label: 'Low Water Stress', color: '#22c55e', bgTint: 'rgba(34, 197, 94, 0.1)', show: false }
    case 'very_low':
      return { label: 'Very Low Water Stress', color: '#22c55e', bgTint: 'rgba(34, 197, 94, 0.1)', show: false }
    default:
      return { label: stress, color: '#6b7280', bgTint: 'rgba(107,114,128,0.1)', show: false }
  }
}

export function FactoryDetailPanel({ factory, onClose }: FactoryDetailPanelProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  // Sector display label
  const sectorLabels: Record<string, string> = {
    semiconductor: 'Semiconductor',
    battery: 'Battery',
    electric_vehicle: 'Electric Vehicle',
    data_center: 'Data Center',
    electronics: 'Electronics'
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    if (amount >= 1000000000) {
      return `$${(amount / 1000000000).toFixed(1)}B`
    }
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(0)}M`
    }
    return `$${amount.toLocaleString()}`
  }

  // Water stress info
  const stressInfo = getWaterStressInfo(factory.environmental_risk.water_stress)

  // Environmental impact color — use the stress color, fallback to risk score based
  const envColor = stressInfo.show ? stressInfo.color : '#ff2222'
  const envBg = stressInfo.show ? stressInfo.bgTint : 'rgba(255, 57, 57, 0.1)'

  return (
    <div className="widget-container">
      {/* Header - Figma style: Name as title, company + location as subtitle */}
      <div className="flex items-start justify-between pb-3">
        <div className="flex-1">
          <h2 className="text-[15px] font-bold mb-1" style={{ color: isDark ? '#fff' : '#000' }}>
            {factory.name}
          </h2>
          <div className="flex items-center gap-3 text-xs" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
            <span className="inline-flex items-center gap-1">
              <FactoryIcon size={14} />
              {factory.company}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin size={14} />
              {factory.location.city}, {factory.location.state}
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
        {/* LEFT COLUMN - Warning & Environmental */}
        <div className="flex-1 flex flex-col gap-3">
          {/* Warning Badge - Water Stress (only show for moderate+ stress) */}
          {stressInfo.show && (
            <div
              className="flex items-center justify-center gap-3 px-3 py-2 rounded-lg border border-solid w-full"
              style={{
                backgroundColor: stressInfo.color,
                borderColor: stressInfo.color,
                boxShadow: '0px 0px 8px 0px rgba(0,0,0,0.03)'
              }}
            >
              <AlertTriangle size={16} style={{ color: '#fff', height: '13.818px', width: '16px' }} />
              <span className="text-xs font-semibold text-white text-center">
                {stressInfo.label}
              </span>
            </div>
          )}

          {/* Environmental Impact Box */}
          <div className="flex flex-col items-start w-full">
            <div
              className="flex flex-col gap-3 items-start p-3 rounded-lg w-full"
              style={{
                backgroundColor: envBg,
                boxShadow: '0px 0px 8px 0px rgba(0,0,0,0.03)'
              }}
            >
              <div className="flex flex-col gap-1 items-start w-full">
                <div className="flex items-center gap-2 w-full">
                  <Thermometer size={20} style={{ color: envColor }} />
                  <span className="text-xs font-semibold text-center" style={{ color: envColor }}>
                    Environmental Impact
                  </span>
                </div>

                <div className="flex gap-1 items-start w-full text-xs">
                  <p className="flex-1 m-0" style={{ color: isDark ? '#9ca3af' : '#697487' }}>Climate Risk Score:</p>
                  <p className="flex-1 m-0 font-semibold text-right" style={{ color: isDark ? '#e5e7eb' : '#101728' }}>
                    {factory.environmental_risk.overall_risk_score.toFixed(1)}/10
                  </p>
                </div>

                <div className="flex gap-1 items-start w-full text-xs">
                  <p className="flex-1 m-0" style={{ color: isDark ? '#9ca3af' : '#697487' }}>Heat Risk:</p>
                  <p className="flex-1 m-0 font-semibold text-right" style={{ color: isDark ? '#e5e7eb' : '#101728' }}>
                    {factory.environmental_risk.heat_risk || 'Undefined'}
                  </p>
                </div>

                <div className="flex gap-1 items-start w-full text-xs">
                  <p className="flex-1 m-0" style={{ color: isDark ? '#9ca3af' : '#697487' }}>Drought Risk:</p>
                  <p className="flex-1 m-0 font-semibold text-right" style={{ color: isDark ? '#e5e7eb' : '#101728' }}>
                    {factory.environmental_risk.drought_risk || 'Undefined'}
                  </p>
                </div>

                <div className="flex gap-1 items-start w-full text-xs">
                  <p className="flex-1 m-0" style={{ color: isDark ? '#9ca3af' : '#697487' }}>Wildfire Risk:</p>
                  <p className="flex-1 m-0 font-semibold text-right" style={{ color: isDark ? '#e5e7eb' : '#101728' }}>
                    {factory.environmental_risk.wildfire_risk || 'Undefined'}
                  </p>
                </div>

                <div className="flex gap-1 items-start w-full text-xs">
                  <p className="flex-1 m-0" style={{ color: isDark ? '#9ca3af' : '#697487' }}>Water Risk:</p>
                  <p className="flex-1 m-0 font-semibold text-right" style={{ color: isDark ? '#e5e7eb' : '#101728' }}>
                    {factory.environmental_risk.water_risk || factory.environmental_risk.water_stress || 'Undefined'}
                  </p>
                </div>

                {/* Water Access - only show if actual data exists */}
                {factory.water_source && (
                  <div className="flex gap-1 items-start w-full text-xs">
                    <p className="flex-1 m-0" style={{ color: isDark ? '#9ca3af' : '#697487' }}>Water Access:</p>
                    <p className="flex-1 m-0 font-semibold text-right" style={{ color: isDark ? '#e5e7eb' : '#101728' }}>
                      {factory.water_source}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN - Supporting Info */}
        <div className="flex-1 flex flex-col gap-3 self-stretch">
          {/* Top Row */}
          <div className="flex flex-1 gap-3 items-center w-full">
            <div
              className="flex-1 flex gap-3 h-full items-start p-3 border-t border-solid"
              style={{
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
              }}
            >
              <div className="flex flex-col gap-1 items-start">
                <p className="m-0 text-[11px] font-normal" style={{ color: isDark ? '#9ca3af' : '#697487' }}>
                  Industry
                </p>
                <p className="m-0 text-xs font-semibold text-center" style={{ color: isDark ? '#e5e7eb' : '#101728' }}>
                  {sectorLabels[factory.sector] || factory.sector}
                </p>
              </div>
            </div>

            <div
              className="flex-1 flex gap-3 h-full items-start p-3 border-t border-solid"
              style={{
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
              }}
            >
              <div className="flex flex-col gap-1 items-start">
                <p className="m-0 text-[11px] font-normal" style={{ color: isDark ? '#9ca3af' : '#697487' }}>
                  Established
                </p>
                <p className="m-0 text-xs font-semibold text-center" style={{ color: isDark ? '#e5e7eb' : '#101728' }}>
                  {factory.timeline.announced ? new Date(factory.timeline.announced).getFullYear() : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Row */}
          <div className="flex flex-1 gap-3 items-center w-full">
            <div
              className="flex-1 flex gap-3 h-full items-start p-3 border-t border-solid"
              style={{
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
              }}
            >
              <div className="flex flex-col gap-1 items-start">
                <p className="m-0 text-[11px] font-normal" style={{ color: isDark ? '#9ca3af' : '#697487' }}>
                  Investment
                </p>
                <p className="m-0 text-xs font-semibold text-center" style={{ color: isDark ? '#e5e7eb' : '#101728' }}>
                  {formatCurrency(factory.investment.total)}
                </p>
              </div>
            </div>

            <div
              className="flex-1 flex gap-3 h-full items-start p-3 border-t border-solid"
              style={{
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
              }}
            >
              <div className="flex flex-col gap-1 items-start">
                <p className="m-0 text-[11px] font-normal" style={{ color: isDark ? '#9ca3af' : '#697487' }}>
                  Employees
                </p>
                <p className="m-0 text-xs font-semibold text-center" style={{ color: isDark ? '#e5e7eb' : '#101728' }}>
                  {factory.jobs.promised.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
