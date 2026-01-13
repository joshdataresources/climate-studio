import { useNavigate, useLocation } from 'react-router-dom'
import { useSidebar } from '../../contexts/SidebarContext'
import { useTheme } from '../../contexts/ThemeContext'
import { LayoutGrid, ZoomIn, ZoomOut } from 'lucide-react'
import { useContext } from 'react'
import { MapContext, type MapContextValue } from '../../contexts/MapContext'

// SVG path data for all icons
const SVG_PATHS = {
  logo: "M28.5 35.4062C26.8594 35.4062 25.4648 34.832 24.3164 33.6836C23.168 32.5352 22.5938 31.1406 22.5938 29.5C22.5938 27.8594 23.168 26.4648 24.3164 25.3164C25.4648 24.168 26.8594 23.5938 28.5 23.5938C30.1406 23.5938 31.5352 24.168 32.6836 25.3164C33.832 26.4648 34.4062 27.8594 34.4062 29.5C34.4062 31.1406 33.832 32.5352 32.6836 33.6836C31.5352 34.832 30.1406 35.4062 28.5 35.4062ZM28.5 32.875C29.4375 32.875 30.2344 32.5469 30.8906 31.8906C31.5469 31.2344 31.875 30.4375 31.875 29.5C31.875 28.5625 31.5469 27.7656 30.8906 27.1094C30.2344 26.4531 29.4375 26.125 28.5 26.125C27.5625 26.125 26.7656 26.4531 26.1094 27.1094C25.4531 27.7656 25.125 28.5625 25.125 29.5C25.125 30.4375 25.4531 31.2344 26.1094 31.8906C26.7656 32.5469 27.5625 32.875 28.5 32.875ZM35.7773 43C36.0352 42.25 36.2637 41.4473 36.4629 40.5918C36.6621 39.7363 36.8555 38.7461 37.043 37.6211C35.918 38.8164 34.6172 39.7305 33.1406 40.3633C31.6641 40.9961 30.1172 41.3125 28.5 41.3125C26.0859 41.3125 23.748 41.1602 21.4863 40.8555C19.2246 40.5508 17.0625 40.0938 15 39.4844V36.7773C15.75 37.0352 16.5527 37.2637 17.4082 37.4629C18.2637 37.6621 19.2539 37.8555 20.3789 38.043C19.1836 36.918 18.2695 35.6172 17.6367 34.1406C17.0039 32.6641 16.6875 31.1172 16.6875 29.5C16.6875 27.0625 16.8398 24.7188 17.1445 22.4688C17.4492 20.2188 17.9062 18.0625 18.5156 16H21.2227C20.9414 16.8906 20.6953 17.7871 20.4844 18.6895C20.2734 19.5918 20.0977 20.4883 19.957 21.3789C21.082 20.1836 22.3828 19.2695 23.8594 18.6367C25.3359 18.0039 26.8828 17.6875 28.5 17.6875C30.9375 17.6875 33.2812 17.8398 35.5312 18.1445C37.7812 18.4492 39.9375 18.9062 42 19.5156V22.2227C41.1094 21.9414 40.2129 21.6953 39.3105 21.4844C38.4082 21.2734 37.5117 21.0977 36.6211 20.957C37.8164 22.082 38.7305 23.3828 39.3633 24.8594C39.9961 26.3359 40.3125 27.8828 40.3125 29.5C40.3125 31.9141 40.1543 34.2402 39.8379 36.4785C39.5215 38.7168 39.0586 40.8906 38.4492 43H35.7773ZM28.5 38.7812C31.0781 38.7812 33.2695 37.8789 35.0742 36.0742C36.8789 34.2695 37.7812 32.0781 37.7812 29.5C37.7812 26.9219 36.8789 24.7305 35.0742 22.9258C33.2695 21.1211 31.0781 20.2188 28.5 20.2188C25.9219 20.2188 23.7305 21.1211 21.9258 22.9258C20.1211 24.7305 19.2188 26.9219 19.2188 29.5C19.2188 32.0781 20.1211 34.2695 21.9258 36.0742C23.7305 37.8789 25.9219 38.7812 28.5 38.7812Z",
  climate: "M11.9942 21.6C10.6647 21.6 9.53333 21.132 8.6 20.196C7.66667 19.26 7.2 18.128 7.2 16.8C7.2 16.0488 7.35 15.3486 7.65 14.6993C7.95 14.0498 8.4 13.5083 9 13.075V5.4C9 4.56667 9.29167 3.85833 9.875 3.275C10.4583 2.69167 11.1667 2.4 12 2.4C12.8333 2.4 13.5417 2.69167 14.125 3.275C14.7083 3.85833 15 4.56667 15 5.4V13.075C15.5833 13.5083 16.0292 14.0542 16.3375 14.7125C16.6458 15.3708 16.8 16.0667 16.8 16.8C16.8 18.128 16.3314 19.26 15.3943 20.196C14.4573 21.132 13.3239 21.6 11.9942 21.6ZM10.8 10.8H13.2V9.6H12V8.4H13.2V7.2H12V6H13.2V5.4C13.2 5.06 13.085 4.775 12.855 4.545C12.625 4.315 12.34 4.2 12 4.2C11.66 4.2 11.375 4.315 11.145 4.545C10.915 4.775 10.8 5.06 10.8 5.4V10.8Z",
  waterAccess: "M7.94475 15C8.19825 15 8.4125 14.9143 8.5875 14.7428C8.7625 14.5713 8.85 14.3588 8.85 14.1053C8.85 13.8518 8.76425 13.6375 8.59275 13.4625C8.42125 13.2875 8.20875 13.2 7.95525 13.2C7.70175 13.2 7.4875 13.2858 7.3125 13.4573C7.1375 13.6288 7.05 13.8413 7.05 14.0948C7.05 14.3483 7.13575 14.5625 7.30725 14.7375C7.47875 14.9125 7.69125 15 7.94475 15ZM9.29475 12.3C9.54825 12.3 9.7625 12.2143 9.9375 12.0428C10.1125 11.8713 10.2 11.6588 10.2 11.4053C10.2 11.1518 10.1142 10.9375 9.94275 10.7625C9.77125 10.5875 9.55875 10.5 9.30525 10.5C9.05175 10.5 8.8375 10.5857 8.6625 10.7572C8.4875 10.9287 8.4 11.1413 8.4 11.3948C8.4 11.6483 8.48575 11.8625 8.65725 12.0375C8.82875 12.2125 9.04125 12.3 9.29475 12.3ZM9.29475 17.7C9.54825 17.7 9.7625 17.6142 9.9375 17.4427C10.1125 17.2712 10.2 17.0587 10.2 16.8052C10.2 16.5517 10.1142 16.3375 9.94275 16.1625C9.77125 15.9875 9.55875 15.9 9.30525 15.9C9.05175 15.9 8.8375 15.9858 8.6625 16.1573C8.4875 16.3288 8.4 16.5413 8.4 16.7948C8.4 17.0483 8.48575 17.2625 8.65725 17.4375C8.82875 17.6125 9.04125 17.7 9.29475 17.7ZM10.6448 15C10.8983 15 11.1125 14.9143 11.2875 14.7428C11.4625 14.5713 11.55 14.3588 11.55 14.1053C11.55 13.8518 11.4642 13.6375 11.2927 13.4625C11.1212 13.2875 10.9087 13.2 10.6552 13.2C10.4017 13.2 10.1875 13.2858 10.0125 13.4573C9.8375 13.6288 9.75 13.8413 9.75 14.0948C9.75 14.3483 9.83575 14.5625 10.0073 14.7375C10.1788 14.9125 10.3913 15 10.6448 15ZM10.6448 9.6C10.8983 9.6 11.1125 9.51425 11.2875 9.34275C11.4625 9.17125 11.55 8.95875 11.55 8.70525C11.55 8.45175 11.4642 8.2375 11.2927 8.0625C11.1212 7.8875 10.9087 7.8 10.6552 7.8C10.4017 7.8 10.1875 7.88575 10.0125 8.05725C9.8375 8.22875 9.75 8.44125 9.75 8.69475C9.75 8.94825 9.83575 9.1625 10.0073 9.3375C10.1788 9.5125 10.3913 9.6 10.6448 9.6ZM11.9948 12.3C12.2483 12.3 12.4625 12.2143 12.6375 12.0428C12.8125 11.8713 12.9 11.6588 12.9 11.4053C12.9 11.1518 12.8142 10.9375 12.6427 10.7625C12.4712 10.5875 12.2587 10.5 12.0052 10.5C11.7517 10.5 11.5375 10.5857 11.3625 10.7572C11.1875 10.9287 11.1 11.1413 11.1 11.3948C11.1 11.6483 11.1858 11.8625 11.3573 12.0375C11.5288 12.2125 11.7413 12.3 11.9948 12.3ZM11.9948 17.7C12.2483 17.7 12.4625 17.6142 12.6375 17.4427C12.8125 17.2712 12.9 17.0587 12.9 16.8052C12.9 16.5517 12.8142 16.3375 12.6427 16.1625C12.4712 15.9875 12.2587 15.9 12.0052 15.9C11.7517 15.9 11.5375 15.9858 11.3625 16.1573C11.1875 16.3288 11.1 16.5413 11.1 16.7948C11.1 17.0483 11.1858 17.2625 11.3573 17.4375C11.5288 17.6125 11.7413 17.7 11.9948 17.7ZM13.3447 15C13.5982 15 13.8125 14.9143 13.9875 14.7428C14.1625 14.5713 14.25 14.3588 14.25 14.1053C14.25 13.8518 14.1643 13.6375 13.9928 13.4625C13.8213 13.2875 13.6088 13.2 13.3553 13.2C13.1018 13.2 12.8875 13.2858 12.7125 13.4573C12.5375 13.6288 12.45 13.8413 12.45 14.0948C12.45 14.3483 12.5358 14.5625 12.7073 14.7375C12.8788 14.9125 13.0912 15 13.3447 15ZM13.3447 9.6C13.5982 9.6 13.8125 9.51425 13.9875 9.34275C14.1625 9.17125 14.25 8.95875 14.25 8.70525C14.25 8.45175 14.1643 8.2375 13.9928 8.0625C13.8213 7.8875 13.6088 7.8 13.3553 7.8C13.1018 7.8 12.8875 7.88575 12.7125 8.05725C12.5375 8.22875 12.45 8.44125 12.45 8.69475C12.45 8.94825 12.5358 9.1625 12.7073 9.3375C12.8788 9.5125 13.0912 9.6 13.3447 9.6ZM14.6947 12.3C14.9482 12.3 15.1625 12.2143 15.3375 12.0428C15.5125 11.8713 15.6 11.6588 15.6 11.4053C15.6 11.1518 15.5143 10.9375 15.3428 10.7625C15.1713 10.5875 14.9588 10.5 14.7053 10.5C14.4518 10.5 14.2375 10.5857 14.0625 10.7572C13.8875 10.9287 13.8 11.1413 13.8 11.3948C13.8 11.6483 13.8857 11.8625 14.0572 12.0375C14.2287 12.2125 14.4412 12.3 14.6947 12.3ZM14.6947 17.7C14.9482 17.7 15.1625 17.6142 15.3375 17.4427C15.5125 17.2712 15.6 17.0587 15.6 16.8052C15.6 16.5517 15.5143 16.3375 15.3428 16.1625C15.1713 15.9875 14.9588 15.9 14.7053 15.9C14.4518 15.9 14.2375 15.9858 14.0625 16.1573C13.8875 16.3288 13.8 16.5413 13.8 16.7948C13.8 17.0483 13.8857 17.2625 14.0572 17.4375C14.2287 17.6125 14.4412 17.7 14.6947 17.7ZM16.0447 15C16.2982 15 16.5125 14.9143 16.6875 14.7428C16.8625 14.5713 16.95 14.3588 16.95 14.1053C16.95 13.8518 16.8643 13.6375 16.6928 13.4625C16.5213 13.2875 16.3088 13.2 16.0553 13.2C15.8018 13.2 15.5875 13.2858 15.4125 13.4573C15.2375 13.6288 15.15 13.8413 15.15 14.0948C15.15 14.3483 15.2357 14.5625 15.4072 14.7375C15.5787 14.9125 15.7912 15 16.0447 15ZM12 21.6C9.83333 21.6 7.99167 20.8417 6.475 19.325C4.95833 17.8083 4.2 15.9667 4.2 13.8C4.2 12.1833 4.82083 10.475 6.0625 8.675C7.30417 6.875 9.28333 4.78333 12 2.4C14.7667 4.9 16.7583 7.04167 17.975 8.825C19.1917 10.6083 19.8 12.2708 19.8 13.8125C19.8 15.9708 19.0417 17.8083 17.525 19.325C16.0083 20.8417 14.1667 21.6 12 21.6ZM12 19.8C13.6667 19.8 15.0833 19.2167 16.25 18.05C17.4167 16.8833 18 15.4678 18 13.8033C18 12.6678 17.55 11.425 16.65 10.075C15.75 8.725 14.2 6.95833 12 4.775C9.8 6.95833 8.25 8.725 7.35 10.075C6.45 11.425 6 12.6678 6 13.8033C6 15.4678 6.58333 16.8833 7.75 18.05C8.91667 19.2167 10.3333 19.8 12 19.8Z",
  view: "M3 11V3H11V11H3ZM3 21V13H11V21H3ZM13 11V3H21V11H13ZM13 21V13H21V21H13ZM5 9H9V5H5V9ZM15 9H19V5H15V9ZM15 19H19V15H15V19ZM5 19H9V15H5V19Z",
  lightUI: "M11 5V1H13V5H11ZM17.65 7.75L16.275 6.375L19.075 3.5L20.475 4.925L17.65 7.75ZM19 13V11H23V13H19ZM11 23V19H13V23H11ZM6.35 7.7L3.5 4.925L4.925 3.525L7.75 6.35L6.35 7.7ZM19.05 20.5L16.275 17.625L17.625 16.275L20.475 19.025L19.05 20.5ZM1 13V11H5V13H1ZM4.925 20.5L3.525 19.075L6.325 16.275L7.05 16.95L7.775 17.65L4.925 20.5ZM12 18C10.3333 18 8.91667 17.4167 7.75 16.25C6.58333 15.0833 6 13.6667 6 12C6 10.3333 6.58333 8.91667 7.75 7.75C8.91667 6.58333 10.3333 6 12 6C13.6667 6 15.0833 6.58333 16.25 7.75C17.4167 8.91667 18 10.3333 18 12C18 13.6667 17.4167 15.0833 16.25 16.25C15.0833 17.4167 13.6667 18 12 18ZM12 16C13.1 16 14.0417 15.6083 14.825 14.825C15.6083 14.0417 16 13.1 16 12C16 10.9 15.6083 9.95833 14.825 9.175C14.0417 8.39167 13.1 8 12 8C10.9 8 9.95833 8.39167 9.175 9.175C8.39167 9.95833 8 10.9 8 12C8 13.1 8.39167 14.0417 9.175 14.825C9.95833 15.6083 10.9 16 12 16Z",
  darkUI: "M12.0777 21.6C10.7362 21.6 9.47858 21.3445 8.30475 20.8335C7.13108 20.3225 6.109 19.6318 5.2385 18.7615C4.36817 17.891 3.6775 16.8689 3.1665 15.6953C2.6555 14.5214 2.4 13.2638 2.4 11.9223C2.4 9.59075 3.13333 7.52917 4.6 5.7375C6.06667 3.94583 7.96667 2.83333 10.3 2.4C10.0167 4.05 10.1125 5.61667 10.5875 7.1C11.0625 8.58333 11.875 9.9 13.025 11.05C14.1417 12.1667 15.4583 12.9583 16.975 13.425C18.4917 13.8917 20.0333 13.9833 21.6 13.7C21.2 16 20.0958 17.8917 18.2875 19.375C16.4792 20.8583 14.4092 21.6 12.0777 21.6ZM12.075 19.8C13.5417 19.8 14.9083 19.425 16.175 18.675C17.4417 17.925 18.4 16.9083 19.05 15.625C17.6667 15.5417 16.3458 15.2125 15.0875 14.6375C13.8292 14.0625 12.7083 13.2833 11.725 12.3C10.725 11.3 9.94167 10.175 9.375 8.925C8.80833 7.675 8.475 6.35 8.375 4.95C7.09167 5.63333 6.075 6.6015 5.325 7.8545C4.575 9.10767 4.2 10.4645 4.2 11.925C4.2 14.1125 4.96567 15.9718 6.497 17.503C8.02817 19.0343 9.8875 19.8 12.075 19.8Z",
}

