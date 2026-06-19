import React, { useCallback, useEffect, useState } from 'react'
import { useClimate } from '@climate-studio/core'
import { GitCompare, X } from 'lucide-react'
import {
  LocationSearchBar,
  type LocationSelection,
} from '../components/dashboard/LocationSearchBar'
import { getDefaultDashboardMetros } from '../utils/metroResolver'
import { LocationCityView } from '../components/dashboard/LocationCityView'
import { LocationCompareView } from '../components/dashboard/LocationCompareView'
import { Callout } from '../components/ui/callout'
import { Slider } from '../components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
import { PROJECTION_YEARS } from '../utils/metroChartData'
import {
  DASHBOARD_SCENARIOS,
  scenarioToSsp,
  sspToRcp,
  SSP_LABELS,
  type SspScenario,
} from '../utils/scenarioMapping'
import { cn } from '../lib/utils'
import { MAX_DASHBOARD_CITIES } from '../config/dashboard'

const COMPARE_TAB = '__compare__'

function defaultLocations(): LocationSelection[] {
  return getDefaultDashboardMetros().map(m => ({
    metroKey: m.key,
    metroName: m.name,
    lat: m.lat,
    lon: m.lon,
  }))
}

function defaultActiveTab(locations: LocationSelection[]): string {
  if (locations.length >= 2) return COMPARE_TAB
  return locations[0]?.metroKey ?? ''
}

interface CityTabTriggerProps {
  metroKey: string
  label: string
  isActive: boolean
  isLastCity: boolean
  onRemove: (metroKey: string) => void
}

function CityTabTrigger({ metroKey, label, isActive, isLastCity, onRemove }: CityTabTriggerProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-md border border-transparent',
        isActive && 'border-[#5a7cec] bg-[rgba(90,124,236,0.1)]'
      )}
    >
      <TabsTrigger
        value={metroKey}
        className={cn(
          'gap-1.5 rounded-md border-0 bg-transparent px-3 py-1.5 text-xs shadow-none',
          'data-[state=active]:border-0 data-[state=active]:bg-transparent data-[state=active]:shadow-none',
          isActive
            ? 'text-[#5a7cec]'
            : 'text-[var(--cs-text-secondary)] data-[state=active]:text-[var(--cs-text-secondary)]'
        )}
      >
        <span className="truncate">{label}</span>
      </TabsTrigger>
      <button
        type="button"
        aria-label={isLastCity ? 'Cannot remove last city' : `Close ${label}`}
        title={isLastCity ? 'At least one city must remain selected' : undefined}
        className={cn(
          "mr-1 shrink-0 rounded p-0.5",
          isLastCity
            ? "cursor-not-allowed text-[var(--cs-text-muted)] opacity-30"
            : "text-[var(--cs-text-tertiary)] hover:bg-[var(--cs-interactive-hover)] hover:text-[var(--cs-text-primary)]"
        )}
        onClick={() => !isLastCity && onRemove(metroKey)}
        disabled={isLastCity}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

