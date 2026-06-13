/**
 * Feature flags — set via Vite env vars at build time.
 *
 * Local dev: add to apps/climate-studio/.env.local
 *   VITE_ENABLE_LOCATION_DASHBOARD=true
 */
export const features = {
  /** Location Analysis dashboard at /dashboard (WIP — hidden in production by default). */
  locationDashboard: import.meta.env.VITE_ENABLE_LOCATION_DASHBOARD === 'true',
} as const
