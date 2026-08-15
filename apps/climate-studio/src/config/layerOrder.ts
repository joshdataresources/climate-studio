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
  // Casing first so the coloured line draws inside its own outline. The lines
  // themselves stay below the basemap's place names (they're background context,
  // same as roads); their name labels do not — see river-labels/canal-labels below.
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
  //
  // river-labels/canal-labels ride along their (below-basemap-labels) lines with
  // symbol-placement: 'line', but the label TEXT belongs up here with the other
  // above-basemap-labels symbols. MapLibre resolves overlapping/nearby text by
  // collision priority in stack order — left below the basemap's own dense place-name
  // layer (watername_*, place_*), a river or canal name loses almost every collision
  // against it and silently never renders. Promoting just the text layers here (while
  // the line layers themselves stay in Tier 4) fixes that without changing how the
  // lines look under the basemap's roads/boundaries.
  'metro-humidity-labels',
  'metro-labels',
  'river-city-labels',
  'canal-labels',
  'river-labels',
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
 * Layers that belong ABOVE the basemap's own place names, not below them.
 *
 * The stack straddles the basemap labels rather than sitting entirely under them:
 *
 *     ┌─ measurement tools, our markers and their labels   ← above basemap labels
 *     ├─ basemap place names (MESA, PHOENIX, watername_*)
 *     ├─ rivers, aqueducts, aquifers, sea level, rasters   ← below basemap labels
 *     ├─ basemap roads, boundaries, buildings
 *     └─ topographic relief
 *
 * The split follows what each layer is for. Continuous washes — temperature, wildfire,
 * sea level — read fine with place names on top, and burying the names under them makes
 * the map hard to navigate. But a factory or data center marker IS the subject; a
 * basemap city label sitting across it is just occlusion.
 *
 * Placing our symbol layers above the basemap's also settles label collisions in our
 * favour: MapLibre resolves overlapping text by stack order, so where a marker label and
 * a place name compete for the same pixels, the basemap's yields.
 */
const ABOVE_BASEMAP_LABELS = new Set<string>([
  'datacenter-glow',
  'datacenter-circle',
  'datacenter-zap',
  'factory-circles',
  'factory-icons',
  'dams-circles',
  'dams-icons',
  'metro-circles',
  'river-city-markers',
  'metro-humidity-labels',
  'metro-labels',
  'river-city-labels',
  'canal-labels',
  'river-labels',
  'datacenter-labels',
  'factory-labels',
  'dams-labels',
  'measurement-polygon-layer',
  'measurement-line-layer',
])

/**
 * Basemap layer id to insert custom layers *before*.
 *
 * We want analysis layers to sit above the basemap's geometry — roads, boundaries,
 * buildings — but below its place names, which stay legible on top. So the anchor is the
 * bottom of the basemap's trailing label block.
 *
 * Taking the *first* symbol layer in the style does not work, and the reason is worth
 * recording. CARTO positron interleaves one early symbol layer, `waterway_label`, at
 * index 13 — beneath ~90 road, tunnel, bridge, building and country-boundary layers that
 * come after it:
 *
 *     13  symbol  waterway_label      ← first symbol in the style
 *     14  line    tunnel_service_case
 *     …           road_*, bridge_*, building, boundary_country_*
 *    105  symbol  watername_ocean     ← real start of the label block
 *    106+ symbol  place_*, poi_*, roadname_*
 *
 * Anchoring on `waterway_label` buried every analysis layer under the entire street grid.
 * Instead we walk backwards from the top of the style to find where the contiguous run of
 * label layers begins, which lands on `watername_ocean` and is basemap-agnostic.
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
  const basemap = style.layers.filter((l) => !custom.has(l.id))
  if (!basemap.length) return undefined

  // Walk down from the top while we're still in symbol layers. Where that run starts is
  // the bottom of the label block — everything below it is geometry we want to cover.
  let i = basemap.length - 1
  while (i >= 0 && basemap[i].type === 'symbol') i--
  const labelBlockStart = i + 1

  if (labelBlockStart < basemap.length) return basemap[labelBlockStart].id

  // Style is all symbols (unusual) — fall back to the first one.
  const firstSymbol = basemap.find((l) => l.type === 'symbol')
  if (firstSymbol) return firstSymbol.id

  // No symbol layers at all: fall back to anything label-shaped, else append on top.
  const labelish = basemap.find((l) =>
    /label|place|poi|waterway|watername/i.test(l.id)
  )
  return labelish?.id
}

/**
 * The id this layer should be inserted *before* to land in the right slot right away.
 *
 * Returns the nearest higher-ordered custom layer in the same band (above or below the
 * basemap labels) that is currently on the map. Falls back to the basemap label anchor
 * for a below-labels layer, or undefined — append to the very top — for an above-labels
 * one.
 */
