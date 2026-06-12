/**
 * Backend URL for climate / Earth Engine API routes.
 *
 * Priority:
 * 1. VITE_NODE_BACKEND_URL (production Render URL or local Express on :3001)
 * 2. Dev without env → '' so requests use `/api/*` and Vite proxies to :5001
 * 3. Production build fallback → localhost:3001 (override via env in CI)
 */
export function getBackendBaseUrl(): string {
  const configured = import.meta.env.VITE_NODE_BACKEND_URL?.replace(/\/$/, '')
  if (configured) return configured
  if (import.meta.env.DEV) return ''
  return 'http://localhost:3001'
}

export const BACKEND_BASE_URL = getBackendBaseUrl()
