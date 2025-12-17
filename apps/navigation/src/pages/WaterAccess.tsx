import { useSidebar } from '../context/SidebarContext'
import './WaterAccess.css'

export default function WaterAccess() {
  const { isCollapsed, toggleSidebar } = useSidebar()

  return (
    <div className="water-access-page">
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

      <iframe
        src="http://localhost:8080/water-access.html"
        className="water-access-iframe"
        title="Water Access"
      />
    </div>
  )
}