type MenuItemId = 'climate' | 'waterAccess'

interface MenuItemProps {
  id: MenuItemId
  icon: string
  label: string
  path: string
  isActive: boolean
  onClick: () => void
}

interface ToggleItemProps {
  icon: string
  label: string
  isActive: boolean
  onClick: () => void
}

// Menu item component (mutually exclusive selection)
function MenuItem({ icon, label, isActive, onClick }: MenuItemProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  
  return (
    <button
      onClick={onClick}
      className={`content-stretch flex flex-col gap-[4px] items-center justify-center px-[5px] py-[10px] relative rounded-[8px] shrink-0 transition-colors ${
        isActive 
          ? 'bg-[rgba(90,124,236,0.1)] border border-[#5a7cec]' 
          : 'hover:bg-[rgba(90,124,236,0.05)]'
      }`}
      aria-pressed={isActive}
    >
      <div className="relative shrink-0 size-[24px]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 24 24">
          <path 
            d={icon} 
            fill={isActive ? '#5A7CEC' : (isDark ? '#D1D5DB' : '#697487')} 
          />
        </svg>
      </div>
      <p 
        className={`font-['Inter',sans-serif] font-semibold leading-[normal] not-italic relative shrink-0 text-[10px] text-center w-[50px] ${
          isActive ? 'text-[#5a7cec]' : (isDark ? 'text-white' : 'text-black')
        }`}
      >
        {label}
      </p>
    </button>
  )
}

