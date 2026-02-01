// Factory Detail Panel - Comprehensive factory information with deep insights
import { X, TrendingDown, TrendingUp, AlertTriangle, CheckCircle2, XCircle, Clock, DollarSign, Users, MapPin, Factory as FactoryIcon, Globe, Shield, Droplet, Thermometer, Wind } from 'lucide-react'
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

export function FactoryDetailPanel({ factory, onClose }: FactoryDetailPanelProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  // Risk score colors and labels
  const getRiskColor = (score: number) => {
    if (score < 3) return '#22c55e'
    if (score < 5) return '#eab308'
    if (score < 7) return '#f97316'
    return '#ef4444'
  }

  const getRiskLabel = (score: number) => {
    if (score < 3) return 'Low Risk'
    if (score < 5) return 'Moderate Risk'
    if (score < 7) return 'High Risk'
    return 'Critical Risk'
  }

  // Status badge
  const getStatusBadge = () => {
    switch (factory.status) {
      case 'operational':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-800"><CheckCircle2 size={12} /> Operational</span>
      case 'under_construction':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800"><Clock size={12} /> Under Construction</span>
      case 'announced':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-purple-100 text-purple-800"><Clock size={12} /> Announced</span>
      case 'paused':
      case 'PAUSED':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-yellow-100 text-yellow-800"><AlertTriangle size={12} /> Paused</span>
      case 'failed':
      case 'FAILED':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-800"><XCircle size={12} /> Failed</span>
      case 'AT RISK':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-orange-100 text-orange-800"><AlertTriangle size={12} /> At Risk</span>
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-800">{factory.status}</span>
    }
  }

  // Sector badge
  const getSectorBadge = () => {
    const sectorColors: Record<string, string> = {
      semiconductor: 'bg-indigo-100 text-indigo-800',
      battery: 'bg-amber-100 text-amber-800',
      electric_vehicle: 'bg-emerald-100 text-emerald-800',
      data_center: 'bg-cyan-100 text-cyan-800',
      electronics: 'bg-violet-100 text-violet-800'
    }

    const sectorLabels: Record<string, string> = {
      semiconductor: 'Semiconductor',
      battery: 'Battery',
      electric_vehicle: 'Electric Vehicle',
      data_center: 'Data Center',
      electronics: 'Electronics'
    }

    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${sectorColors[factory.sector] || 'bg-gray-100 text-gray-800'}`}>
        {sectorLabels[factory.sector] || factory.sector}
      </span>
    )
  }

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

  // Jobs delivery rate
  const jobsDeliveryRate = factory.jobs.actual
    ? Math.round((factory.jobs.actual / factory.jobs.promised) * 100)
    : 0

  const jobsDeliveryColor = jobsDeliveryRate >= 80 ? '#22c55e' : jobsDeliveryRate >= 50 ? '#eab308' : '#ef4444'

  // Ownership flag
  const getOwnershipFlag = () => {
    if (factory.ownership.type === 'domestic') {
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800"><Shield size={12} /> US Owned</span>
    }
    if (factory.ownership.state_backed) {
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-800"><AlertTriangle size={12} /> Foreign State-Backed</span>
    }
    return <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-orange-100 text-orange-800"><Globe size={12} /> Foreign Owned ({factory.ownership.country})</span>
  }

  return (
    <div
      className="w-full max-h-[60vh] overflow-y-auto rounded-lg backdrop-blur-md shadow-xl"
      style={{
        backgroundColor: isDark ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.95)',
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
      }}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-md border-b p-4"
        style={{
          backgroundColor: isDark ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.95)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
        }}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-xl font-bold mb-1" style={{ color: isDark ? '#fff' : '#000' }}>
              {factory.company}
            </h2>
            <p className="text-sm mb-2" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
              {factory.name}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {getStatusBadge()}
              {getSectorBadge()}
              {getOwnershipFlag()}
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
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Location */}
        <section>
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2" style={{ color: isDark ? '#fff' : '#000' }}>
            <MapPin size={16} />
            Location
          </h3>
          <div className="text-sm space-y-1">
            <div style={{ color: isDark ? '#d1d5db' : '#374151' }}>
              {factory.location.city}, {factory.location.state}
            </div>
            <div className="text-xs" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
              {factory.location.coordinates.lat.toFixed(4)}°N, {factory.location.coordinates.lon.toFixed(4)}°W
            </div>
          </div>
        </section>

        {/* Climate Risk Score - PROMINENT */}
        <section className="p-4 rounded-lg border-2" style={{
          backgroundColor: isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.5)',
          borderColor: getRiskColor(factory.environmental_risk.overall_risk_score)
        }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-lg" style={{ color: isDark ? '#fff' : '#000' }}>
              Climate Risk Score
            </h3>
            <div className="text-4xl font-bold" style={{ color: getRiskColor(factory.environmental_risk.overall_risk_score) }}>
              {factory.environmental_risk.overall_risk_score.toFixed(1)}
            </div>
          </div>
          <div className="mb-3">
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full transition-all"
                style={{
                  width: `${(factory.environmental_risk.overall_risk_score / 10) * 100}%`,
                  backgroundColor: getRiskColor(factory.environmental_risk.overall_risk_score)
                }}
              />
            </div>
          </div>
          <div className="text-sm font-semibold" style={{ color: getRiskColor(factory.environmental_risk.overall_risk_score) }}>
            {getRiskLabel(factory.environmental_risk.overall_risk_score)}
          </div>
          <div className="text-xs mt-2" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
            2040 Projection: <span className="font-semibold">{factory.environmental_risk.climate_projection_2040}</span>
          </div>

          {/* Environmental Risk Breakdown */}
          <div className="mt-4 pt-4 border-t space-y-2" style={{ borderColor: isDark ? '#374151' : '#d1d5db' }}>
            {factory.environmental_risk.water_stress && (
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1" style={{ color: isDark ? '#d1d5db' : '#374151' }}>
                  <Droplet size={12} />
                  Water Stress
                </span>
                <span className={`font-semibold uppercase ${factory.environmental_risk.water_stress === 'extreme' ? 'text-red-600' : factory.environmental_risk.water_stress === 'high' ? 'text-orange-600' : 'text-green-600'}`}>
                  {factory.environmental_risk.water_stress}
                </span>
              </div>
            )}
            {factory.environmental_risk.heat_risk && (
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1" style={{ color: isDark ? '#d1d5db' : '#374151' }}>
                  <Thermometer size={12} />
                  Heat Risk
                </span>
                <span className={`font-semibold uppercase ${factory.environmental_risk.heat_risk === 'extreme' ? 'text-red-600' : factory.environmental_risk.heat_risk === 'high' ? 'text-orange-600' : 'text-green-600'}`}>
                  {factory.environmental_risk.heat_risk}
                </span>
              </div>
            )}
            {factory.environmental_risk.drought_risk && (
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1" style={{ color: isDark ? '#d1d5db' : '#374151' }}>
                  <Wind size={12} />
                  Drought Risk
                </span>
                <span className={`font-semibold uppercase ${factory.environmental_risk.drought_risk === 'extreme' ? 'text-red-600' : factory.environmental_risk.drought_risk === 'high' ? 'text-orange-600' : 'text-green-600'}`}>
                  {factory.environmental_risk.drought_risk}
                </span>
              </div>
            )}
            {factory.environmental_risk.water_usage_gallons_per_day && (
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: isDark ? '#d1d5db' : '#374151' }}>
                  Water Usage
                </span>
                <span className="font-semibold">
                  {(factory.environmental_risk.water_usage_gallons_per_day / 1000000).toFixed(1)}M gal/day
                </span>
              </div>
            )}
            {factory.water_source && (
              <div className="text-xs mt-2 pt-2 border-t" style={{ borderColor: isDark ? '#374151' : '#d1d5db', color: isDark ? '#9ca3af' : '#6b7280' }}>
                <strong>Water Source:</strong> {factory.water_source}
              </div>
            )}
          </div>
        </section>

        {/* Investment & Incentives */}
        <section>
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: isDark ? '#fff' : '#000' }}>
            <DollarSign size={16} />
            Investment & Incentives
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Total Investment</span>
              <span className="font-bold" style={{ color: isDark ? '#fff' : '#000' }}>
                {formatCurrency(factory.investment.total)}
              </span>
            </div>
            {factory.investment.chips_act_grant && (
              <div className="flex justify-between text-sm">
                <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>CHIPS Act Grant</span>
                <span className="font-semibold text-blue-600">
                  {formatCurrency(factory.investment.chips_act_grant)}
                </span>
              </div>
            )}
            {factory.investment.chips_act_loan && (
              <div className="flex justify-between text-sm">
                <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>CHIPS Act Loan</span>
                <span className="font-semibold text-indigo-600">
                  {formatCurrency(factory.investment.chips_act_loan)}
                </span>
              </div>
            )}
            {factory.incentives?.total_state_local && (
              <div className="flex justify-between text-sm">
                <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>State/Local Incentives</span>
                <span className="font-semibold text-purple-600">
                  {formatCurrency(factory.incentives.total_state_local)}
                </span>
              </div>
            )}
            {factory.incentives?.cost_per_job && (
              <div className="flex justify-between text-sm pt-2 border-t" style={{ borderColor: isDark ? '#374151' : '#d1d5db' }}>
                <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Cost Per Job</span>
                <span className="font-semibold" style={{ color: factory.incentives.cost_per_job > 300000 ? '#ef4444' : isDark ? '#fff' : '#000' }}>
                  {formatCurrency(factory.incentives.cost_per_job)}
                </span>
              </div>
            )}
          </div>

          {/* Incentive Breakdown (if available) */}
          {factory.incentives && (factory.incentives.property_tax_abatement || factory.incentives.infrastructure_investment || factory.incentives.workforce_training) && (
            <div className="mt-3 pt-3 border-t space-y-2 text-xs" style={{ borderColor: isDark ? '#374151' : '#d1d5db' }}>
              <div className="font-semibold" style={{ color: isDark ? '#fff' : '#000' }}>Incentive Breakdown:</div>
              {factory.incentives.property_tax_abatement && (
                <div className="flex justify-between">
                  <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Property Tax Abatement</span>
                  <span>{formatCurrency(factory.incentives.property_tax_abatement)}</span>
                </div>
              )}
              {factory.incentives.infrastructure_investment && (
                <div className="flex justify-between">
                  <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Infrastructure Investment</span>
                  <span>{formatCurrency(factory.incentives.infrastructure_investment)}</span>
                </div>
              )}
              {factory.incentives.workforce_training && (
                <div className="flex justify-between">
                  <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Workforce Training</span>
                  <span>{formatCurrency(factory.incentives.workforce_training)}</span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Jobs */}
        <section>
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: isDark ? '#fff' : '#000' }}>
            <Users size={16} />
            Jobs
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Promised</span>
              <span className="font-semibold" style={{ color: isDark ? '#fff' : '#000' }}>
                {factory.jobs.promised.toLocaleString()}
              </span>
            </div>
            {factory.jobs.actual !== undefined && (
              <>
                <div className="flex justify-between text-sm">
                  <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Delivered</span>
                  <span className="font-semibold" style={{ color: jobsDeliveryColor }}>
                    {factory.jobs.actual.toLocaleString()}
                  </span>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Delivery Rate</span>
                    <span className="font-semibold" style={{ color: jobsDeliveryColor }}>
                      {jobsDeliveryRate}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${jobsDeliveryRate}%`,
                        backgroundColor: jobsDeliveryColor
                      }}
                    />
                  </div>
                </div>
              </>
            )}
            {factory.jobs.construction && (
              <div className="flex justify-between text-sm">
                <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Construction Jobs</span>
                <span className="font-semibold" style={{ color: isDark ? '#fff' : '#000' }}>
                  {factory.jobs.construction.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Timeline */}
        <section>
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: isDark ? '#fff' : '#000' }}>
            <Clock size={16} />
            Timeline
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Announced</span>
              <span style={{ color: isDark ? '#d1d5db' : '#374151' }}>
                {new Date(factory.timeline.announced).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
              </span>
            </div>
            {factory.timeline.construction_start && (
              <div className="flex justify-between">
                <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Construction Started</span>
                <span style={{ color: isDark ? '#d1d5db' : '#374151' }}>
                  {new Date(factory.timeline.construction_start).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                </span>
              </div>
            )}
            {factory.timeline.operational && (
              <div className="flex justify-between">
                <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Operational</span>
                <span className="font-semibold text-green-600">
                  {new Date(factory.timeline.operational).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                </span>
              </div>
            )}
            {factory.timeline.expected_operational && (
              <div className="flex justify-between">
                <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Expected Operational</span>
                <span style={{ color: isDark ? '#d1d5db' : '#374151' }}>
                  {new Date(factory.timeline.expected_operational).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                </span>
              </div>
            )}
            {factory.timeline.paused && (
              <div className="flex justify-between">
                <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Paused</span>
                <span className="font-semibold text-yellow-600">
                  {new Date(factory.timeline.paused).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                </span>
              </div>
            )}
            {factory.timeline.failed && (
              <div className="flex justify-between">
                <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Failed</span>
                <span className="font-semibold text-red-600">
                  {new Date(factory.timeline.failed).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Ownership */}
        <section>
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: isDark ? '#fff' : '#000' }}>
            <Globe size={16} />
            Ownership
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Type</span>
              <span className="font-semibold capitalize" style={{ color: isDark ? '#d1d5db' : '#374151' }}>
                {factory.ownership.type.replace('_', ' ')}
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Country</span>
              <span className="font-semibold" style={{ color: isDark ? '#d1d5db' : '#374151' }}>
                {factory.ownership.country}
              </span>
            </div>
            {factory.ownership.parent_company && (
              <div className="flex justify-between">
                <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Parent Company</span>
                <span className="font-semibold" style={{ color: isDark ? '#d1d5db' : '#374151' }}>
                  {factory.ownership.parent_company}
                </span>
              </div>
            )}
            {factory.ownership.state_backed && (
              <div className="mt-2 p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-2 text-xs font-semibold text-red-700 dark:text-red-400">
                  <AlertTriangle size={14} />
                  State-Backed Entity
                </div>
              </div>
            )}
            {factory.ownership.major_foreign_investor && (
              <div className="mt-2 text-xs" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                <strong>Major Investor:</strong> {factory.ownership.major_foreign_investor}
              </div>
            )}
          </div>
        </section>

        {/* National Security Concerns */}
        {factory.national_security_flags && factory.national_security_flags.length > 0 && (
          <section className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2 text-red-700 dark:text-red-400">
              <Shield size={16} />
              National Security Concerns
            </h3>
            <ul className="space-y-2 text-xs">
              {factory.national_security_flags.map((flag, idx) => (
                <li key={idx} className="flex items-start gap-2 text-red-700 dark:text-red-400">
                  <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                  <span>{flag}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Proximity Concerns */}
        {factory.proximity_concerns && (factory.proximity_concerns.military_bases_within_50mi || factory.proximity_concerns.sensitive_infrastructure) && (
          <section>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: isDark ? '#fff' : '#000' }}>
              <MapPin size={16} />
              Proximity Concerns
            </h3>
            <div className="space-y-2 text-xs">
              {factory.proximity_concerns.military_bases_within_50mi && factory.proximity_concerns.military_bases_within_50mi.length > 0 && (
                <div>
                  <div className="font-semibold mb-1" style={{ color: isDark ? '#d1d5db' : '#374151' }}>
                    Military Bases (within 50mi):
                  </div>
                  <ul className="list-disc list-inside space-y-1" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                    {factory.proximity_concerns.military_bases_within_50mi.map((base, idx) => (
                      <li key={idx}>{base}</li>
                    ))}
                  </ul>
                </div>
              )}
              {factory.proximity_concerns.sensitive_infrastructure && factory.proximity_concerns.sensitive_infrastructure.length > 0 && (
                <div>
                  <div className="font-semibold mb-1" style={{ color: isDark ? '#d1d5db' : '#374151' }}>
                    Sensitive Infrastructure:
                  </div>
                  <ul className="list-disc list-inside space-y-1" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                    {factory.proximity_concerns.sensitive_infrastructure.map((infra, idx) => (
                      <li key={idx}>{infra}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Community Impact (for failed projects) */}
        {factory.community_impact && (
          <section className="p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-800">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2 text-orange-700 dark:text-orange-400">
              <AlertTriangle size={16} />
              Community Impact
            </h3>
            <div className="space-y-2 text-xs text-orange-700 dark:text-orange-400">
              {factory.community_impact.homes_demolished && (
                <div>
                  <strong>Homes Demolished:</strong> {factory.community_impact.homes_demolished}
                </div>
              )}
              {factory.community_impact.land_seized_acres && (
                <div>
                  <strong>Land Seized:</strong> {factory.community_impact.land_seized_acres.toLocaleString()} acres
                </div>
              )}
              {factory.community_impact.environmental_damage && (
                <div>
                  <strong>Environmental Damage:</strong> {factory.community_impact.environmental_damage}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Assessment */}
        {factory.assessment && (
          <section className="p-4 rounded-lg" style={{
            backgroundColor: isDark ? 'rgba(90, 124, 236, 0.1)' : 'rgba(90, 124, 236, 0.05)',
            border: `1px solid ${isDark ? 'rgba(90, 124, 236, 0.3)' : 'rgba(90, 124, 236, 0.2)'}`
          }}>
            <h3 className="font-semibold text-sm mb-2" style={{ color: isDark ? '#fff' : '#000' }}>
              Assessment
            </h3>
            <p className="text-sm" style={{ color: isDark ? '#d1d5db' : '#374151' }}>
              {factory.assessment}
            </p>
          </section>
        )}

        {/* Status Notes */}
        {factory.status_notes && (
          <section>
            <h3 className="font-semibold text-sm mb-2" style={{ color: isDark ? '#fff' : '#000' }}>
              Status Notes
            </h3>
            <p className="text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
              {factory.status_notes}
            </p>
          </section>
        )}
      </div>
    </div>
  )
}
