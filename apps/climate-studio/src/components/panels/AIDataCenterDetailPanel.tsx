// AI Data Center Detail Panel - Comprehensive data center information with energy impact
import { X, AlertTriangle, CheckCircle2, XCircle, Clock, DollarSign, Users, MapPin, Zap, Globe, Cpu, Droplet, Thermometer, Server, BatteryCharging, Wind, TrendingUp, Shield } from 'lucide-react'
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

  // Power capacity risk level (matching Factory risk score structure)
  const getPowerRiskScore = (mw: number) => {
    if (mw >= 1000) return 9
    if (mw >= 500) return 7
    if (mw >= 200) return 5
    return 3
  }

  const powerRiskScore = getPowerRiskScore(datacenter.power_capacity_mw)

  const getRiskColor = (score: number) => {
    if (score < 3) return '#22c55e'
    if (score < 5) return '#eab308'
    if (score < 7) return '#f97316'
    return '#ef4444'
  }

  const getRiskLabel = (score: number) => {
    if (score < 3) return 'Low Impact'
    if (score < 5) return 'Moderate Impact'
    if (score < 7) return 'High Impact'
    return 'Critical Impact'
  }

  // Status badge
  const getStatusBadge = () => {
    switch (datacenter.status) {
      case 'operational':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-800"><CheckCircle2 size={12} /> Operational</span>
      case 'under_construction':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800"><Clock size={12} /> Under Construction</span>
      case 'announced':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-purple-100 text-purple-800"><Clock size={12} /> Announced</span>
      case 'paused':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-yellow-100 text-yellow-800"><AlertTriangle size={12} /> Paused</span>
      case 'cancelled':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-800"><XCircle size={12} /> Cancelled</span>
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-800">{datacenter.status}</span>
    }
  }

  // Purpose/Use case badge
  const getPurposeBadge = () => {
    const purposeColors: Record<string, string> = {
      'AI Training': 'bg-indigo-100 text-indigo-800',
      'AI Inference': 'bg-purple-100 text-purple-800',
      'Mixed Use': 'bg-cyan-100 text-cyan-800',
      'Cloud Services': 'bg-blue-100 text-blue-800',
      'Enterprise': 'bg-emerald-100 text-emerald-800'
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${purposeColors[datacenter.purpose] || 'bg-gray-100 text-gray-800'}`}>
        <Cpu size={12} />
        {datacenter.purpose}
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

  // Format large numbers
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`
    return num.toLocaleString()
  }

  // Grid strain colors
  const getGridStrainColor = (strain: string) => {
    switch (strain.toLowerCase()) {
      case 'critical': return '#ef4444'
      case 'high': return '#f97316'
      case 'moderate': return '#eab308'
      case 'low': return '#22c55e'
      default: return '#6b7280'
    }
  }

  // Cost per job calculation
  const costPerJob = datacenter.jobs.permanent > 0
    ? datacenter.investment_usd / datacenter.jobs.permanent
    : 0

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
              {datacenter.company}
            </h2>
            <p className="text-sm mb-2" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
              {datacenter.name}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {getStatusBadge()}
              {getPurposeBadge()}
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-yellow-100 text-yellow-800">
                <Zap size={12} /> {datacenter.power_capacity_mw} MW
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
              {datacenter.location.city}, {datacenter.location.state}
              {datacenter.location.county && ` (${datacenter.location.county} County)`}
            </div>
            <div className="text-xs" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
              {datacenter.location.coordinates.lat.toFixed(4)}°N, {Math.abs(datacenter.location.coordinates.lon).toFixed(4)}°W
            </div>
          </div>
        </section>

        {/* Energy Impact Score - PROMINENT (matching Factory Climate Risk) */}
        <section className="p-4 rounded-lg border-2" style={{
          backgroundColor: isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.5)',
          borderColor: getRiskColor(powerRiskScore)
        }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-lg" style={{ color: isDark ? '#fff' : '#000' }}>
              Energy Impact Score
            </h3>
            <div className="text-4xl font-bold" style={{ color: getRiskColor(powerRiskScore) }}>
              {powerRiskScore.toFixed(1)}
            </div>
          </div>
          <div className="mb-3">
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full transition-all"
                style={{
                  width: `${(powerRiskScore / 10) * 100}%`,
                  backgroundColor: getRiskColor(powerRiskScore)
                }}
              />
            </div>
          </div>
          <div className="text-sm font-semibold" style={{ color: getRiskColor(powerRiskScore) }}>
            {getRiskLabel(powerRiskScore)}
          </div>
          <div className="text-xs mt-2" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
            Power Equivalent: <span className="font-semibold">{datacenter.environmental_impact.power_equivalent}</span>
          </div>

          {/* Environmental Impact Breakdown */}
          <div className="mt-4 pt-4 border-t space-y-2" style={{ borderColor: isDark ? '#374151' : '#d1d5db' }}>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1" style={{ color: isDark ? '#d1d5db' : '#374151' }}>
                <Zap size={12} />
                Power Capacity
              </span>
              <span className="font-semibold">
                {datacenter.power_capacity_mw} MW
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1" style={{ color: isDark ? '#d1d5db' : '#374151' }}>
                <BatteryCharging size={12} />
                Annual Electricity
              </span>
              <span className="font-semibold">
                {formatNumber(datacenter.environmental_impact.annual_electricity_mwh)} MWh/year
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1" style={{ color: isDark ? '#d1d5db' : '#374151' }}>
                <Droplet size={12} />
                Water Usage
              </span>
              <span className="font-semibold">
                {(datacenter.environmental_impact.water_usage_gallons_per_day / 1000000).toFixed(1)}M gal/day
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1" style={{ color: isDark ? '#d1d5db' : '#374151' }}>
                <Wind size={12} />
                Grid Strain
              </span>
              <span className={`font-semibold uppercase ${datacenter.environmental_impact.grid_strain.toLowerCase() === 'critical' ? 'text-red-600' : datacenter.environmental_impact.grid_strain.toLowerCase() === 'high' ? 'text-orange-600' : 'text-green-600'}`}>
                {datacenter.environmental_impact.grid_strain}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1" style={{ color: isDark ? '#d1d5db' : '#374151' }}>
                <Thermometer size={12} />
                Cooling System
              </span>
              <span className="font-semibold">
                {datacenter.cooling_type}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs pt-2 border-t" style={{ borderColor: isDark ? '#374151' : '#d1d5db' }}>
              <span style={{ color: isDark ? '#d1d5db' : '#374151' }}>
                Power Source
              </span>
              <span className="font-semibold">{datacenter.power_source}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: isDark ? '#d1d5db' : '#374151' }}>
                Carbon Offset Commitment
              </span>
              <span className={`font-semibold ${datacenter.environmental_impact.carbon_offset_commitment ? 'text-green-600' : 'text-red-600'}`}>
                {datacenter.environmental_impact.carbon_offset_commitment ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        </section>

        {/* Compute Infrastructure */}
        <section>
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: isDark ? '#fff' : '#000' }}>
            <Server size={16} />
            Compute Infrastructure
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>GPU/Accelerator Count</span>
              <span className="font-bold" style={{ color: isDark ? '#fff' : '#000' }}>
                {formatNumber(datacenter.gpu_count)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Hardware Type</span>
              <span className="font-semibold" style={{ color: isDark ? '#d1d5db' : '#374151' }}>
                {datacenter.gpu_type}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Campus Size</span>
              <span className="font-semibold" style={{ color: isDark ? '#d1d5db' : '#374151' }}>
                {datacenter.campus_acres.toLocaleString()} acres
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Building Space</span>
              <span className="font-semibold" style={{ color: isDark ? '#d1d5db' : '#374151' }}>
                {formatNumber(datacenter.building_sqft)} sq ft
              </span>
            </div>
          </div>
        </section>

        {/* Investment */}
        <section>
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: isDark ? '#fff' : '#000' }}>
            <DollarSign size={16} />
            Investment
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Total Investment</span>
              <span className="font-bold" style={{ color: isDark ? '#fff' : '#000' }}>
                {formatCurrency(datacenter.investment_usd)}
              </span>
            </div>
            {costPerJob > 0 && (
              <div className="flex justify-between text-sm pt-2 border-t" style={{ borderColor: isDark ? '#374151' : '#d1d5db' }}>
                <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Investment Per Permanent Job</span>
                <span className="font-semibold" style={{ color: costPerJob > 5000000 ? '#ef4444' : isDark ? '#fff' : '#000' }}>
                  {formatCurrency(costPerJob)}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Jobs */}
        <section>
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: isDark ? '#fff' : '#000' }}>
            <Users size={16} />
            Jobs
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Permanent Jobs</span>
              <span className="font-semibold" style={{ color: isDark ? '#fff' : '#000' }}>
                {datacenter.jobs.permanent.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Construction Jobs</span>
              <span className="font-semibold" style={{ color: isDark ? '#fff' : '#000' }}>
                {datacenter.jobs.construction.toLocaleString()}
              </span>
            </div>
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
                {new Date(datacenter.timeline.announced).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
              </span>
            </div>
            {datacenter.timeline.construction_start && (
              <div className="flex justify-between">
                <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Construction Started</span>
                <span style={{ color: isDark ? '#d1d5db' : '#374151' }}>
                  {new Date(datacenter.timeline.construction_start).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                </span>
              </div>
            )}
            {datacenter.timeline.operational && (
              <div className="flex justify-between">
                <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Operational</span>
                <span className="font-semibold text-green-600">
                  {new Date(datacenter.timeline.operational).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                </span>
              </div>
            )}
            {datacenter.timeline.expected_operational && (
              <div className="flex justify-between">
                <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Expected Operational</span>
                <span style={{ color: isDark ? '#d1d5db' : '#374151' }}>
                  {new Date(datacenter.timeline.expected_operational).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Notes */}
        {datacenter.notes && (
          <section className="p-4 rounded-lg" style={{
            backgroundColor: isDark ? 'rgba(90, 124, 236, 0.1)' : 'rgba(90, 124, 236, 0.05)',
            border: `1px solid ${isDark ? 'rgba(90, 124, 236, 0.3)' : 'rgba(90, 124, 236, 0.2)'}`
          }}>
            <h3 className="font-semibold text-sm mb-2" style={{ color: isDark ? '#fff' : '#000' }}>
              Additional Information
            </h3>
            <p className="text-sm" style={{ color: isDark ? '#d1d5db' : '#374151' }}>
              {datacenter.notes}
            </p>
          </section>
        )}
      </div>
    </div>
  )
}
