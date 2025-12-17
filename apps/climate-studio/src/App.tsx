import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ClimateProvider } from '@climate-studio/core'
import { SidebarProvider } from './contexts/SidebarContext'
import { AppLayout } from './components/layout/AppLayout'
import { GISAnalysisApp } from './components/GISAnalysisApp'
import WaterAccessView from './components/WaterAccessView'

export default function App() {
  return (
    <BrowserRouter>
      <ClimateProvider>
        <SidebarProvider>
          <AppLayout>
            <Routes>
              <Route path="/" element={<GISAnalysisApp />} />
              <Route path="/climate-studio" element={<GISAnalysisApp />} />
              <Route path="/water-access" element={<WaterAccessView />} />
            </Routes>
          </AppLayout>
        </SidebarProvider>
      </ClimateProvider>
    </BrowserRouter>
  )
}
