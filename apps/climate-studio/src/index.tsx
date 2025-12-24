// Main exports for embedding climate-studio in other apps
export { GISAnalysisApp } from './components/GISAnalysisApp'
export { default as WaterAccessView } from './components/WaterAccessView'
export { default as AquiferProjectionView } from './components/AquiferProjectionView'
export { ClimateProvider, useClimate } from '@climate-studio/core'

// Re-export the wrapped version with providers for convenience
import { ClimateProvider } from '@climate-studio/core'
import { GISAnalysisApp } from './components/GISAnalysisApp'

interface ClimateStudioAppProps {
  className?: string
}

/**
 * Standalone Climate Studio component with all required providers.
 * Use this when embedding climate-studio in another app.
 */
export function ClimateStudioApp({ className }: ClimateStudioAppProps) {
  return (
    <ClimateProvider>
      <div className={className} style={{ height: '100%', width: '100%' }}>
        <GISAnalysisApp />
      </div>
    </ClimateProvider>
  )
}
