import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ClimateProvider } from '@climate-studio/core'
import { SidebarProvider } from './contexts/SidebarContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { MapProvider } from './contexts/MapContext'
import { AppLayout } from './components/layout/AppLayout'
import { GISAnalysisApp } from './components/GISAnalysisApp'
import WaterAccessView from './components/WaterAccessView'
import DesignSystemPage from './design-system/DesignSystemPage'
import GRACEDemo from './pages/GRACEDemo'

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <SidebarProvider>
          <ClimateProvider>
            <MapProvider>
              <Routes>
                {/* Design system page - with layout wrapper to show sidebar */}
                <Route path="/design-system" element={
                  <AppLayout>
                    <DesignSystemPage />
                  </AppLayout>
                } />

                {/* GRACE groundwater demo - fullscreen, no layout */}
                <Route path="/grace-demo" element={<GRACEDemo />} />

                {/* Main app routes with layout */}
                <Route path="*" element={
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<Navigate to="/climate-studio" replace />} />
                      <Route path="/climate-studio" element={<GISAnalysisApp />} />
                      <Route path="/water-access" element={<WaterAccessView />} />
                    </Routes>
                  </AppLayout>
                } />
              </Routes>
            </MapProvider>
          </ClimateProvider>
        </SidebarProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
