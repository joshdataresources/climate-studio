import { useSidebar } from '../context/SidebarContext'
import { AquiferProjectionView } from 'climate-studio'
import './AquiferProjection.css'

// Import climate-studio styles (includes tailwind and CSS variables)
import 'climate-studio-styles'

export default function AquiferProjection() {
  const { isCollapsed, toggleSidebar } = useSidebar()

  return (
    <div className="aquifer-projection-page">
      <button
        onClick={toggleSidebar}
        className="sidebar-toggle"
        title={isCollapsed ? 'Show sidebar' : 'Hide sidebar'}
      >
        {isCollapsed ? (
          <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        ) : (
          <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </button>

      <AquiferProjectionView />
    </div>
  )
}







