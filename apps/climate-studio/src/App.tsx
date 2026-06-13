import type { ReactNode } from 'react'
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom'
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

function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <SidebarProvider>
        <ClimateProvider>
          <MapProvider>
            <LayerProvider>{children}</LayerProvider>
          </MapProvider>
        </ClimateProvider>
      </SidebarProvider>
    </ThemeProvider>
  )
}

function AppShell() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  )
}

const router = createBrowserRouter([
  {
    path: '/grace-demo',
    element: (
      <AppProviders>
        <GRACEDemo />
      </AppProviders>
    ),
  },
  {
    path: '/',
    element: (
      <AppProviders>
        <AppShell />
      </AppProviders>
    ),
    children: [
      { index: true, element: <WaterAccessView /> },
      {
        path: 'dashboard',
        element: features.locationDashboard ? <Dashboard /> : <Navigate to="/" replace />,
      },
      { path: 'design-system', element: <DesignSystemPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
