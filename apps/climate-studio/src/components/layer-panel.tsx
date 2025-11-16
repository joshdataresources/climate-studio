"use client"

import React, { useMemo } from "react"
import { climateLayers, ClimateControl } from "@climate-studio/core/config"
import { useClimate } from "@climate-studio/core"
import { Slider } from "./ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Input } from "./ui/input"
import { Loader2 } from "lucide-react"
import { LayerStateMap } from "../hooks/useClimateLayerData"
import { AccordionItem } from "./ui/accordion"
import { WaveIcon, HeatIcon, MountainIcon, WeatherIcon, DropIcon } from "./LayerIcons"

const scenarioOptions = [
  { value: "rcp26", label: "RCP 2.6 (Low)" },
  { value: "rcp45", label: "RCP 4.5 (Moderate)" },
  { value: "rcp85", label: "RCP 8.5 (High)" },
]

const resolutionOptions = [
  { value: 0.5, label: "0.5° (High detail)" },
  { value: 1, label: "1°" },
  { value: 2, label: "2° (Faster)" },
]

const controlOrder: ClimateControl[] = [
  "scenario",
  "projectionYear",
  "seaLevelOpacity",
  "temperatureMode",
  "analysisDate",
  "displayStyle",
  "resolution",
  "projectionOpacity",
  "urbanHeatSeason",
  "urbanHeatColorScheme",
  "urbanHeatOpacity",
  "urbanExpansionOpacity",
  "reliefStyle",
  "reliefOpacity",
  "droughtMetric",
  "droughtOpacity",
  "megaregionOpacity",
  "megaregionAnimating",
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
  "setUrbanExpansionOpacity" |
  "setReliefStyle" |
  "setReliefOpacity" |
  "setTemperatureMode" |
  "setDroughtMetric" |
  "setDroughtOpacity" |
  "setMegaregionOpacity" |
  "setMegaregionAnimating"
>

const renderControl = (
  control: ClimateControl,
  values: ReturnType<typeof useClimate>["controls"],
  setters: ControlSetters,
  layerStates: LayerStateMap = {}
) => {
  const { setScenario, setProjectionYear, setAnalysisDate, setDisplayStyle, setResolution } = setters
  switch (control) {
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
      // Calculate sea level rise for current year
      const yearToFeet = (year: number): number => {
        if (year <= 2025) return 1;
        if (year >= 2100) return 10;
        return Math.round(1 + ((year - 2025) / (2100 - 2025)) * 9);
      };
      const seaLevelFeet = yearToFeet(values.projectionYear);

      // Calculate projected climate values based on scenario and year
      // These are estimates based on IPCC projections - shown even when layers are off
      const getProjectedValues = (scenario: string, year: number) => {
        const yearProgress = (year - 2025) / (2100 - 2025); // 0 to 1

        // Temperature anomaly projections (°C above baseline)
        const tempAnomalies = {
          rcp26: 1.0 + yearProgress * 1.0,   // 1-2°C by 2100
          rcp45: 1.5 + yearProgress * 1.7,   // 1.5-3.2°C by 2100
          rcp85: 2.0 + yearProgress * 2.8    // 2-4.8°C by 2100
        };

        const tempAnomaly = tempAnomalies[scenario as keyof typeof tempAnomalies] || tempAnomalies.rcp45;
        const actualTemp = 14.5 + tempAnomaly; // Global baseline ~14.5°C

        return {
          tempAnomaly,
          actualTemp,
          precipitation: 800 + yearProgress * (scenario === 'rcp85' ? 100 : scenario === 'rcp45' ? 50 : 20), // mm/year
          droughtIndex: 1.0 + yearProgress * (scenario === 'rcp85' ? 0.5 : scenario === 'rcp45' ? 0.3 : 0.1),
          soilMoisture: 60 - yearProgress * (scenario === 'rcp85' ? 15 : scenario === 'rcp45' ? 10 : 5) // %
        };
      };

      const projected = getProjectedValues(values.scenario, values.projectionYear);

      // Use actual layer data if available, otherwise use projections
      const tempLayerState = layerStates.temperature_projection;
      const droughtLayerState = layerStates.precipitation_drought;

      const tempAnomalyData = tempLayerState?.data?.metadata?.averageAnomaly
        ?? tempLayerState?.metadata?.averageAnomaly
        ?? projected.tempAnomaly;
      const actualTempData = tempLayerState?.data?.metadata?.averageTemperature
        ?? tempLayerState?.metadata?.averageTemperature
        ?? projected.actualTemp;
      const precipitationData = droughtLayerState?.data?.metadata?.averagePrecipitation
        ?? droughtLayerState?.metadata?.averagePrecipitation
        ?? projected.precipitation;
      const droughtIndexData = droughtLayerState?.data?.metadata?.droughtIndex
        ?? droughtLayerState?.metadata?.droughtIndex
        ?? projected.droughtIndex;
      const soilMoistureData = droughtLayerState?.data?.metadata?.soilMoisture
        ?? droughtLayerState?.metadata?.soilMoisture
        ?? projected.soilMoisture;

      return (
        <div key="projectionYear" className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Projection Year</label>
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

          {/* Climate Impact Metrics */}
          <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2.5 text-xs">
            <div className="flex flex-col space-y-1">
              <span className="text-muted-foreground">Sea Level Rise</span>
              <span className="font-semibold text-sky-400">~{seaLevelFeet}ft</span>
            </div>
            <div className="flex flex-col space-y-1">
              <span className="text-muted-foreground">Temp. Anomaly</span>
              <span className="font-semibold text-orange-400">
                +{tempAnomalyData.toFixed(1)}°C
              </span>
            </div>
            <div className="flex flex-col space-y-1">
              <span className="text-muted-foreground">Actual Temp.</span>
              <span className="font-semibold text-red-400">
                {actualTempData.toFixed(1)}°C
              </span>
            </div>
            <div className="flex flex-col space-y-1">
              <span className="text-muted-foreground">Precipitation</span>
              <span className="font-semibold text-blue-400">
                {precipitationData.toFixed(0)}mm
              </span>
            </div>
            <div className="flex flex-col space-y-1">
              <span className="text-muted-foreground">Drought Index</span>
              <span className="font-semibold text-yellow-400">
                {droughtIndexData.toFixed(1)}
              </span>
            </div>
            <div className="flex flex-col space-y-1">
              <span className="text-muted-foreground">Soil Moisture</span>
              <span className="font-semibold text-green-400">
                {soilMoistureData.toFixed(0)}%
              </span>
            </div>
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
    case "urbanExpansionOpacity":
      return (
        <div key="urbanExpansionOpacity" className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Layer Opacity</label>
            <span className="text-xs font-medium">{Math.round(values.urbanExpansionOpacity * 100)}%</span>
          </div>
          <Slider
            value={[Math.round(values.urbanExpansionOpacity * 100)]}
            min={10}
            max={100}
            step={5}
            onValueChange={value => setters.setUrbanExpansionOpacity(value[0] / 100)}
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
    case "droughtMetric":
      return (
        <div key="droughtMetric" className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground">Metric Type</label>
          <Select value={values.droughtMetric} onValueChange={value => setters.setDroughtMetric(value as 'precipitation' | 'drought_index' | 'soil_moisture')}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose metric" />
            </SelectTrigger>
            <SelectContent className="z-[9999]">
              <SelectItem value="precipitation">Precipitation</SelectItem>
              <SelectItem value="drought_index">Drought Index</SelectItem>
              <SelectItem value="soil_moisture">Soil Moisture</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )
    case "droughtOpacity":
      return (
        <div key="droughtOpacity" className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Layer Opacity</label>
            <span className="text-xs font-medium">{Math.round(values.droughtOpacity * 100)}%</span>
          </div>
          <Slider
            value={[Math.round(values.droughtOpacity * 100)]}
            min={10}
            max={100}
            step={5}
            onValueChange={value => setters.setDroughtOpacity(value[0] / 100)}
          />
        </div>
      )
    case "megaregionOpacity":
      return (
        <div key="megaregionOpacity" className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Layer Opacity</label>
            <span className="text-xs font-medium">{Math.round(values.megaregionOpacity * 100)}%</span>
          </div>
          <Slider
            value={[Math.round(values.megaregionOpacity * 100)]}
            min={10}
            max={100}
            step={5}
            onValueChange={value => setters.setMegaregionOpacity(value[0] / 100)}
          />
        </div>
      )
    case "megaregionAnimating":
      return (
        <div key="megaregionAnimating" className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={values.megaregionAnimating}
              onChange={(e) => setters.setMegaregionAnimating(e.target.checked)}
              className="h-4 w-4 accent-blue-500"
            />
            <span className="text-xs">Auto-animate through years</span>
          </label>
        </div>
      )
    default:
      return null
  }
}

interface LayerPanelProps {
  layerStates?: LayerStateMap
}

const getLayerIcon = (layerId: string) => {
  switch (layerId) {
    case 'sea_level_rise':
      return <WaveIcon />
    case 'temperature_projection':
      return <WeatherIcon />
    case 'urban_heat_island':
      return <HeatIcon />
    case 'precipitation_drought':
      return <DropIcon />
    case 'topographic_relief':
      return <MountainIcon />
    default:
      return null
  }
}

export function LayerPanel({ layerStates = {} }: LayerPanelProps) {
  const { activeLayerIds, toggleLayer, isLayerActive } = useClimate()
  const [showDescriptions, setShowDescriptions] = React.useState(false)

  return (
    <div className="space-y-6 p-4">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Climate Layers</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-muted-foreground">Details</span>
            <div className="relative inline-block w-9 h-5">
              <input
                type="checkbox"
                checked={showDescriptions}
                onChange={(e) => setShowDescriptions(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-blue-500 transition-colors"></div>
              <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
            </div>
          </label>
        </div>
        <div className="mt-3 space-y-3">
          {climateLayers.map(layer => {
            const active = isLayerActive(layer.id)
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
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-medium">{layer.title}</h4>
                    <span className="text-muted-foreground flex-shrink-0">
                      {getLayerIcon(layer.id)}
                    </span>
                  </div>
                  {showDescriptions ? (
                    <>
                      <p className="text-xs text-muted-foreground">{layer.description}</p>
                      <p className="text-[11px] text-muted-foreground/80">
                        Source: <span className="font-medium text-foreground">{layer.source.name}</span>
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] text-muted-foreground/80 truncate">
                      Source: <span className="font-medium text-foreground">{layer.source.name}</span>
                    </p>
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

  // Check if any projection-based layers are active
  const projectionLayerIds = ['sea_level_rise', 'temperature_projection', 'precipitation_drought']
  const hasProjectionLayers = useMemo(
    () => activeLayerIds.some(id => projectionLayerIds.includes(id)),
    [activeLayerIds]
  )

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
    setDroughtMetric: climate.setDroughtMetric,
    setDroughtOpacity: climate.setDroughtOpacity,
    setMegaregionOpacity: climate.setMegaregionOpacity,
    setMegaregionAnimating: climate.setMegaregionAnimating,
  }

  return (
    <div className="space-y-3">
      {/* Shared Climate Projection Controls - Always Visible */}
      <AccordionItem title="Climate Projections" defaultOpen={true}>
        {renderControl('scenario', climate.controls, setters, layerStates)}
        {renderControl('projectionYear', climate.controls, setters, layerStates)}
      </AccordionItem>

      {/* Individual Layer Controls - Accordion panels */}
      <div className="space-y-3">
        {activeLayersWithControls.map(layer => {
          // Auto-close panels that only have opacity controls or topographic relief
          const hasOnlyOpacity = layer.controls.length === 1 &&
            (layer.controls[0] === 'seaLevelOpacity' ||
             layer.controls[0] === 'reliefOpacity' ||
             layer.controls[0] === 'projectionOpacity' ||
             layer.controls[0] === 'urbanHeatOpacity' ||
             layer.controls[0] === 'urbanExpansionOpacity' ||
             layer.controls[0] === 'droughtOpacity');
          const isReliefLayer = layer.id === 'topographic_relief';
          const defaultOpen = !hasOnlyOpacity && !isReliefLayer;

          return (
          <AccordionItem key={layer.id} title={layer.title} defaultOpen={defaultOpen}>
            {layer.controls.map(control =>
              renderControl(control, climate.controls, setters, layerStates)
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
                    <div className={`space-y-2 rounded-md border p-3 ${
                      layerStates.temperature_projection?.data?.metadata?.isRealData
                        ? 'border-green-500/30 bg-green-500/10'
                        : 'border-yellow-500/30 bg-yellow-500/10'
                    }`}>
                      <div className="flex items-center gap-2">
                        <div className={`h-4 w-4 rounded-full flex items-center justify-center ${
                          layerStates.temperature_projection?.data?.metadata?.isRealData
                            ? 'bg-green-500'
                            : 'bg-yellow-500'
                        }`}>
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <p className="text-xs text-foreground">
                          {layerStates.temperature_projection?.data?.metadata?.isRealData
                            ? '✓ Real NASA climate data (Earth Engine)'
                            : '⚠ Simulated data (Earth Engine unavailable)'}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="space-y-1">
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
                        <div className="h-3 w-full rounded-full bg-gradient-to-r from-white via-[#fef9c3] via-[#fde047] via-[#facc15] via-[#f59e0b] via-[#fb923c] via-[#f97316] via-[#ea580c] via-[#dc2626] via-[#ef4444] via-[#b91c1c] to-[#7f1d1d]" />
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
              {layer.id === "precipitation_drought" && (
                <>
                  {layerStates.precipitation_drought?.status === 'loading' && (
                    <div className="space-y-2 rounded-md border border-blue-500/30 bg-blue-500/10 p-3">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                        <p className="text-xs text-foreground">Loading precipitation/drought data...</p>
                      </div>
                    </div>
                  )}
                  {layerStates.precipitation_drought?.status === 'success' && (
                    <div className="space-y-2 rounded-md border border-green-500/30 bg-green-500/10 p-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="rounded-full bg-green-500 p-0.5">
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <p className="text-xs text-foreground">
                          {layerStates.precipitation_drought?.data?.metadata?.isRealData
                            ? '✓ Real CHIRPS data (Earth Engine)'
                            : '⚠ Data unavailable (Earth Engine error)'}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="space-y-1">
                    {climate.controls.droughtMetric === 'precipitation' && (
                      <>
                        <div className="h-3 w-full rounded-full bg-gradient-to-r from-[#ffffff] via-[#e3f2fd] via-[#90caf9] via-[#42a5f5] via-[#1e88e5] via-[#1565c0] to-[#0d47a1]" />
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>0</span>
                          <span>2</span>
                          <span>4</span>
                          <span>6</span>
                          <span>8</span>
                          <span>10 mm/day</span>
                        </div>
                      </>
                    )}
                    {climate.controls.droughtMetric === 'drought_index' && (
                      <>
                        <div className="h-3 w-full rounded-full" style={{
                          background: 'linear-gradient(to right, #dc2626 0%, #f59e0b 16.67%, #fef08a 33.33%, #ffffff 50%, #90caf9 66.67%, #42a5f5 83.33%, #1e88e5 100%)'
                        }} />
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>0</span>
                          <span>1</span>
                          <span>2</span>
                          <span>3</span>
                          <span>4</span>
                          <span>5</span>
                          <span>6+</span>
                        </div>
                      </>
                    )}
                    {climate.controls.droughtMetric === 'soil_moisture' && (
                      <>
                        <div className="h-3 w-full rounded-full bg-gradient-to-r from-[#8b4513] via-[#daa520] via-[#f0e68c] via-[#adff2f] via-[#7cfc00] to-[#32cd32]" />
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>0</span>
                          <span>2</span>
                          <span>4</span>
                          <span>6</span>
                          <span>8</span>
                          <span>10 mm</span>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
              {layer.id === "megaregion_timeseries" && (
                <div className="space-y-1">
                  <div className="h-3 w-full rounded-full" style={{
                    background: 'linear-gradient(to right, #3b82f6 0%, #0ea5e9 16.67%, #06b6d4 33.33%, #10b981 50%, #84cc16 58.33%, #eab308 66.67%, #f59e0b 75%, #f97316 83.33%, #ef4444 91.67%, #dc2626 100%)'
                  }} />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>-5%</span>
                    <span>0%</span>
                    <span>+3%</span>
                    <span>+6%</span>
                    <span>+9%</span>
                    <span>+12%</span>
                    <span>+15%</span>
                    <span>+18%+</span>
                  </div>
                </div>
              )}
          </AccordionItem>
          );
        })}
      </div>
    </div>
  )
}
