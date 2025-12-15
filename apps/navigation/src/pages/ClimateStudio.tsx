import { useSidebar } from '../context/SidebarContext'
import './ClimateStudio.css'

export default function ClimateStudio() {
  const { isCollapsed, toggleSidebar } = useSidebar()

  return (
    <div className="climate-studio-page">
      <button
        onClick={toggleSidebar}
        className="sidebar-toggle"
        title={isCollapsed ? 'Show sidebar' : 'Hide sidebar'}
      >
        {isCollapsed ? (
          // Menu icon (show sidebar)
          <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        ) : (
          // X icon (hide sidebar)
          <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </button>

      <iframe
        src="http://localhost:8080"
        className="climate-studio-iframe"
        title="Climate Studio"
      />
    </div>
  )
}
