/**
 * Backend URL for climate / Earth Engine API routes.
 *
 * Priority:
 * 1. VITE_NODE_BACKEND_URL (production Render URL or local Express on :3001)
 * 2. Dev without env → '' so requests use `/api/*` and Vite proxies to :5001
 * 3. Production build fallback → Render climate service (override via env in CI)
 */
const PRODUCTION_CLIMATE_BACKEND = 'https://climate-studio-backend.onrender.com'

export function getBackendBaseUrl(): string {
  const configured = import.meta.env.VITE_NODE_BACKEND_URL?.replace(/\/$/, '')
  if (configured) return configured
  if (import.meta.env.DEV) return ''
  return PRODUCTION_CLIMATE_BACKEND
}

/** Resolve tile URLs returned by the climate API (relative proxy paths or absolute EE URLs). */
export function resolveClimateTileUrl(tileUrl: string | undefined | null): string {
  if (!tileUrl) return ''
  if (tileUrl.startsWith('http://') || tileUrl.startsWith('https://')) return tileUrl
  const base = getBackendBaseUrl()
  if (tileUrl.startsWith('/')) return `${base}${tileUrl}`
  return tileUrl
}

export const BACKEND_BASE_URL = getBackendBaseUrl()
