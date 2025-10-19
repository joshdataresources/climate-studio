"use client"

import React, { useMemo } from "react"
import { climateLayers, ClimateControl } from "../config/climateLayers"
import { useClimate } from "../contexts/ClimateContext"
import { Slider } from "./ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Input } from "./ui/input"
import { Loader2 } from "lucide-react"
import { LayerStateMap } from "../hooks/useClimateLayerData"

const scenarioOptions = [
  { value: "rcp26", label: "RCP 2.6 (Low)" },
  { value: "rcp45", label: "RCP 4.5 (Moderate)" },
  { value: "rcp85", label: "RCP 8.5 (High)" },
  { value: "ssp126", label: "SSP1-2.6" },
  { value: "ssp245", label: "SSP2-4.5" },
  { value: "ssp585", label: "SSP5-8.5" },
]

const resolutionOptions = [
  { value: 0.5, label: "0.5° (High detail)" },
  { value: 1, label: "1°" },
  { value: 2, label: "2° (Faster)" },
]

const controlOrder: ClimateControl[] = [
  "seaLevelFeet",
  "seaLevelOpacity",
  "scenario",
  "projectionYear",
  "temperatureMode",
  "analysisDate",
  "displayStyle",
  "resolution",
  "projectionOpacity",
  "urbanHeatSeason",
  "urbanHeatColorScheme",
  "urbanHeatOpacity",
  "reliefStyle",
  "reliefOpacity",
]

type ControlSetters = Pick<
  ReturnType<typeof useClimate>,
  "setSeaLevelFeet" |
  "setSeaLevelOpacity" |
  "setScenario" |
  "setProjectionYear" |
  "setAnalysisDate" |
  "setDisplayStyle" |
  "setResolution" |
  "setProjectionOpacity" |
  "setUrbanHeatOpacity" |
  "setUrbanHeatSeason" |
  "setUrbanHeatColorScheme" |
  "setReliefStyle" |
  "setReliefOpacity" |
  "setTemperatureMode"
>