export function getBeforeId(map: MapLibreMap, layerId: string): string | undefined {
  const index = ORDER_INDEX.get(layerId)
  if (index === undefined) return findBasemapLabelAnchor(map)

  const above = ABOVE_BASEMAP_LABELS.has(layerId)

  for (let i = index + 1; i < MAP_LAYER_ORDER.length; i++) {
    const candidate = MAP_LAYER_ORDER[i]
    // A below-labels layer must never anchor to an above-labels one — that would drag it
    // across the basemap labels and undo the split.
    if (!above && ABOVE_BASEMAP_LABELS.has(candidate)) break
    try {
      if (map.getLayer(candidate)) return candidate
    } catch {
      // Map torn down mid-call; nothing sensible to anchor to.
      return undefined
    }
  }

  return above ? undefined : findBasemapLabelAnchor(map)
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

  const anchorId = findBasemapLabelAnchor(map)

  // Early-out when the stack is already correct. Keeps this safe to call from hot paths
  // (every layer add, or a map `idle` handler) without churning the style.
  //
  // "Correct" means two things, and checking only the first is a trap: layers added with
  // no beforeId land on top of the whole style, yet arrive in an order that's already
  // internally sorted — so a relative-order check alone passes them straight through.
  // The banding check is what catches that.
  const present = getCurrentLayerOrder(map)
  const sorted = [...present].sort(
    (a, b) => (ORDER_INDEX.get(a) ?? 0) - (ORDER_INDEX.get(b) ?? 0)
  )
  const internallySorted =
    present.length === sorted.length && present.every((id, i) => id === sorted[i])

  // Every layer must also be on the correct side of the basemap label block.
  let correctlyBanded = true
  if (anchorId) {
    try {
      const ids = (map.getStyle()?.layers ?? []).map((l) => l.id)
      const anchorAt = ids.indexOf(anchorId)
      if (anchorAt >= 0) {
        correctlyBanded = present.every((id) => {
          const at = ids.indexOf(id)
          if (at < 0) return true
          return ABOVE_BASEMAP_LABELS.has(id) ? at > anchorAt : at < anchorAt
        })
      }
    } catch {
      correctlyBanded = false
    }
  }

  if (internallySorted && correctlyBanded) return

  // Walk MAP_LAYER_ORDER from the top down, moving each present layer below the one we
  // placed last. The anchor starts undefined — the very top of the style — so the
  // above-labels band stacks over the basemap's place names. On crossing into the
  // below-labels band we reset the anchor to the label block, dropping the rest beneath.
  let anchor: string | undefined = undefined
  let crossedIntoBelowBand = false

  for (let i = MAP_LAYER_ORDER.length - 1; i >= 0; i--) {
    const layerId = MAP_LAYER_ORDER[i]

    if (!crossedIntoBelowBand && !ABOVE_BASEMAP_LABELS.has(layerId)) {
      crossedIntoBelowBand = true
      anchor = anchorId
    }

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
