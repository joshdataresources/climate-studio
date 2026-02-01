"use client"

import React from "react"
import { useClimate } from "@climate-studio/core"
import { Slider } from "./ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"

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

    // Temperature anomaly projections (°C above baseline)
    const tempAnomalies = {
      rcp26: 1.0 + yearProgress * 1.0,   // 1-2°C by 2100
      rcp45: 1.5 + yearProgress * 1.7,   // 1.5-3.2°C by 2100
      rcp85: 2.0 + yearProgress * 2.8    // 2-4.8°C by 2100
    }

    const tempAnomaly = tempAnomalies[scenario as keyof typeof tempAnomalies] || tempAnomalies.rcp45

    // Sea level rise estimation
    const yearsSince2025 = year - 2025
    const seaLevelFeet = Math.round(1 + ((yearsSince2025) / (2100 - 2025)) * 9)

    // Global average baseline temperature (approximate)
    const baselineTemp = 15.0 // °C (global average)
    const actualTemp = baselineTemp + tempAnomaly

    // Precipitation projections (mm/year)
    const precipBase = 800
    const precipChange = scenario === 'rcp85' ? 100 : scenario === 'rcp45' ? 50 : 20
    const precipitation = precipBase + yearProgress * precipChange

    // Drought Index (0-5 scale, higher = more drought)
    // Increases with temperature, decreases slightly with precipitation in some scenarios
    const droughtBase = 1.0
    const droughtIncrease = scenario === 'rcp85' ? 1.5 : scenario === 'rcp45' ? 1.0 : 0.5
    const droughtIndex = droughtBase + yearProgress * droughtIncrease

    // Soil Moisture (percentage, decreases with warming and drought)
    // Base soil moisture around 60%, decreases as drought increases
    const soilMoistureBase = 60
    const soilMoistureDecrease = scenario === 'rcp85' ? 12 : scenario === 'rcp45' ? 8 : 4
    const soilMoisture = Math.max(30, soilMoistureBase - yearProgress * soilMoistureDecrease)

    return {
      tempAnomaly,
      actualTemp,
      seaLevelFeet,
      precipitation,
      droughtIndex,
      soilMoisture,
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
          <div className="flex flex-col space-y-1">
            <span className="text-muted-foreground">Precipitation</span>
            <span className="font-semibold text-blue-400">
              {projected.precipitation.toFixed(0)}mm
            </span>
          </div>
          <div className="flex flex-col space-y-1">
            <span className="text-muted-foreground">Drought Index</span>
            <span className="font-semibold text-yellow-400">
              {projected.droughtIndex.toFixed(1)}
            </span>
          </div>
          <div className="flex flex-col space-y-1">
            <span className="text-muted-foreground">Soil Moisture</span>
            <span className="font-semibold text-green-400">
              {projected.soilMoisture.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
