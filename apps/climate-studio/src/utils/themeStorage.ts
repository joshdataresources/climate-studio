export type Theme = 'dark' | 'light'

export const THEME_STORAGE_KEY = 'cs-theme'
export const THEME_VERSION_KEY = 'cs-theme-version'
/** Bump when changing the default theme so existing users pick up the new default once. */
export const CURRENT_THEME_VERSION = '2'

/** Resolve theme on first load; migrates prior light default to dark once per version bump. */
export function resolveInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'

  const version = localStorage.getItem(THEME_VERSION_KEY)
  if (version !== CURRENT_THEME_VERSION) {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    localStorage.setItem(THEME_VERSION_KEY, CURRENT_THEME_VERSION)
    return 'dark'
  }

  const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null
  if (stored === 'dark' || stored === 'light') return stored
  return 'dark'
}

export function applyThemeToDocument(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.classList.toggle('light', theme === 'light')
}
