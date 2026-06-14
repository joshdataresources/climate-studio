/**
 * Feature flags — set via Vite env vars at build time.
 *
 * Local dev: add to apps/climate-studio/.env.local
 *   VITE_ENABLE_LOCATION_DASHBOARD=true
 *   VITE_ENABLE_CITY_DASHBOARD_CARDS=true   # per-city outlook tabs (off until data is ready)
 */
export const features = {
  /** Location Analysis dashboard at /dashboard (WIP — hidden in production by default). */
  locationDashboard: import.meta.env.VITE_ENABLE_LOCATION_DASHBOARD === 'true',
  /** Per-city dashboard tabs (Future Outlook, city metrics). Off until metro data is differentiated. */
  cityDashboardCards: import.meta.env.VITE_ENABLE_CITY_DASHBOARD_CARDS === 'true',
} as const
