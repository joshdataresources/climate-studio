/**
 * Backend URL for climate / Earth Engine API routes.
 *
 * Priority:
 * 1. VITE_NODE_BACKEND_URL (production Render URL or local Express on :3001)
 * 2. Dev without env → the local Express backend on :3001
 * 3. Production build fallback → Render climate service (override via env in CI)
 *
 * Dev used to return '' here, sending requests to `/api/*` and letting the Vite
 * proxy forward them to Flask on :5001. But the routes are split: Flask serves the
 * Earth Engine ones, while /api/usgs/aquifers and /api/usgs/streamflow exist only on
 * the Express backend — so those 404'd in dev, silently, with the layer switching on
 * and drawing nothing. Express proxies the climate routes through to Flask, so
 * pointing at it makes one front door serve everything, which is also how production
 * works (VITE_NODE_BACKEND_URL points at the Express service there). It matches the
 * :3001 default every other caller already hardcodes.
 */
const PRODUCTION_CLIMATE_BACKEND = 'https://climate-studio-backend.onrender.com'
const DEV_NODE_BACKEND = 'http://localhost:3001'

export function getBackendBaseUrl(): string {
  const configured = import.meta.env.VITE_NODE_BACKEND_URL?.replace(/\/$/, '')
  if (configured) return configured
  if (import.meta.env.DEV) return DEV_NODE_BACKEND
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
