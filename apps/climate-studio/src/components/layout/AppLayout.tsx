import { ReactNode } from 'react'
import { useSidebar } from '../../contexts/SidebarContext'
import { useTheme } from '../../contexts/ThemeContext'
import { AppSidebar } from './AppSidebar'
import { Layers, Bookmark } from 'lucide-react'
import './layout.css'

interface AppLayoutProps {
  children: ReactNode
}

// SVG path for the logo (same as AppSidebar)
const LOGO_PATH = "M28.5 35.4062C26.8594 35.4062 25.4648 34.832 24.3164 33.6836C23.168 32.5352 22.5938 31.1406 22.5938 29.5C22.5938 27.8594 23.168 26.4648 24.3164 25.3164C25.4648 24.168 26.8594 23.5938 28.5 23.5938C30.1406 23.5938 31.5352 24.168 32.6836 25.3164C33.832 26.4648 34.4062 27.8594 34.4062 29.5C34.4062 31.1406 33.832 32.5352 32.6836 33.6836C31.5352 34.832 30.1406 35.4062 28.5 35.4062ZM28.5 32.875C29.4375 32.875 30.2344 32.5469 30.8906 31.8906C31.5469 31.2344 31.875 30.4375 31.875 29.5C31.875 28.5625 31.5469 27.7656 30.8906 27.1094C30.2344 26.4531 29.4375 26.125 28.5 26.125C27.5625 26.125 26.7656 26.4531 26.1094 27.1094C25.4531 27.7656 25.125 28.5625 25.125 29.5C25.125 30.4375 25.4531 31.2344 26.1094 31.8906C26.7656 32.5469 27.5625 32.875 28.5 32.875ZM35.7773 43C36.0352 42.25 36.2637 41.4473 36.4629 40.5918C36.6621 39.7363 36.8555 38.7461 37.043 37.6211C35.918 38.8164 34.6172 39.7305 33.1406 40.3633C31.6641 40.9961 30.1172 41.3125 28.5 41.3125C26.0859 41.3125 23.748 41.1602 21.4863 40.8555C19.2246 40.5508 17.0625 40.0938 15 39.4844V36.7773C15.75 37.0352 16.5527 37.2637 17.4082 37.4629C18.2637 37.6621 19.2539 37.8555 20.3789 38.043C19.1836 36.918 18.2695 35.6172 17.6367 34.1406C17.0039 32.6641 16.6875 31.1172 16.6875 29.5C16.6875 27.0625 16.8398 24.7188 17.1445 22.4688C17.4492 20.2188 17.9062 18.0625 18.5156 16H21.2227C20.9414 16.8906 20.6953 17.7871 20.4844 18.6895C20.2734 19.5918 20.0977 20.4883 19.957 21.3789C21.082 20.1836 22.3828 19.2695 23.8594 18.6367C25.3359 18.0039 26.8828 17.6875 28.5 17.6875C30.9375 17.6875 33.2812 17.8398 35.5312 18.1445C37.7812 18.4492 39.9375 18.9062 42 19.5156V22.2227C41.1094 21.9414 40.2129 21.6953 39.3105 21.4844C38.4082 21.2734 37.5117 21.0977 36.6211 20.957C37.8164 22.082 38.7305 23.3828 39.3633 24.8594C39.9961 26.3359 40.3125 27.8828 40.3125 29.5C40.3125 31.9141 40.1543 34.2402 39.8379 36.4785C39.5215 38.7168 39.0586 40.8906 38.4492 43H35.7773ZM28.5 38.7812C31.0781 38.7812 33.2695 37.8789 35.0742 36.0742C36.8789 34.2695 37.7812 32.0781 37.7812 29.5C37.7812 26.9219 36.8789 24.7305 35.0742 22.9258C33.2695 21.1211 31.0781 20.2188 28.5 20.2188C25.9219 20.2188 23.7305 21.1211 21.9258 22.9258C20.1211 24.7305 19.2188 26.9219 19.2188 29.5C19.2188 32.0781 20.1211 34.2695 21.9258 36.0742C23.7305 37.8789 25.9219 38.7812 28.5 38.7812Z"

export function AppLayout({ children }: AppLayoutProps) {
  const { isCollapsed, isMobile, mobileLayersOpen, setMobileLayersOpen, mobileViewsOpen, setMobileViewsOpen } = useSidebar()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const toggleViews = () => {
    if (mobileViewsOpen) {
      setMobileViewsOpen(false)
    } else {
      setMobileLayersOpen(false)
      setMobileViewsOpen(true)
    }
  }

  const toggleLayers = () => {
    if (mobileLayersOpen) {
      setMobileLayersOpen(false)
    } else {
      setMobileViewsOpen(false)
      setMobileLayersOpen(true)
    }
  }

  return (
    <div
      className="app-layout"
      data-mobile-layers-open={isMobile && mobileLayersOpen ? '' : undefined}
      data-mobile-views-open={isMobile && mobileViewsOpen ? '' : undefined}
    >
      {/* Mobile: top header bar replaces sidebar */}
      {isMobile && (
        <header className="mobile-header">
          {/* Logo */}
          <div className="mobile-header-logo">
            <svg width="28" height="28" viewBox="14 14 30 30" fill="none">
              <path d={LOGO_PATH} fill="#5A7CEC" />
            </svg>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Views icon */}
          <button
            className={`mobile-header-icon ${mobileViewsOpen ? 'active' : ''}`}
            onClick={toggleViews}
            aria-label={mobileViewsOpen ? 'Close views' : 'Open views'}
          >
            <Bookmark className="w-5 h-5" />
          </button>

          {/* Layers icon */}
          <button
            className={`mobile-header-icon ${mobileLayersOpen ? 'active' : ''}`}
            onClick={toggleLayers}
            aria-label={mobileLayersOpen ? 'Close layers' : 'Open layers'}
          >
            <Layers className="w-5 h-5" />
          </button>
        </header>
      )}

      {/* Desktop: normal sidebar */}
      {!isMobile && <AppSidebar />}

      <div className={`app-main ${!isMobile && isCollapsed ? 'sidebar-collapsed' : ''} ${isMobile ? 'mobile-main' : ''}`}>
        {children}
      </div>
    </div>
  )
}
