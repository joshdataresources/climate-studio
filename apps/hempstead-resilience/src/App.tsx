import { GISAnalysisApp } from './components/GISAnalysisApp'
import { ClimateProvider } from '@climate-studio/core'

export default function App() {
  return (
    <ClimateProvider>
      <GISAnalysisApp />
    </ClimateProvider>
  )
}
