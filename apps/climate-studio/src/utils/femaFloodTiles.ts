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
 * NFHL will not draw above its own scale threshold — but the threshold is computed,
 * not fixed, so it can be pushed.
 *
 * Layer 28 carries minScale 36,111, about zoom 14 at the default 96 dpi, and FEMA
 * returns a fully transparent image for anything wider. ArcGIS derives the scale it
 * compares against that threshold from the extent, the image size and the requested
 * dpi — so asking for a lower dpi lowers the computed scale and brings a wider tile
 * under the limit. The geometry returned is the same; only FEMA's idea of how
 * zoomed-in we are changes.
 *
 * Measured cost of doing that, on New Orleans tiles:
 *
 *   z15, z14   dpi 96   1.1 - 1.7s
 *   z13        dpi 48   1.8s
 *   z12        dpi 24   3.9s
 *   z11        dpi 12   25s      <- where it stops being worth it
 *
 * So the layer runs from zoom 12 up. Below that it is not that the zones are hard
 * to see, it is that FEMA takes half a minute per tile to draw them.
 */
export const FEMA_FLOOD_MIN_ZOOM = 12

/** The cheapest dpi that still renders at a given zoom. */
function dpiForZoom(zoom: number): number {
  if (zoom >= 14) return 96
  if (zoom >= 13) return 48
  return 24
}

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
    // Belt and braces: the source's minzoom should prevent this, but below the
    // threshold FEMA takes tens of seconds per tile.
    if (Number(z) < FEMA_FLOOD_MIN_ZOOM) return { data: new ArrayBuffer(0) }

    const query = new URLSearchParams({
      bbox: bboxForTile(Number(z), Number(x), Number(y)),
      bboxSR: '3857',
      imageSR: '3857',
      size: '256,256',
      format: 'png32',
      transparent: 'true',
      layers: `show:${FLOOD_HAZARD_ZONES_LAYER}`,
      dpi: String(dpiForZoom(Number(z))),
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
