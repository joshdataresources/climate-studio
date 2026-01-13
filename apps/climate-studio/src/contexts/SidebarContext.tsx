import { createContext, useContext, useState, ReactNode } from 'react'

interface SidebarContextType {
  isCollapsed: boolean
  toggleSidebar: () => void
  viewEnabled: boolean
  toggleView: () => void
  setViewEnabled: (enabled: boolean) => void
  panelsCollapsed: boolean
  togglePanels: () => void
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [viewEnabled, setViewEnabled] = useState(true) // Default to enabled (widgets visible)
  const [panelsCollapsed, setPanelsCollapsed] = useState(false) // Default to panels visible

  const toggleSidebar = () => setIsCollapsed(prev => !prev)

  const toggleView = () => {
    setViewEnabled(prev => !prev)
  }

  const setViewEnabledState = (enabled: boolean) => {
    setViewEnabled(enabled)
  }

  const togglePanels = () => {
    setPanelsCollapsed(prev => !prev)
  }

  return (
    <SidebarContext.Provider value={{ 
      isCollapsed, 
      toggleSidebar,
      viewEnabled,
      toggleView,
      setViewEnabled: setViewEnabledState,
      panelsCollapsed,
      togglePanels
    }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within SidebarProvider')
  }
  return context
}