const renderControl = (
  control: ClimateControl,
  values: ReturnType<typeof useClimate>["controls"],
  setters: ControlSetters
) => {
  const { setSeaLevelFeet, setScenario, setProjectionYear, setAnalysisDate, setDisplayStyle, setResolution } = setters
  switch (control) {
    case "seaLevelFeet":
      return (
        <div key="seaLevelFeet" className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Sea Level Rise</label>
              <p className="text-[11px] text-muted-foreground">Adjust inundation depth (0-10 ft)</p>
            </div>
            <span className="text-sm font-medium text-blue-400">{values.seaLevelFeet} ft</span>
          </div>
          <Slider
            value={[values.seaLevelFeet]}
            min={0}
            max={10}
            step={1}
            onValueChange={value => setSeaLevelFeet(value[0])}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0 ft</span>
            <span>10 ft</span>
          </div>
        </div>
      )
    case "scenario":
      return (
        <div key="scenario" className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-muted-foreground">Climate Scenario</label>
          </div>
          <Select value={values.scenario} onValueChange={value => setScenario(value)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose scenario" />
            </SelectTrigger>
            <SelectContent className="z-[9999]">
              {scenarioOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )
    case "projectionYear":
      return (
        <div key="projectionYear" className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Projection Year</label>
              <p className="text-[11px] text-muted-foreground">Select forecast horizon (2025-2100)</p>
            </div>
            <span className="text-sm font-medium text-orange-400">{values.projectionYear}</span>
          </div>
          <Slider
            value={[values.projectionYear]}
            min={2025}
            max={2100}
            step={5}
            onValueChange={value => setProjectionYear(value[0])}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>2025</span>
            <span>2100</span>
          </div>
        </div>
      )
    case "analysisDate":
      return (
        <div key="analysisDate" className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground">Analysis Date</label>
          <Input
            type="date"
            value={values.analysisDate}
            onChange={event => setAnalysisDate(event.target.value)}
            className="w-full"
          />
        </div>
      )
    case "displayStyle":
      return (
        <div key="displayStyle" className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground">Sea Level Display</label>
          <Select value={values.displayStyle} onValueChange={value => setDisplayStyle(value as "depth" | "confidence")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose style" />
            </SelectTrigger>
            <SelectContent className="z-[9999]">
              <SelectItem value="depth">Depth Grid</SelectItem>
              <SelectItem value="confidence">Confidence Extent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )
    case "resolution":
      return (
        <div key="resolution" className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground">Sampling Resolution</label>
          <Select value={String(values.resolution)} onValueChange={value => setResolution(Number(value))}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Resolution" />
            </SelectTrigger>
            <SelectContent className="z-[9999]">
              {resolutionOptions.map(option => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )
    case "seaLevelOpacity":
      return (
        <div key="seaLevelOpacity" className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Layer Opacity</label>
            <span className="text-xs font-medium">{Math.round(values.seaLevelOpacity * 100)}%</span>
          </div>
          <Slider
            value={[Math.round(values.seaLevelOpacity * 100)]}
            min={10}
            max={100}
            step={5}
            onValueChange={value => setters.setSeaLevelOpacity(value[0] / 100)}
          />
        </div>
      )
    case "projectionOpacity":
      return (
        <div key="projectionOpacity" className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Layer Opacity</label>
            <span className="text-xs font-medium">{Math.round(values.projectionOpacity * 100)}%</span>
          </div>
          <Slider
            value={[Math.round(values.projectionOpacity * 100)]}
            min={10}
            max={100}
            step={5}
            onValueChange={value => setters.setProjectionOpacity(value[0] / 100)}
          />
        </div>
      )
    case "urbanHeatOpacity":
      return (
        <div key="urbanHeatOpacity" className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Layer Opacity</label>
            <span className="text-xs font-medium">{Math.round(values.urbanHeatOpacity * 100)}%</span>
          </div>
          <Slider
            value={[Math.round(values.urbanHeatOpacity * 100)]}
            min={10}
            max={100}
            step={5}
            onValueChange={value => setters.setUrbanHeatOpacity(value[0] / 100)}
          />
        </div>
      )
    case "urbanHeatSeason":
      return (
        <div key="urbanHeatSeason" className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground">Season</label>
          <Select value={values.urbanHeatSeason} onValueChange={value => setters.setUrbanHeatSeason(value as 'summer' | 'winter')}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose season" />
            </SelectTrigger>
            <SelectContent className="z-[9999]">
              <SelectItem value="summer">Summer (Jun-Aug)</SelectItem>
              <SelectItem value="winter">Winter (Dec-Feb)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )
    case "urbanHeatColorScheme":
      return (
        <div key="urbanHeatColorScheme" className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground">Color Scheme</label>
          <Select value={values.urbanHeatColorScheme} onValueChange={value => setters.setUrbanHeatColorScheme(value as 'temperature' | 'heat' | 'urban')}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose color scheme" />
            </SelectTrigger>
            <SelectContent className="z-[9999]">
              <SelectItem value="temperature">Temperature (Blue-Red)</SelectItem>
              <SelectItem value="heat">Heat (Viridis)</SelectItem>
              <SelectItem value="urban">Urban (Blue-Orange-Red)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )
    case "reliefStyle":
      return (
        <div key="reliefStyle" className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground">Hillshade Style</label>
          <Select value={values.reliefStyle} onValueChange={value => setters.setReliefStyle(value as 'classic' | 'dark' | 'depth' | 'dramatic')}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose style" />
            </SelectTrigger>
            <SelectContent className="z-[9999]">
              <SelectItem value="classic">Classic</SelectItem>
              <SelectItem value="dark">Dark Relief</SelectItem>
              <SelectItem value="depth">3D Depth</SelectItem>
              <SelectItem value="dramatic">Dramatic Shadows</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )
    case "reliefOpacity":
      return (
        <div key="reliefOpacity" className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Layer Opacity</label>
            <span className="text-xs font-medium">{Math.round(values.reliefOpacity * 100)}%</span>
          </div>
          <Slider
            value={[Math.round(values.reliefOpacity * 100)]}
            min={10}
            max={100}
            step={5}
            onValueChange={value => setters.setReliefOpacity(value[0] / 100)}
          />
        </div>
      )
    case "temperatureMode":
      return (
        <div key="temperatureMode" className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground">Temperature Display</label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="temperatureMode"
                value="anomaly"
                checked={values.temperatureMode === 'anomaly'}
                onChange={() => setters.setTemperatureMode('anomaly')}
                className="h-4 w-4 accent-blue-500"
              />
              <span className="text-xs">Temperature Anomaly (Change)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="temperatureMode"
                value="actual"
                checked={values.temperatureMode === 'actual'}
                onChange={() => setters.setTemperatureMode('actual')}
                className="h-4 w-4 accent-blue-500"
              />
              <span className="text-xs">Actual Temperature</span>
            </label>
          </div>
        </div>
      )
    default:
      return null
  }
}

interface LayerPanelProps {
  layerStates?: LayerStateMap
}

export function LayerPanel({ layerStates = {} }: LayerPanelProps) {
  const { activeLayerIds, toggleLayer, isLayerActive } = useClimate()

  return (
    <div className="space-y-6 p-4">
      <div>
        <h3 className="text-sm font-semibold">Climate Layers</h3>
        <div className="mt-3 space-y-3">
          {climateLayers.map(layer => {
            const active = isLayerActive(layer.id)
            const layerState = layerStates[layer.id]
            const isLoading = layerState?.status === 'loading'
            const hasError = layerState?.status === 'error'
            const estimatedSeconds = layerState?.estimatedLoadTime ? Math.round(layerState.estimatedLoadTime / 1000) : null

            return (
              <label
                key={layer.id}
                className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${
                  active ? "border-blue-500/60 bg-blue-500/10" : "border-border/60 bg-muted/20 hover:bg-muted/40"
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 flex-shrink-0 accent-blue-500"
                  checked={active}
                  onChange={() => toggleLayer(layer.id)}
                />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium">{layer.title}</h4>
                      {isLoading && (
                        <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
                      )}
                    </div>
                    <span className="rounded bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wide text-secondary-foreground">
                      {layer.category}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{layer.description}</p>
                  <p className="text-[11px] text-muted-foreground/80">
                    Source: <span className="font-medium text-foreground">{layer.source.name}</span>
                  </p>
                  {isLoading && estimatedSeconds && (
                    <div className="flex items-center gap-1.5 text-[11px] text-blue-400">
                      <span>Loading data (~{estimatedSeconds}s)...</span>
                    </div>
                  )}
                  {hasError && (
                    <div className="text-[11px] text-red-400">
                      Error: {layerState.error}
                    </div>
                  )}
                  {layerState?.status === 'success' && layerState.updatedAt && (
                    <div className="text-[10px] text-muted-foreground/60">
                      Cached • Last updated {new Date(layerState.updatedAt).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}

interface LayerControlsPanelProps {
  layerStates?: LayerStateMap
}

export function LayerControlsPanel({ layerStates = {} }: LayerControlsPanelProps) {
  const climate = useClimate()
  const { activeLayerIds } = climate

  const activeLayersWithControls = useMemo(
    () =>
      climateLayers.filter(layer =>
        activeLayerIds.includes(layer.id) && layer.controls.length > 0
      ),
    [activeLayerIds]
  )

  if (activeLayersWithControls.length === 0) {
    return null
  }

  const setters: ControlSetters = {
    setSeaLevelFeet: climate.setSeaLevelFeet,
    setScenario: climate.setScenario,
    setProjectionYear: climate.setProjectionYear,
    setAnalysisDate: climate.setAnalysisDate,
    setDisplayStyle: climate.setDisplayStyle,
    setResolution: climate.setResolution,
    setProjectionOpacity: climate.setProjectionOpacity,
    setSeaLevelOpacity: climate.setSeaLevelOpacity,
    setUrbanHeatOpacity: climate.setUrbanHeatOpacity,
    setUrbanHeatSeason: climate.setUrbanHeatSeason,
    setUrbanHeatColorScheme: climate.setUrbanHeatColorScheme,
    setReliefStyle: climate.setReliefStyle,
    setReliefOpacity: climate.setReliefOpacity,
    setTemperatureMode: climate.setTemperatureMode,
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        {activeLayersWithControls.map(layer => (
          <div key={layer.id} className="space-y-3 rounded-lg border border-border/60 bg-card/95 backdrop-blur-lg p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">{layer.title}</h4>
              <span className="rounded bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wide text-secondary-foreground">
                {layer.category}
              </span>
            </div>
            <div className="space-y-3">
              {layer.controls.map(control =>
                renderControl(control, climate.controls, setters)
              )}
              {layer.id === "temperature_projection" && (
                <>
                  {layerStates.temperature_projection?.status === 'loading' && (
                    <div className="space-y-2 rounded-md border border-blue-500/30 bg-blue-500/10 p-3">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                        <p className="text-xs text-foreground">Loading NASA temperature data...</p>
                      </div>
                    </div>
                  )}
                  {layerStates.temperature_projection?.status === 'success' && (
                    <div className="space-y-2 rounded-md border border-green-500/30 bg-green-500/10 p-3">
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center">
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <p className="text-xs text-foreground">NASA temperature data loaded</p>
                      </div>
                    </div>
                  )}
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold text-muted-foreground">
                      {climate.controls.temperatureMode === 'actual' ? 'Actual Temperature (°C)' : 'Temperature Anomaly (°C)'}
                    </p>
                    {climate.controls.temperatureMode === 'actual' ? (
                      <>
                        <div className="h-3 w-full rounded-full bg-gradient-to-r from-[#1e3a8a] via-[#3b82f6] via-[#fef08a] via-[#fb923c] via-[#ef4444] via-[#7f1d1d] to-[#450a0a]" />
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>10°</span>
                          <span>15°</span>
                          <span>20°</span>
                          <span>25°</span>
                          <span>30°</span>
                          <span>35°</span>
                          <span>40°+</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="h-3 w-full rounded-full bg-gradient-to-r from-[#3b82f6] via-[#60a5fa] via-[#93c5fd] via-[#fef08a] via-[#fbbf24] via-[#fb923c] via-[#ef4444] to-[#7f1d1d]" />
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>0°</span>
                          <span>1°</span>
                          <span>2°</span>
                          <span>3°</span>
                          <span>4°</span>
                          <span>5°</span>
                          <span>6°</span>
                          <span>8°+</span>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
