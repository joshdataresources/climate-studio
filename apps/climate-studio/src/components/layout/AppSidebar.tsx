import { Link, useLocation } from 'react-router-dom'
import { useSidebar } from '../../contexts/SidebarContext'
import { useTheme } from '../../contexts/ThemeContext'
import { Thermometer, Droplets, Sun, Moon } from 'lucide-react'
import CycloneIcon from '../../assets/cyclone-icon.svg'

export function AppSidebar() {
  const location = useLocation()
  const { isCollapsed } = useSidebar()
  const { theme, toggleTheme } = useTheme()

  const navItems = [
    {
      path: '/climate-studio',
      label: 'Climate Studio',
      icon: <Thermometer />
    },
    {
      path: '/water-access',
      label: 'Water Access',
      icon: <Droplets />
    },
  ]

  const isActive = (path: string) => 
    location.pathname === path || (path === '/climate-studio' && location.pathname === '/')

  return (
    <aside className={`app-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar-header">
        <div className="logo-icon">
          <img src={CycloneIcon} alt="Climate Suite Logo" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
            title={item.label}
          >
            <div className="nav-icon">{item.icon}</div>
          </Link>
        ))}
      </nav>
      
      {/* Theme Toggle */}
      <div className="sidebar-footer">
        <button
          onClick={toggleTheme}
          className="theme-toggle"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
        </button>
      </div>
    </aside>
  )
}