const Dashboard: React.FC = () => {
  const { controls, setScenario, setProjectionYear } = useClimate()
  const [selectedLocations, setSelectedLocations] = useState<LocationSelection[]>(defaultLocations)
  const [activeTab, setActiveTab] = useState<string>(() => defaultActiveTab(defaultLocations()))

  const scenario = scenarioToSsp(controls.scenario)
  const projectionYear = controls.projectionYear

  const handleScenarioChange = (ssp: SspScenario) => {
    setScenario(sspToRcp(ssp))
  }

  const handleLocationSelect = useCallback((selection: LocationSelection) => {
    setSelectedLocations(prev => {
      if (prev.some(l => l.metroKey === selection.metroKey)) return prev
      if (prev.length >= MAX_DASHBOARD_CITIES) return prev
      return [...prev, selection]
    })
  }, [])

  const handleRemoveLocation = useCallback(
    (metroKey: string) => {
      setSelectedLocations(prev => {
        // Don't allow removing the last city
        if (prev.length <= 1) {
          return prev
        }
        const next = prev.filter(l => l.metroKey !== metroKey)
        if (activeTab === metroKey) {
          setActiveTab(next.length >= 2 ? COMPARE_TAB : next[0]?.metroKey ?? '')
        } else if (activeTab === COMPARE_TAB && next.length < 2) {
          setActiveTab(next[0]?.metroKey ?? '')
        }
        return next
      })
    },
    [activeTab]
  )

  useEffect(() => {
    if (!selectedLocations.length) {
      setActiveTab('')
      return
    }

    setActiveTab(current => {
      if (current === COMPARE_TAB && selectedLocations.length >= 2) return current
      if (selectedLocations.some(l => l.metroKey === current)) return current
      return selectedLocations.length >= 2 ? COMPARE_TAB : selectedLocations[0].metroKey
    })
  }, [selectedLocations])

  const existingMetroKeys = selectedLocations.map(l => l.metroKey)
  const showCompare = selectedLocations.length >= 2
  const atMetroLimit = selectedLocations.length >= MAX_DASHBOARD_CITIES

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value)
  }, [])

  const locationAnalysisControls = (
    <>
      <Callout
        status="warning"
        title="Preview"
        description="This dashboard is still in development. Some charts and metrics may be incomplete, redundant, or inaccurate."
      />
      <h2 className="cs-h2">Location Analysis</h2>
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[minmax(0,1fr)_11rem_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label className="text-xs font-medium text-[var(--cs-text-tertiary)]">
              Search Supported Metros
            </label>
            <span className="shrink-0 text-xs text-[var(--cs-text-tertiary)]">
              {selectedLocations.length}/{MAX_DASHBOARD_CITIES}
            </span>
          </div>
          <LocationSearchBar
            onSelect={handleLocationSelect}
            existingMetroKeys={existingMetroKeys}
            maxMetros={MAX_DASHBOARD_CITIES}
          />
          {atMetroLimit && (
            <p className="mt-1.5 text-xs text-[var(--cs-text-tertiary)]">
              Metro limit reached. Remove a tab to add another.
            </p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--cs-text-tertiary)]">
            Scenario
          </label>
          <Select
            value={scenario}
            onValueChange={value => handleScenarioChange(value as SspScenario)}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DASHBOARD_SCENARIOS.map(ssp => (
                <SelectItem key={ssp} value={ssp}>
                  {SSP_LABELS[ssp]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-0">
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-medium text-[var(--cs-text-tertiary)]">
              Projection year
            </label>
            <span className="text-sm font-semibold text-[var(--cs-tone-orange-text)]">
              {projectionYear}
            </span>
          </div>
          <Slider
            value={[projectionYear]}
            onValueChange={([v]) => setProjectionYear(v)}
            min={PROJECTION_YEARS[0]}
            max={PROJECTION_YEARS[PROJECTION_YEARS.length - 1]}
            step={10}
          />
        </div>
      </div>
    </>
  )

  const metroTabsList = selectedLocations.length > 0 ? (
    <TabsList className="dashboard-tabs-list h-auto w-full flex-wrap justify-start border-0 bg-transparent p-0 shadow-none backdrop-blur-none">
      {showCompare && (
        <TabsTrigger
          value={COMPARE_TAB}
          className={cn(
            'gap-1.5 text-xs',
            'data-[state=active]:border-[#5a7cec]',
            'data-[state=active]:bg-[rgba(90,124,236,0.1)]',
            'data-[state=active]:text-[#5a7cec]',
            'data-[state=active]:shadow-none'
          )}
        >
          <GitCompare className="h-3 w-3" />
          Compare
        </TabsTrigger>
      )}
      {selectedLocations.map(loc => (
        <CityTabTrigger
          key={loc.metroKey}
          metroKey={loc.metroKey}
          label={loc.metroName}
          isActive={activeTab === loc.metroKey}
          isLastCity={selectedLocations.length === 1}
          onRemove={handleRemoveLocation}
        />
      ))}
    </TabsList>
  ) : null

  const compareView = (
    <LocationCompareView
      locations={selectedLocations}
      scenario={scenario}
      projectionYear={projectionYear}
    />
  )

  return (
    <div className="dashboard-page">
      <div className="dashboard-page-inner flex flex-col gap-4">
        {selectedLocations.length === 0 ? (
          <>
            <div className="widget-container shrink-0 flex flex-col gap-4">
              {locationAnalysisControls}
            </div>
            <div className="widget-container py-12 text-center text-sm text-[var(--cs-text-tertiary)]">
              Choose a supported metro above to add it to the dashboard.
            </div>
          </>
        ) : (
          <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col gap-4">
            <div className="widget-container shrink-0 flex flex-col gap-4">
              {locationAnalysisControls}
              {metroTabsList && (
                <div className="border-t border-[var(--widget-border)] pt-4">
                  {metroTabsList}
                </div>
              )}
            </div>

            {/* Only mount the active panel — hidden Radix tabs kept stale Recharts line layers alive */}
            {showCompare && activeTab === COMPARE_TAB && (
              <div className="mt-0">{compareView}</div>
            )}

            {selectedLocations.map(loc =>
              activeTab === loc.metroKey ? (
                <div key={loc.metroKey} className="mt-0">
                  <LocationCityView
                    location={loc}
                    scenario={scenario}
                    projectionYear={projectionYear}
                  />
                </div>
              ) : null
            )}
          </Tabs>
        )}
      </div>
    </div>
  )
}

export default Dashboard
