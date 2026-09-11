import maplibregl from 'maplibre-gl'

/**
 * FEMA National Flood Hazard Layer, fetched straight from FEMA.
 *
 * NFHL is an ArcGIS MapServer that renders an arbitrary bounding box rather than
 * serving a z/x/y tile cache, so each tile has to be translated into a bbox request
 * — the same shape as the USFS wildfire layer. FEMA sends permissive CORS headers,
 * so the browser does it directly and no bytes pass through our backend.
 */
export const FEMA_FLOOD_PROTOCOL = 'nfhl'

const MAP_SERVER =
  'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/export'

/** Layer 28, "Flood Hazard Zones" — the SFHA polygons people mean by "floodplain". */
const FLOOD_HAZARD_ZONES_LAYER = 28

/**
 * NFHL will not draw below its own scale threshold.
 *
 * Layer 28 carries minScale 36,111, which in Web Mercator is about zoom 14 — so
 * FEMA returns a fully transparent image for anything zoomed further out, however
 * much flood zone is actually there. This is parcel-level data and that is a
 * property of the source, not something we can override.
 *
 * The source is declared with this minzoom so maplibre does not request tiles it
 * cannot use, and the UI says to zoom in rather than showing an empty layer that
 * looks broken.
 */
export const FEMA_FLOOD_MIN_ZOOM = 14

/** Half the Web Mercator world, in metres. */
const HALF = 20037508.342789244

/** Tile URL template for a maplibre raster source. */
export function femaFloodTileUrl(): string {
  return `${FEMA_FLOOD_PROTOCOL}://{z}/{x}/{y}`
}

function bboxForTile(z: number, x: number, y: number): string {
  const n = 2 ** z
  const minX = (x / n) * 2 * HALF - HALF
  const maxX = ((x + 1) / n) * 2 * HALF - HALF
  const maxY = HALF - (y / n) * 2 * HALF
  const minY = HALF - ((y + 1) / n) * 2 * HALF
  return `${minX},${minY},${maxX},${maxY}`
}

let registered = false

/** Register the `nfhl://` protocol. Idempotent — the map effect can call it freely. */
export function registerFemaFloodTileProtocol(): void {
  if (registered) return
  registered = true

  maplibregl.addProtocol(FEMA_FLOOD_PROTOCOL, async (params, abortController) => {
    const match = params.url.match(/^nfhl:\/\/(\d+)\/(\d+)\/(\d+)$/)
    if (!match) return { data: new ArrayBuffer(0) }

    const [, z, x, y] = match
    // Belt and braces: the source's minzoom should prevent this, but a request
    // below the threshold would only ever come back blank.
    if (Number(z) < FEMA_FLOOD_MIN_ZOOM) return { data: new ArrayBuffer(0) }

    const query = new URLSearchParams({
      bbox: bboxForTile(Number(z), Number(x), Number(y)),
      bboxSR: '3857',
      imageSR: '3857',
      size: '256,256',
      format: 'png32',
      transparent: 'true',
      layers: `show:${FLOOD_HAZARD_ZONES_LAYER}`,
      f: 'image',
    })

    try {
      const response = await fetch(`${MAP_SERVER}?${query}`, { signal: abortController.signal })
      // Draw nothing rather than failing loudly if FEMA moves or rate-limits us.
      if (!response.ok) return { data: new ArrayBuffer(0) }
      return { data: await response.arrayBuffer() }
    } catch {
      return { data: new ArrayBuffer(0) }
    }
  })
}
