/**
 * Central map layer stacking order.
 *
 * Before this file existed, order was whatever fell out of insertion sequence plus a
 * handful of `beforeId` anchors that pointed at layer ids which no longer exist (Mapbox
 * Studio ids like `waterway-label` against a CARTO basemap, `precipitation-drought-fill`
 * against a layer actually named `precipitation-drought-layer`, `factory-points` against
 * a layer that is never created). Layers added without any anchor — hillshade, factories,
 * data centers, metro, sea level, wildfire — landed on top of everything.
 *
 * Order is now declared once, here, and enforced with `map.moveLayer()` after any layer
 * is added. That makes it self-healing: layers load asynchronously as toggles flip and
 * tiles resolve, and each add re-asserts the whole stack.
 */

import type { Map as MapLibreMap } from 'maplibre-gl'

/**
 * Every custom layer id, ordered BOTTOM → TOP.
 *
 * Read the tiers bottom-up; the last entry paints over everything else.
 * Ids that aren't currently on the map are skipped, so this list can safely name
 * layers that only exist when a toggle is on.
 */
export const MAP_LAYER_ORDER: readonly string[] = [
  // ── Tier 8 (bottom): topographic relief ──────────────────────────────────
  // Terrain shading is context, not data. It belongs under every overlay.
  'hillshade',
  'contours',

  // ── Tier 7: raster overlays ──────────────────────────────────────────────
  // Full-bleed rasters that would otherwise obscure the vector layers above them.
  'temperature-layer',            // future temperature anomaly
  'wildfire-whp-layer',           // USFS wildfire hazard potential
  'precipitation-drought-layer',
  'urban-heat-island-layer',
  'wet-bulb-layer',               // polygon fill, but behaves like a raster wash
  'metro-humidity-heatmap-layer',

  // ── Tier 6.5: groundwater depletion (GRACE) ──────────────────────────────
  // A raster, but grouped with aquifers so the two groundwater views read together.
  'grace-layer',

  // ── Tier 6: sea level rise ───────────────────────────────────────────────
  'sea-level-rise-layer',

  // ── Tier 5: aquifers ─────────────────────────────────────────────────────
  'aquifer-fill',
  'aquifer-outline',
  'aquifer-hover',

  // ── Tier 4: hydrography — rivers, aqueducts, lakes ───────────────────────
  // Casing first so the coloured line draws inside its own outline.
  'lake-fill',
  'lake-outline',
  'canal-lines-casing',
  'canal-lines',
  'river-lines-casing',
  'river-lines',

  // ── Tier 3 (top): point features — icons then labels ─────────────────────
  // Glow/circle → icon → label, per feature, so nothing occludes its own label.
  'datacenter-glow',
  'datacenter-circle',
  'datacenter-zap',
  'factory-circles',
  'factory-icons',
  'dams-circles',
  'dams-icons',
  'metro-circles',
  'river-city-markers',
  // Labels last — always legible, never covered by a marker.
  'metro-humidity-labels',
  'metro-labels',
  'river-city-labels',
  'datacenter-labels',
  'factory-labels',
  'dams-labels',

  // ── Measurement / drawing tools sit above all data ───────────────────────
  'measurement-polygon-layer',
  'measurement-line-layer',
]

/** Fast lookup: layer id → index in MAP_LAYER_ORDER. */
const ORDER_INDEX = new Map(MAP_LAYER_ORDER.map((id, i) => [id, i]))

/**
 * Basemap layer id to insert custom layers *before*.
 *
 * The old code probed Mapbox Studio ids (`waterway-label`, `place-labels`, `poi-label`…).
 * The basemap is now CARTO positron/dark-matter, whose ids are underscore-cased
 * (`waterway_label`, `watername_ocean`, `place_hamlet`…), so every one of those probes
 * missed. We match on shape rather than on a hardcoded list, and cache per style.
 */
export function findBasemapLabelAnchor(map: MapLibreMap): string | undefined {
  let style: ReturnType<MapLibreMap['getStyle']>
  try {
    style = map.getStyle()
  } catch {
    return undefined
  }
  if (!style?.layers) return undefined

  const custom = ORDER_INDEX
  const isSymbol = (l: { id: string; type: string }) =>
    l.type === 'symbol' && !custom.has(l.id)

  // Prefer the first basemap symbol (label) layer — custom layers go beneath place names.
  const firstSymbol = style.layers.find(isSymbol)
  if (firstSymbol) return firstSymbol.id

  // Fall back to any basemap layer whose id looks label-ish, underscore or hyphen cased.
  const labelish = style.layers.find(
    (l) => !custom.has(l.id) && /label|place|poi|waterway|watername/i.test(l.id)
  )
  return labelish?.id
}

