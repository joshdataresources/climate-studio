/**
 * Backend URL for climate / Earth Engine API routes.
 *
 * Priority:
 * 1. VITE_NODE_BACKEND_URL (the deployed Flask service)
 * 2. Dev without env → the local Flask service on :5001
 * 3. Production build fallback → the deployed Flask service
 *
 * There is one backend: the Python climate service. The Express server that used to
 * sit in backend/ was never deployed — production has always pointed VITE_NODE_BACKEND_URL
 * straight at Flask — and everything it still served has since moved: NOAA and USFS
 * tiles are fetched direct from source by the browser, and aquifers read a bundled
 * dataset. Dev now points at the same place production does.
 */
const PRODUCTION_CLIMATE_BACKEND = 'https://climate-studio-backend.onrender.com'
const DEV_CLIMATE_BACKEND = 'http://localhost:5001'

export function getBackendBaseUrl(): string {
  const configured = import.meta.env.VITE_NODE_BACKEND_URL?.replace(/\/$/, '')
  if (configured) return configured
  if (import.meta.env.DEV) return DEV_CLIMATE_BACKEND
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
