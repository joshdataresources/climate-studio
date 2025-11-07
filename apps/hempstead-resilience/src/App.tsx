import { HempsteadResilienceApp } from './components/HempsteadResilienceApp'
import { ClimateProvider } from '@climate-studio/core'

export default function App() {
  return (
    <ClimateProvider>
      <HempsteadResilienceApp />
    </ClimateProvider>
  )
}
