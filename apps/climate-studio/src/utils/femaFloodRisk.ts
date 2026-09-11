/**
 * County-level flood risk from FEMA's National Risk Index, for the zoom levels
 * where the flood zones themselves cannot be drawn.
 *
 * FEMA's National Flood Hazard Layer — the actual SFHA polygons — will not render
 * above roughly zoom 14 (see femaFloodTiles.ts). There is no pre-rendered national
 * flood tile service, and forcing NFHL wider by lowering the requested dpi costs
 * 4 to 60 seconds per tile. So a wide view has to come from somewhere else.
 *
 * NRI has no scale threshold and covers every US county, and it is already the
 * source the resilience index scores flood from. It is a different measurement at a
 * different resolution — expected annual loss percentiles per county, not mapped
 * flood extents — so the UI labels it as risk rather than letting it read as
 * floodplain.
 *
 * The data is bundled rather than fetched. FEMA's county FeatureServer takes 19-20
 * seconds to return the national extent, whatever combination of
 * maxAllowableOffset, geometryPrecision and quantizationParameters you ask for —
 * fine for a build step, unusable as a layer fetch. NRI publishes annually, so this
 * is static in practice. Regenerate with scripts/build-county-flood-risk.py.
 */

import countyFloodRisk from '../data/county_flood_risk.json'

export interface FloodRiskBounds {
  north: number
  south: number
  east: number
  west: number
}

/** Light to dark purple. Deliberately unlike the navy of sea level rise, the
 *  brown-teal of precipitation, and the warm ramp of wildfire hazard. */
export const FLOOD_RISK_COLORS = [
  '#f2f0f7', '#dadaeb', '#bcbddc', '#9e9ac8', '#807dba', '#6a51a3', '#4a1486',
] as const

export function floodRiskColor(percentile: number): string {
  const i = Math.min(
    FLOOD_RISK_COLORS.length - 1,
    Math.max(0, Math.floor((percentile / 100) * FLOOD_RISK_COLORS.length))
  )
  return FLOOD_RISK_COLORS[i]
}

/** Bounding box of a feature, for a cheap viewport test. */
function featureBounds(geometry: any): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const visit = (node: any) => {
    if (typeof node[0] === 'number') {
      if (node[0] < minX) minX = node[0]
      if (node[0] > maxX) maxX = node[0]
      if (node[1] < minY) minY = node[1]
      if (node[1] > maxY) maxY = node[1]
      return
    }
    for (const child of node) visit(child)
  }
  visit(geometry.coordinates)
  return [minX, minY, maxX, maxY]
}

const source = countyFloodRisk as unknown as GeoJSON.FeatureCollection
// Computed once: the geometry never changes, only which slice of it is on screen.
const withBounds = source.features.map(feature => ({
  feature,
  bounds: featureBounds(feature.geometry),
}))

/**
 * Counties intersecting `bounds`, coloured and ready for a maplibre source.
 *
 * Synchronous — it is a filter over bundled data, not a request — so the layer
 * appears with the toggle rather than twenty seconds later.
 */
export function countyFloodRiskFor(bounds: FloodRiskBounds): GeoJSON.FeatureCollection {
  const features = withBounds
    .filter(({ bounds: b }) =>
      b[0] <= bounds.east && b[2] >= bounds.west && b[1] <= bounds.north && b[3] >= bounds.south)
    .map(({ feature }) => {
      const pct = (feature.properties?.pct as number) ?? null
      return {
        ...feature,
        properties: {
          ...feature.properties,
          floodColor: pct === null ? 'rgba(0,0,0,0)' : floodRiskColor(pct),
        },
      }
    })
  return { type: 'FeatureCollection', features }
}
