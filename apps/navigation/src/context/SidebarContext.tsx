import { createContext, useContext, useState, ReactNode } from 'react'

interface SidebarContextType {
  isCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  viewEnabled: boolean
  toggleView: () => void
  setViewEnabled: (enabled: boolean) => void
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [viewEnabled, setViewEnabled] = useState(true) // Default to enabled (widgets visible)

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed)
  }

  const setSidebarCollapsed = (collapsed: boolean) => {
    setIsCollapsed(collapsed)
  }

  const toggleView = () => {
    setViewEnabled(prev => !prev)
  }

  const setViewEnabledState = (enabled: boolean) => {
    setViewEnabled(enabled)
  }

  return (
    <SidebarContext.Provider value={{ 
      isCollapsed, 
      toggleSidebar, 
      setSidebarCollapsed,
      viewEnabled,
      toggleView,
      setViewEnabled: setViewEnabledState
    }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}
