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
import { DashboardMapBackground } from '../components/dashboard/DashboardMapBackground'
import { Callout } from '../components/ui/callout'
import { Slider } from '../components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { PROJECTION_YEARS } from '../utils/metroChartData'
import {
  DASHBOARD_SCENARIOS,
  scenarioToSsp,
  sspToRcp,
  SSP_LABELS,
  type SspScenario,
} from '../utils/scenarioMapping'
import { cn } from '../lib/utils'

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
  return locations.length >= 2 ? COMPARE_TAB : (locations[0]?.metroKey ?? '')
}

interface CityTabTriggerProps {
  metroKey: string
  label: string
  onRemove: (metroKey: string) => void
}

function CityTabTrigger({ metroKey, label, onRemove }: CityTabTriggerProps) {
  return (
    <TabsTrigger
      value={metroKey}
      className={cn(
        'gap-1.5 pr-1.5 text-xs',
        'data-[state=active]:border-[var(--cs-border-default)]',
        'data-[state=active]:bg-[var(--cs-surface-elevated)]',
        'data-[state=active]:shadow-[var(--cs-shadow-sm)]'
      )}
    >
      <span className="truncate">{label}</span>
      <span
        role="button"
        tabIndex={0}
        aria-label={`Close ${label}`}
        className="ml-0.5 shrink-0 rounded p-0.5 text-[var(--cs-text-tertiary)] hover:bg-[var(--cs-interactive-hover)] hover:text-[var(--cs-text-primary)]"
        onPointerDown={e => e.stopPropagation()}
        onClick={e => {
          e.preventDefault()
          e.stopPropagation()
          onRemove(metroKey)
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            e.stopPropagation()
            onRemove(metroKey)
          }
        }}
      >
        <X className="h-3 w-3" />
      </span>
    </TabsTrigger>
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
      return [...prev, selection]
    })
    setActiveTab(selection.metroKey)
  }, [])

  const handleRemoveLocation = useCallback(
    (metroKey: string) => {
      setSelectedLocations(prev => {
        const next = prev.filter(l => l.metroKey !== metroKey)
        if (activeTab === metroKey) {
          setActiveTab(next[0]?.metroKey ?? '')
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

    const activeCityTab = selectedLocations.some(l => l.metroKey === activeTab)
    if (activeTab === COMPARE_TAB && selectedLocations.length >= 2) return
    if (activeCityTab) return

    setActiveTab(
      selectedLocations.length >= 2 ? COMPARE_TAB : selectedLocations[0].metroKey
    )
  }, [selectedLocations, activeTab])

  const existingMetroKeys = selectedLocations.map(l => l.metroKey)
  const showCompare = selectedLocations.length >= 2

  return (
    <div className="dashboard-page">
      <DashboardMapBackground />
      <div className="dashboard-page-inner flex flex-col">
        <div className="widget-container mb-4 shrink-0">
          <Callout
            status="warning"
            className="mb-4"
            title="Test preview"
            description="This dashboard is for exploration. I am still working on displayed data."
          />
          <h2 className="cs-h2 mb-4">Location Analysis</h2>
          <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-[minmax(0,1fr)_11rem_minmax(0,1fr)]">
            <div className="min-w-0">
              <label className="mb-1.5 block text-xs font-medium text-[var(--cs-text-tertiary)]">
                Search Supported Metros
              </label>
              <LocationSearchBar
                onSelect={handleLocationSelect}
                existingMetroKeys={existingMetroKeys}
              />
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
        </div>

        <div className="dashboard-shadow-bleed flex-1">
          {selectedLocations.length === 0 ? (
            <div className="widget-container py-12 text-center text-sm text-[var(--cs-text-tertiary)]">
              Choose a supported metro above to add it to the dashboard.
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col gap-4">
              <TabsList className="dashboard-tabs-list h-auto w-full flex-wrap justify-start">
                {showCompare && (
                  <TabsTrigger value={COMPARE_TAB} className="gap-1.5 text-xs">
                    <GitCompare className="h-3 w-3" />
                    Compare
                  </TabsTrigger>
                )}
                {selectedLocations.map(loc => (
                  <CityTabTrigger
                    key={loc.metroKey}
                    metroKey={loc.metroKey}
                    label={loc.metroName}
                    onRemove={handleRemoveLocation}
                  />
                ))}
              </TabsList>

              {selectedLocations.map(loc => (
                <TabsContent key={loc.metroKey} value={loc.metroKey} className="mt-0">
                  <LocationCityView
                    location={loc}
                    scenario={scenario}
                    projectionYear={projectionYear}
                  />
                </TabsContent>
              ))}

              {showCompare && (
                <TabsContent value={COMPARE_TAB} className="mt-0">
                  <LocationCompareView
                    locations={selectedLocations}
                    scenario={scenario}
                    projectionYear={projectionYear}
                  />
                </TabsContent>
              )}
            </Tabs>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
