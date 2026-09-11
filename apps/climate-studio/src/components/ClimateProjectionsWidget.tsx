"use client"

import React from "react"
import { useClimate } from "@climate-studio/core"
import { Slider } from "./ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { seaLevelRiseFeet, temperatureAnomalyC, PROJECTION_SOURCES } from '../config/climateProjections'

const scenarioOptions = [
  { value: "rcp26", label: "RCP 2.6 (Low)" },
  { value: "rcp45", label: "RCP 4.5 (Moderate)" },
  { value: "rcp85", label: "RCP 8.5 (High)" },
]

interface ClimateProjectionsWidgetProps {
  className?: string
}

export function ClimateProjectionsWidget({ className = "" }: ClimateProjectionsWidgetProps) {
  const { controls, setScenario, setProjectionYear } = useClimate()

  // Calculate projected values based on scenario and year
  const getProjectedValues = (scenario: string, year: number) => {
    const yearProgress = (year - 2025) / (2100 - 2025) // 0 to 1

    // IPCC AR6 best estimates, above the 1850-1900 baseline.
    const tempAnomaly = temperatureAnomalyC(year, scenario)

    // NOAA 2022 GMSL scenarios, shared with the map layer so the number shown here
    // and the inundation actually drawn are the same projection.
    const seaLevelFeet = seaLevelRiseFeet(year, scenario)

    // Global average baseline temperature (approximate)
    const baselineTemp = 15.0 // °C (global average)
    const actualTemp = baselineTemp + tempAnomaly

    // Precipitation, drought index and soil moisture used to be shown here as
    // single global figures built from invented constants — 800 mm baseline, a
    // drought index starting at 1.0, soil moisture at 60% — scaled linearly by year.
    // None of them had a source, and none of those quantities is meaningful as one
    // number for the whole world: they vary by location, which is exactly what the
    // Precipitation & Drought map layer shows. They are not displayed rather than
    // displayed as fiction. Re-add them by reading the precipitation-drought service
    // for the current viewport, the way the map layer does.

    return {
      tempAnomaly,
      actualTemp,
      seaLevelFeet,
    }
  }

  const projected = getProjectedValues(controls.scenario, controls.projectionYear)

  return (
    <div className={`widget-container space-y-4 ${className}`}>
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-foreground">Climate Projections</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Adjust scenario and year to see climate impacts
        </p>
      </div>

      {/* Climate Scenario Selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-muted-foreground">Climate Scenario</label>
        </div>
        <Select value={controls.scenario} onValueChange={value => setScenario(value)}>
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

      {/* Projection Year Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Projection Year</label>
          </div>
          <span className="text-sm font-medium text-orange-400">{controls.projectionYear}</span>
        </div>
        <Slider
          value={[controls.projectionYear]}
          min={2025}
          max={2100}
          step={5}
          onValueChange={value => setProjectionYear(value[0])}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>2025</span>
          <span>2100</span>
        </div>

        {/* Climate Impact Metrics - 6 data points in 2 rows */}
        <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2.5 text-xs">
          <div className="flex flex-col space-y-1">
            <span className="text-muted-foreground">Sea Level Rise</span>
            <span className="font-semibold text-sky-400">~{projected.seaLevelFeet}ft</span>
          </div>
          <div className="flex flex-col space-y-1">
            <span className="text-muted-foreground">Temp. Anomaly</span>
            <span className="font-semibold text-orange-400">
              +{projected.tempAnomaly.toFixed(1)}°C
            </span>
          </div>
          <div className="flex flex-col space-y-1">
            <span className="text-muted-foreground">Actual Temp.</span>
            <span className="font-semibold text-red-400">
              {projected.actualTemp.toFixed(1)}°C
            </span>
          </div>
        </div>
        <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
          Sea level: {PROJECTION_SOURCES.seaLevel}. Temperature: {PROJECTION_SOURCES.temperature}.
          Central estimates.
        </p>
      </div>
    </div>
  )
}
