import type { ClimateControlsState } from '@climate-studio/core'

/**
 * Saved views live in localStorage, which is scoped to one browser profile — they
 * cannot follow you to another browser, another machine, or another person. A share
 * link carries the whole view in the URL instead: position, zoom, active layers,
 * forecast year and emissions scenario.
 *
 *   /?lat=40.71&lng=-73.9&z=9.4&layers=aquifers,factories&year=2065&scenario=rcp45
 *
 * Opening that URL reproduces the view anywhere, with no server and no account.
 */
export interface ShareableView {
  viewport?: { center: { lat: number; lng: number }; zoom: number }
  activeLayerIds?: string[]
  controls?: Partial<ClimateControlsState>
}

interface ShareableSource {
  viewport: { center: { lat: number; lng: number }; zoom: number }
  activeLayerIds?: string[]
  controls?: Partial<ClimateControlsState>
}

const PARAMS = {
  lat: 'lat',
  lng: 'lng',
  zoom: 'z',
  layers: 'layers',
  year: 'year',
  scenario: 'scenario',
} as const

const round = (value: number, places: number) => {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

const finiteInRange = (raw: string | null, min: number, max: number): number | null => {
  if (raw === null || raw.trim() === '') return null
  const value = Number(raw)
  if (!Number.isFinite(value) || value < min || value > max) return null
  return value
}

/** Serialise a view into query params. Coordinates are trimmed to keep links short. */
export function buildShareParams(view: ShareableSource): URLSearchParams {
  const params = new URLSearchParams()
  params.set(PARAMS.lat, String(round(view.viewport.center.lat, 5)))
  params.set(PARAMS.lng, String(round(view.viewport.center.lng, 5)))
  params.set(PARAMS.zoom, String(round(view.viewport.zoom, 2)))

  if (view.activeLayerIds?.length) {
    params.set(PARAMS.layers, view.activeLayerIds.join(','))
  }
  if (typeof view.controls?.projectionYear === 'number') {
    params.set(PARAMS.year, String(view.controls.projectionYear))
  }
  if (typeof view.controls?.scenario === 'string' && view.controls.scenario) {
    params.set(PARAMS.scenario, view.controls.scenario)
  }
  return params
}

/** Absolute link to a view, suitable for pasting into another browser. */
export function buildShareUrl(view: ShareableSource, base?: string): string {
  const root =
    base ??
    (typeof window === 'undefined'
      ? ''
      : `${window.location.origin}${window.location.pathname}`)
  return `${root}?${buildShareParams(view).toString()}`
}

/**
 * Read a view out of the current URL. Returns null when the URL carries nothing
 * usable, so a normal visit falls through to the stored saved views.
 *
 * Every field is validated and independently optional: a link with only a position
 * moves the map and leaves layers alone, and a garbled parameter is dropped rather
 * than being allowed to poison the whole view.
 */
export function readSharedView(search?: string): ShareableView | null {
  const query = search ?? (typeof window === 'undefined' ? '' : window.location.search)
  if (!query) return null

  let params: URLSearchParams
  try {
    params = new URLSearchParams(query)
  } catch {
    return null
  }

  const shared: ShareableView = {}

  const lat = finiteInRange(params.get(PARAMS.lat), -90, 90)
  const lng = finiteInRange(params.get(PARAMS.lng), -180, 180)
  const zoom = finiteInRange(params.get(PARAMS.zoom), 0, 24)
  // A position is only meaningful with both coordinates; zoom alone can default.
  if (lat !== null && lng !== null) {
    shared.viewport = { center: { lat, lng }, zoom: zoom ?? 10 }
  }

  const layers = params.get(PARAMS.layers)
  if (layers) {
    const ids = layers.split(',').map(id => id.trim()).filter(Boolean)
    if (ids.length) shared.activeLayerIds = ids
  }

  const controls: Partial<ClimateControlsState> = {}
  const year = finiteInRange(params.get(PARAMS.year), 1900, 2200)
  if (year !== null) controls.projectionYear = Math.round(year)
  const scenario = params.get(PARAMS.scenario)
  if (scenario && /^[a-z0-9_-]{1,32}$/i.test(scenario)) controls.scenario = scenario
  if (Object.keys(controls).length) shared.controls = controls

  return Object.keys(shared).length ? shared : null
}

/**
 * Copy text to the clipboard. navigator.clipboard is unavailable outside a secure
 * context — which includes reaching the dev server over a LAN IP such as
 * http://192.168.1.162:8080 — so fall back to a hidden textarea there.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the legacy path
  }

  try {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}
