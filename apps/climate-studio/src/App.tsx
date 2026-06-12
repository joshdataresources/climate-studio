import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ClimateProvider } from '@climate-studio/core'
import { SidebarProvider } from './contexts/SidebarContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { MapProvider } from './contexts/MapContext'
import { LayerProvider } from './contexts/LayerContext'
import { AppLayout } from './components/layout/AppLayout'
import WaterAccessView from './components/WaterAccessView'
import DesignSystemPage from './design-system/DesignSystemPage'
import GRACEDemo from './pages/GRACEDemo'
import { SettingsPage } from './pages/SettingsPage'
import Dashboard from './pages/Dashboard'
import { features } from './config/features'

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <SidebarProvider>
          <ClimateProvider>
            <MapProvider>
              <LayerProvider>
              <Routes>
                {/* Design system page - with layout wrapper to show sidebar */}
                <Route path="/design-system" element={
                  <AppLayout>
                    <DesignSystemPage />
                  </AppLayout>
                } />

                {/* GRACE groundwater demo - fullscreen, no layout */}
                <Route path="/grace-demo" element={<GRACEDemo />} />

                {/* Settings page - with layout wrapper to show sidebar */}
                <Route path="/settings" element={
                  <AppLayout>
                    <SettingsPage />
                  </AppLayout>
                } />

                {/* Location dashboard (feature-flagged — off by default until ready) */}
                {features.locationDashboard && (
                  <Route path="/dashboard" element={
                    <AppLayout>
                      <Dashboard />
                    </AppLayout>
                  } />
                )}
                {!features.locationDashboard && (
                  <Route path="/dashboard" element={<Navigate to="/" replace />} />
                )}

                {/* Main app routes with layout */}
                <Route path="*" element={
                  <AppLayout>
                    <Routes>
                      {/* Climate Suite is now the root page */}
                      <Route path="/" element={<WaterAccessView />} />
                    </Routes>
                  </AppLayout>
                } />
              </Routes>
              </LayerProvider>
            </MapProvider>
          </ClimateProvider>
        </SidebarProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
