import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useClimate } from '@climate-studio/core'
import { GitCompare, X } from 'lucide-react'
import {
  LocationSearchBar,
  type LocationSelection,
} from '../components/dashboard/LocationSearchBar'
import { resolveNearestMetro } from '../utils/metroResolver'
import { useMap } from '../contexts/MapContext'
import { LocationCityView } from '../components/dashboard/LocationCityView'
import { LocationCompareView } from '../components/dashboard/LocationCompareView'
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
  scenarioToSsp,
  sspToRcp,
  SSP_LABELS,
  type SspScenario,
} from '../utils/scenarioMapping'
import { cn } from '../lib/utils'

const COMPARE_TAB = '__compare__'

function matchToSelection(match: ReturnType<typeof resolveNearestMetro>): LocationSelection | null {
  if (!match) return null
  return {
    metroKey: match.key,
    metroName: match.name,
    searchLabel: match.resolvedFrom,
    distanceKm: match.distanceKm,
  }
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
  const { viewport } = useMap()
  const [selectedLocations, setSelectedLocations] = useState<LocationSelection[]>([])
  const [activeTab, setActiveTab] = useState<string>('')
  const [isLocating, setIsLocating] = useState(false)
  const autoLoadAttempted = useRef(false)

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
    if (!activeTab || !selectedLocations.some(l => l.metroKey === activeTab)) {
      if (activeTab !== COMPARE_TAB) {
        setActiveTab(selectedLocations[0].metroKey)
      }
    }
  }, [selectedLocations, activeTab])

  useEffect(() => {
    if (autoLoadAttempted.current || selectedLocations.length > 0) return
    autoLoadAttempted.current = true
    setIsLocating(true)

    const loadMatch = (lat: number, lon: number, label: string) => {
      const selection = matchToSelection(resolveNearestMetro(lat, lon, label))
      if (selection) handleLocationSelect(selection)
      setIsLocating(false)
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => loadMatch(pos.coords.latitude, pos.coords.longitude, 'Your location'),
        () => loadMatch(viewport.center.lat, viewport.center.lng, 'Map center'),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
      )
    } else {
      loadMatch(viewport.center.lat, viewport.center.lng, 'Map center')
    }
  }, [selectedLocations.length, handleLocationSelect, viewport.center.lat, viewport.center.lng])

  const existingMetroKeys = selectedLocations.map(l => l.metroKey)
  const showCompare = selectedLocations.length >= 2

  return (
    <div className="dashboard-page">
      <div className="dashboard-page-inner flex flex-col">
        <div className="widget-container mb-4 shrink-0">
          <h2 className="widget-title text-base">Location Analysis</h2>
          <p className="mb-4 text-xs leading-relaxed text-[var(--cs-text-secondary)]">
            Real precomputed climate projections for your nearest metro — temperature (NASA
            NEX-GDDP-CMIP6), humidity &amp; wet bulb events, and drought from river flow models.
            Baseline period 1995–2014.
          </p>

          <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[minmax(0,1fr)_11rem_minmax(0,1fr)]">
            <div className="min-w-0">
              <label className="mb-1.5 block text-xs font-medium text-[var(--cs-text-tertiary)]">
                Search location
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
                  {(['ssp245', 'ssp585'] as SspScenario[]).map(ssp => (
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
          {isLocating && selectedLocations.length === 0 ? (
            <div className="widget-container flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[var(--cs-brand-primary)] border-t-transparent" />
              <p className="text-sm text-[var(--cs-text-secondary)]">
                Loading nearest metro from your location…
              </p>
            </div>
          ) : selectedLocations.length === 0 ? (
            <div className="widget-container py-12 text-center text-sm text-[var(--cs-text-tertiary)]">
              Search for a city above, or allow location access to load your nearest metro.
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="dashboard-tabs-list mb-3 h-auto w-full flex-wrap justify-start">
                {selectedLocations.map(loc => (
                  <CityTabTrigger
                    key={loc.metroKey}
                    metroKey={loc.metroKey}
                    label={loc.metroName}
                    onRemove={handleRemoveLocation}
                  />
                ))}
                {showCompare && (
                  <TabsTrigger value={COMPARE_TAB} className="gap-1.5 text-xs">
                    <GitCompare className="h-3 w-3" />
                    Compare
                  </TabsTrigger>
                )}
              </TabsList>

              {selectedLocations.map(loc => (
                <TabsContent key={loc.metroKey} value={loc.metroKey} className="mt-0">
                  {activeTab === loc.metroKey && (
                    <LocationCityView
                      location={loc}
                      scenario={scenario}
                      projectionYear={projectionYear}
                    />
                  )}
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
