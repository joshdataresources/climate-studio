import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

const MOBILE_BREAKPOINT = 768
const TABLET_BREAKPOINT = 1280

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches
    }
    return false
  })

  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}

interface SidebarContextType {
  isCollapsed: boolean
  toggleSidebar: () => void
  viewEnabled: boolean
  toggleView: () => void
  setViewEnabled: (enabled: boolean) => void
  panelsCollapsed: boolean
  togglePanels: () => void
  isMobile: boolean
  isTablet: boolean
  mobileMenuOpen: boolean
  setMobileMenuOpen: (open: boolean) => void
  mobileLayersOpen: boolean
  setMobileLayersOpen: (open: boolean) => void
  mobileViewsOpen: boolean
  setMobileViewsOpen: (open: boolean) => void
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export function SidebarProvider({ children }: { children: ReactNode }) {
  const isMobile = useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT}px)`)
  const isTablet = useMediaQuery(`(min-width: ${MOBILE_BREAKPOINT + 1}px) and (max-width: ${TABLET_BREAKPOINT}px)`)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [viewEnabled, setViewEnabled] = useState(true)
  const [panelsCollapsed, setPanelsCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileLayersOpen, setMobileLayersOpen] = useState(false)
  const [mobileViewsOpen, setMobileViewsOpen] = useState(false)

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    if (isMobile) {
      setIsCollapsed(true)
      setMobileMenuOpen(false)
      setMobileLayersOpen(false)
      setMobileViewsOpen(false)
    } else {
      setIsCollapsed(false)
    }
  }, [isMobile])

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
      togglePanels,
      isMobile,
      isTablet,
      mobileMenuOpen,
      setMobileMenuOpen,
      mobileLayersOpen,
      setMobileLayersOpen,
      mobileViewsOpen,
      setMobileViewsOpen,
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















