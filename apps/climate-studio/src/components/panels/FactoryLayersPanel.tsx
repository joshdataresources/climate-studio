"use client"

import React from 'react'
import { useTheme } from '../../contexts/ThemeContext'
import { Checkbox } from '../ui/checkbox'
import { Factory, AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react'

interface FactoryLayersPanelProps {
  // Status filters
  showOperational: boolean
  setShowOperational: (show: boolean) => void
  showConstruction: boolean
  setShowConstruction: (show: boolean) => void
  showAnnounced: boolean
  setShowAnnounced: (show: boolean) => void
  showFailed: boolean
  setShowFailed: (show: boolean) => void

  // Sector filters
  showSemiconductor: boolean
  setShowSemiconductor: (show: boolean) => void
  showBattery: boolean
  setShowBattery: (show: boolean) => void
  showEV: boolean
  setShowEV: (show: boolean) => void
  showDataCenter: boolean
  setShowDataCenter: (show: boolean) => void
  showElectronics: boolean
  setShowElectronics: (show: boolean) => void

  // Risk filters
  showLowRisk: boolean
  setShowLowRisk: (show: boolean) => void
  showModerateRisk: boolean
  setShowModerateRisk: (show: boolean) => void
  showHighRisk: boolean
  setShowHighRisk: (show: boolean) => void
  showCriticalRisk: boolean
  setShowCriticalRisk: (show: boolean) => void
}

export function FactoryLayersPanel(props: FactoryLayersPanelProps) {
  const { theme } = useTheme()

  return (
    <aside className="w-80 pointer-events-auto transition-all duration-300 animate-in fade-in slide-in-from-right-10">
      <div className="widget-container">
        <div className="flex items-center gap-2 mb-4">
          <Factory className="h-5 w-5 text-blue-500" />
          <h2 className="text-lg font-semibold">Factories</h2>
        </div>

        {/* STATUS Section */}
        <div className="mb-4">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-3 tracking-wide">
            STATUS
          </h3>
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Checkbox
                id="filter-operational"
                checked={props.showOperational}
                onCheckedChange={(checked) => props.setShowOperational(checked as boolean)}
                className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
              />
              <label htmlFor="filter-operational" className="flex items-center gap-2 text-sm cursor-pointer flex-1">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Operational</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="filter-construction"
                checked={props.showConstruction}
                onCheckedChange={(checked) => props.setShowConstruction(checked as boolean)}
                className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
              />
              <label htmlFor="filter-construction" className="flex items-center gap-2 text-sm cursor-pointer flex-1">
                <Clock className="h-4 w-4 text-blue-500" />
                <span>Under Construction</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="filter-announced"
                checked={props.showAnnounced}
                onCheckedChange={(checked) => props.setShowAnnounced(checked as boolean)}
                className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
              />
              <label htmlFor="filter-announced" className="flex items-center gap-2 text-sm cursor-pointer flex-1">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span>Announced</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="filter-failed"
                checked={props.showFailed}
                onCheckedChange={(checked) => props.setShowFailed(checked as boolean)}
                className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
              />
              <label htmlFor="filter-failed" className="flex items-center gap-2 text-sm cursor-pointer flex-1">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span>Failed/Paused</span>
              </label>
            </div>
          </div>
        </div>

        {/* SECTOR Section */}
        <div className="mb-4">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-3 tracking-wide">
            SECTOR
          </h3>
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Checkbox
                id="filter-semiconductor"
                checked={props.showSemiconductor}
                onCheckedChange={(checked) => props.setShowSemiconductor(checked as boolean)}
                className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
              />
              <label htmlFor="filter-semiconductor" className="text-sm cursor-pointer flex-1">
                Semiconductors (10)
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="filter-battery"
                checked={props.showBattery}
                onCheckedChange={(checked) => props.setShowBattery(checked as boolean)}
                className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
              />
              <label htmlFor="filter-battery" className="text-sm cursor-pointer flex-1">
                Batteries (12)
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="filter-ev"
                checked={props.showEV}
                onCheckedChange={(checked) => props.setShowEV(checked as boolean)}
                className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
              />
              <label htmlFor="filter-ev" className="text-sm cursor-pointer flex-1">
                Electric Vehicles (11)
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="filter-datacenter"
                checked={props.showDataCenter}
                onCheckedChange={(checked) => props.setShowDataCenter(checked as boolean)}
                className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
              />
              <label htmlFor="filter-datacenter" className="text-sm cursor-pointer flex-1">
                Data Centers (3)
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="filter-electronics"
                checked={props.showElectronics}
                onCheckedChange={(checked) => props.setShowElectronics(checked as boolean)}
                className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
              />
              <label htmlFor="filter-electronics" className="text-sm cursor-pointer flex-1">
                Electronics (1)
              </label>
            </div>
          </div>
        </div>

        {/* CLIMATE RISK Section */}
        <div>
          <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-3 tracking-wide">
            CLIMATE RISK
          </h3>
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Checkbox
                id="filter-low-risk"
                checked={props.showLowRisk}
                onCheckedChange={(checked) => props.setShowLowRisk(checked as boolean)}
                className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
              />
              <label htmlFor="filter-low-risk" className="flex items-center gap-2 text-sm cursor-pointer flex-1">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span>Low Risk (0-3)</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="filter-moderate-risk"
                checked={props.showModerateRisk}
                onCheckedChange={(checked) => props.setShowModerateRisk(checked as boolean)}
                className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
              />
              <label htmlFor="filter-moderate-risk" className="flex items-center gap-2 text-sm cursor-pointer flex-1">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span>Moderate Risk (3-5)</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="filter-high-risk"
                checked={props.showHighRisk}
                onCheckedChange={(checked) => props.setShowHighRisk(checked as boolean)}
                className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
              />
              <label htmlFor="filter-high-risk" className="flex items-center gap-2 text-sm cursor-pointer flex-1">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span>High Risk (5-7)</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="filter-critical-risk"
                checked={props.showCriticalRisk}
                onCheckedChange={(checked) => props.setShowCriticalRisk(checked as boolean)}
                className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
              />
              <label htmlFor="filter-critical-risk" className="flex items-center gap-2 text-sm cursor-pointer flex-1">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span>Critical Risk (7-10)</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
