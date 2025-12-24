import { ReactNode } from 'react'
import { useSidebar } from '../../contexts/SidebarContext'
import { AppSidebar } from './AppSidebar'
import './layout.css'

interface AppLayoutProps {
  children: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const { isCollapsed } = useSidebar()

  return (
    <div className="app-layout">
      <AppSidebar />
      <div className={`app-main ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
        {children}
      </div>
    </div>
  )
}











