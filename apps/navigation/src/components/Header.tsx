import { Link, useLocation } from 'react-router-dom'
import './Header.css'

export default function Header() {
  const location = useLocation()

  const navItems = [
    { path: '/climate-studio', label: 'Climate Studio' },
    // Add more menu items as you build more sections
    // { path: '/section-2', label: 'Section 2' },
    // { path: '/section-3', label: 'Section 3' },
  ]

  return (
    <header className="header">
      <div className="header-content">
        <h1 className="logo">
          <Link to="/">Climate Suite</Link>
        </h1>

        <nav className="nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
