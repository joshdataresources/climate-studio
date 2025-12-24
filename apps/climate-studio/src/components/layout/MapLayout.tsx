import { ReactNode } from 'react'
import { AppSidebar } from './AppSidebar'
import { useSidebar } from '../../contexts/SidebarContext'
import './layout.css'

interface MapLayoutProps {
  children: ReactNode // The full view component (map + control panels)
}

/**
 * MapLayout - Fixed layout with sidebar navigation
 * Each route provides its own map and control panels as children
 */
export function MapLayout({ children }: MapLayoutProps) {
  const { isCollapsed } = useSidebar()

  return (
    <div className="app-layout">
      {/* Fixed Sidebar Navigation */}
      <AppSidebar />
      
      {/* Main Content Area - Each view renders its own map and panels */}
      <main className={`app-main ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
        {children}
      </main>
    </div>
  )
}