/**
 * The id this layer should be inserted *before* to land in the right slot right away.
 *
 * Returns the nearest higher-ordered custom layer that is currently on the map, or the
 * basemap label anchor if this layer belongs on top of the custom stack. Undefined means
 * "append to the very top".
 */
export function getBeforeId(map: MapLibreMap, layerId: string): string | undefined {
  const index = ORDER_INDEX.get(layerId)
  if (index === undefined) return findBasemapLabelAnchor(map)

  for (let i = index + 1; i < MAP_LAYER_ORDER.length; i++) {
    const candidate = MAP_LAYER_ORDER[i]
    try {
      if (map.getLayer(candidate)) return candidate
    } catch {
      // Map torn down mid-call; nothing sensible to anchor to.
      return undefined
    }
  }
  return findBasemapLabelAnchor(map)
}

/**
 * Re-assert the full stacking order against the live map.
 *
 * Walks MAP_LAYER_ORDER from the top down, moving each present layer before the one
 * above it. Idempotent and cheap (a handful of `moveLayer` calls on a style that is
 * already sorted), so it is safe to call after every layer add.
 */
export function enforceLayerOrder(map: MapLibreMap | null | undefined): void {
  if (!map) return
  try {
    if (!map.getStyle()) return
  } catch {
    return // style not loaded, or map destroyed
  }

  // Early-out when the stack is already sorted. Keeps this safe to call from hot paths
  // (every layer add, or a map `idle` handler) without churning the style.
  const present = getCurrentLayerOrder(map)
  const sorted = [...present].sort(
    (a, b) => (ORDER_INDEX.get(a) ?? 0) - (ORDER_INDEX.get(b) ?? 0)
  )
  if (present.length === sorted.length && present.every((id, i) => id === sorted[i])) {
    return
  }

  // Anchor the top of the custom stack beneath the basemap's labels, then stack
  // downward: each layer is moved to sit immediately below the one we placed last.
  let anchor = findBasemapLabelAnchor(map)

  for (let i = MAP_LAYER_ORDER.length - 1; i >= 0; i--) {
    const layerId = MAP_LAYER_ORDER[i]
    try {
      if (!map.getLayer(layerId)) continue
      map.moveLayer(layerId, anchor)
      anchor = layerId
    } catch (error) {
      // A layer can vanish between the getLayer check and the move if a toggle
      // fires mid-pass. Skip it rather than aborting the whole reorder.
      console.debug(`[layerOrder] could not move ${layerId}`, error)
    }
  }
}

/**
 * Wrap `map.addLayer` so the stack re-sorts itself after every add.
 *
 * Layers arrive on their own schedule — a tile URL resolves from the backend minutes
 * after load, a toggle flips, a style change replays the whole setup. Trying to catch
 * all of that from a React dependency array is a losing game: miss one dependency and
 * that layer lands on top of everything, which is exactly the bug this replaces.
 *
 * Hooking the one method every path funnels through makes the ordering unconditional.
 * Re-sorts are coalesced into a microtask so a burst of adds costs a single pass, and
 * enforceLayerOrder() early-outs when nothing moved.
 *
 * Returns a teardown function; safe to call twice on the same map (second is a no-op).
 */
const guarded = new WeakSet<object>()

export function installLayerOrderGuard(map: MapLibreMap): () => void {
  if (guarded.has(map)) return () => {}
  guarded.add(map)

  const original = map.addLayer.bind(map)
  let scheduled = false

  const scheduleReorder = () => {
    if (scheduled) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      enforceLayerOrder(map)
    })
  }

  ;(map as MapLibreMap).addLayer = function patchedAddLayer(
    ...args: Parameters<MapLibreMap['addLayer']>
  ) {
    const result = original(...args)
    scheduleReorder()
    return result
  } as MapLibreMap['addLayer']

  return () => {
    ;(map as MapLibreMap).addLayer = original
    guarded.delete(map)
  }
}

/**
 * Debug helper: the current on-map order of our custom layers, bottom → top.
 * Compare against MAP_LAYER_ORDER to confirm the stack is sorted.
 */
export function getCurrentLayerOrder(map: MapLibreMap): string[] {
  try {
    return (map.getStyle()?.layers ?? [])
      .map((l) => l.id)
      .filter((id) => ORDER_INDEX.has(id))
  } catch {
    return []
  }
}