// Toggle item component (independent on/off)
function ToggleItem({ icon, label, isActive, onClick }: ToggleItemProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  
  return (
    <button
      onClick={onClick}
      className={`content-stretch flex flex-col gap-[4px] items-center justify-center px-[5px] py-[10px] relative rounded-[8px] shrink-0 transition-colors ${
        isActive 
          ? 'bg-[rgba(90,124,236,0.1)] border border-[#5a7cec]' 
          : 'hover:bg-[rgba(90,124,236,0.05)]'
      }`}
      aria-pressed={isActive}
    >
      <div className="relative shrink-0 size-[24px]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 24 24">
          <path 
            d={icon} 
            fill={isActive ? '#5A7CEC' : (isDark ? '#D1D5DB' : '#697487')} 
          />
        </svg>
      </div>
      <p 
        className={`font-['Inter',sans-serif] font-semibold leading-[normal] not-italic relative shrink-0 text-[10px] text-center w-[50px] ${
          isActive ? 'text-[#5a7cec]' : (isDark ? 'text-white' : 'text-black')
        }`}
      >
        {label}
      </p>
    </button>
  )
}

export function AppSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isCollapsed, panelsCollapsed, togglePanels } = useSidebar()
  const { theme, toggleTheme } = useTheme()
  
  // Get map context - it might not be available on all routes
  const mapContext = useContext(MapContext) as MapContextValue | undefined
  
  const isDark = theme === 'dark'

  const handleZoomIn = () => {
    if (mapContext) {
      mapContext.setViewport({
        ...mapContext.viewport,
        zoom: Math.min(mapContext.viewport.zoom + 1, 20) // Max zoom level
      })
    }
  }

  const handleZoomOut = () => {
    if (mapContext) {
      mapContext.setViewport({
        ...mapContext.viewport,
        zoom: Math.max(mapContext.viewport.zoom - 1, 1) // Min zoom level
      })
    }
  }

  // Determine active menu item based on current route
  const getActiveMenuItem = (): MenuItemId => {
    if (location.pathname === '/water-access') {
      return 'waterAccess'
    }
    return 'climate' // Default to climate for /, /climate-studio, etc.
  }

  const activeMenuItem = getActiveMenuItem()

  const handleMenuItemClick = (item: MenuItemId) => {
    if (item === 'climate') {
      navigate('/climate-studio')
    } else if (item === 'waterAccess') {
      navigate('/water-access')
    }
  }

  const menuItems = [
    { 
      id: 'climate' as MenuItemId, 
      icon: SVG_PATHS.climate, 
      label: 'Climate',
      path: '/climate-studio'
    },
    { 
      id: 'waterAccess' as MenuItemId, 
      icon: SVG_PATHS.waterAccess, 
      label: 'Water Access',
      path: '/water-access'
    },
  ]

  return (
    <aside className={`app-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
    <div 
      className={`backdrop-blur-[6px] backdrop-filter relative rounded-br-[12px] rounded-tr-[12px] w-[76px] top-[16px] bottom-[16px] h-[calc(100vh-32px)] pointer-events-auto overflow-hidden ${
        isDark ? 'bg-[rgba(0,0,0,0.90)]' : 'bg-[rgba(255,255,255,0.90)]'
      }`}
      style={{ boxShadow: 'var(--widget-box-shadow)' }}
    >
      <div className="flex flex-col h-full isolate items-center p-[8px] relative justify-between">
        {/* Top section: Logo and Menu items */}
        <div className="flex flex-col gap-[8px] items-center relative shrink-0">
          {/* Logo */}
          <div className="flex flex-col gap-[8px] items-center relative shrink-0">
            <div className="h-[59px] relative shrink-0 w-[57px]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 57 59">
                <rect fill={isDark ? '#1F2937' : 'white'} height="59" rx="8" width="57" />
                <path d={SVG_PATHS.logo} fill="#5A7CEC" />
              </svg>
            </div>
            
            {/* Divider */}
            <div className="h-px relative shrink-0 w-full">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 60 1">
                <path d="M60 0V1H0V0H60Z" fill={isDark ? '#FFFFFF' : '#D7D7D7'} fillOpacity={isDark ? '0.15' : '0.45'} />
              </svg>
            </div>

            {/* Menu items (Climate & Water Access) - mutually exclusive */}
            {menuItems.map((item) => (
              <MenuItem
                key={item.id}
                id={item.id}
                icon={item.icon}
                label={item.label}
                path={item.path}
                isActive={activeMenuItem === item.id}
                onClick={() => handleMenuItemClick(item.id)}
              />
            ))}
          </div>
        </div>

        {/* Bottom section: Zoom controls, Panels toggle and UI Mode toggle */}
        <div className="flex flex-col gap-[8px] items-center relative shrink-0">
          {/* Zoom Controls - only show if map context is available */}
          {mapContext && (
            <div className="flex flex-col gap-[4px] items-center relative shrink-0">
              {/* Zoom In */}
              <button
                onClick={handleZoomIn}
                className="content-stretch flex flex-col gap-[4px] items-center justify-center px-[5px] py-[8px] relative rounded-[8px] shrink-0 transition-colors hover:bg-[rgba(90,124,236,0.05)]"
                title="Zoom In"
              >
                <div className="relative shrink-0 size-[24px] flex items-center justify-center">
                  <ZoomIn 
                    className="size-full" 
                    style={{ 
                      color: isDark ? '#D1D5DB' : '#697487'
                    }} 
                  />
                </div>
              </button>

              {/* Zoom Out */}
              <button
                onClick={handleZoomOut}
                className="content-stretch flex flex-col gap-[4px] items-center justify-center px-[5px] py-[8px] relative rounded-[8px] shrink-0 transition-colors hover:bg-[rgba(90,124,236,0.05)]"
                title="Zoom Out"
              >
                <div className="relative shrink-0 size-[24px] flex items-center justify-center">
                  <ZoomOut 
                    className="size-full" 
                    style={{ 
                      color: isDark ? '#D1D5DB' : '#697487'
                    }} 
                  />
                </div>
              </button>
            </div>
          )}

          {/* Divider */}
          <div className="h-px relative shrink-0 w-full">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 60 1">
              <path d="M60 0V1H0V0H60Z" fill={isDark ? '#FFFFFF' : '#D7D7D7'} fillOpacity={isDark ? '0.15' : '0.45'} />
            </svg>
          </div>

          {/* Panels toggle - Hide/Show panels */}
          <button
            onClick={togglePanels}
            className={`content-stretch flex flex-col gap-[4px] items-center justify-center px-[5px] py-[10px] relative rounded-[8px] shrink-0 transition-colors ${
              panelsCollapsed 
                ? 'bg-[rgba(90,124,236,0.1)] border border-[#5a7cec]' 
                : 'hover:bg-[rgba(90,124,236,0.05)]'
            }`}
            aria-pressed={panelsCollapsed}
            title={panelsCollapsed ? "Show panels" : "Hide panels"}
          >
            <div className="relative shrink-0 size-[24px] flex items-center justify-center">
              <LayoutGrid 
                className="size-full" 
                style={{ 
                  color: panelsCollapsed ? '#5A7CEC' : (isDark ? '#D1D5DB' : '#697487')
                }} 
              />
            </div>
            <p 
              className={`font-['Inter',sans-serif] font-semibold leading-[normal] not-italic relative shrink-0 text-[10px] text-center w-[50px] ${
                panelsCollapsed ? 'text-[#5a7cec]' : (isDark ? 'text-white' : 'text-black')
              }`}
            >
              {panelsCollapsed ? 'Show' : 'Hide'}
            </p>
          </button>

          {/* UI Mode toggle - switches between Light and Dark */}
          <ToggleItem
            icon={theme === 'light' ? SVG_PATHS.lightUI : SVG_PATHS.darkUI}
            label={theme === 'light' ? 'Light UI' : 'Dark UI'}
            isActive={false}
            onClick={toggleTheme}
          />
        </div>
      </div>
      
      {/* Border overlay */}
      <div 
        aria-hidden="true" 
        className={`absolute border-[1px_1px_1px_0px] border-solid top-0 right-0 bottom-0 left-0 pointer-events-none rounded-br-[12px] rounded-tr-[12px] ${
          isDark 
            ? 'border-[rgba(255,255,255,0.2)]' 
            : 'border-[rgba(255,255,255,0.5)]'
        }`}
        style={{ boxShadow: 'var(--widget-box-shadow)' }}
      />
    </div>
    </aside>
  )
}
