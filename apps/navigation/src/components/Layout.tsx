import { ReactNode } from 'react'
import { useSidebar } from '../context/SidebarContext'
import Sidebar from './Sidebar'
import './Layout.css'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { isCollapsed } = useSidebar()

  return (
    <div className="layout">
      <Sidebar />
      <div className={`main-wrapper ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  )
}
