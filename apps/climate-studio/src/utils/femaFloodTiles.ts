import maplibregl from 'maplibre-gl'
import { toCanvas, canvasToPngBytes, hueAndSaturation, withHue } from './tileCanvas'

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

/**
 * FEMA draws the 0.2% annual chance zone in orange, which is very close to the
 * orange the USFS wildfire layer uses for high hazard — rgb(255,134,0) against
 * rgb(255,170,0). Two unrelated hazards reading as the same colour is worse than
 * either being slightly off-spec, so the orange is rotated to purple on arrival.
 *
 * Purple rather than green: green collides with the wildfire layer's low-hazard end
 * and with the basemap's parks.
 *
 * Done by hue rotation rather than swapping a flat colour. FEMA renders that zone
 * with hatching and anti-aliased edges, so it reaches the tile as a family of
 * darker and paler oranges — a single-colour swap would leave most of it behind.
 * Lightness and saturation are preserved, so the hatch pattern survives intact.
 */
const ORANGE_HUE_RANGE: [number, number] = [15, 45]
// Low, deliberately. The guard exists to leave greys alone — the levee hatching is
// grey and has a saturation near zero — and these tiles carry nothing but FEMA's own
// symbology, so there is no basemap colour to protect. A stricter threshold left an
// orange fringe on every anti-aliased edge.
const MIN_SATURATION = 0.06
const REPLACEMENT_HUE = 280 // violet

/** Rewrite one tile's pixels in place. Exported so it can be tested without a map. */
export function recolorFloodZonePixels(pixels: Uint8ClampedArray): void {
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] === 0) continue
    const { hue, sat } = hueAndSaturation(pixels[i], pixels[i + 1], pixels[i + 2])
    if (sat < MIN_SATURATION) continue
    if (hue < ORANGE_HUE_RANGE[0] || hue > ORANGE_HUE_RANGE[1]) continue
    const [r, g, b] = withHue(pixels[i], pixels[i + 1], pixels[i + 2], REPLACEMENT_HUE)
    pixels[i] = r
    pixels[i + 1] = g
    pixels[i + 2] = b
  }
}

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

      const blob = await response.blob()
      if (blob.size === 0) return { data: new ArrayBuffer(0) }

      const bitmap = await createImageBitmap(blob)
      try {
        const canvas = toCanvas(bitmap.width, bitmap.height)
        const ctx = canvas.getContext('2d') as
          | OffscreenCanvasRenderingContext2D
          | CanvasRenderingContext2D
          | null
        // Without a context the original tile is still correct, just orange.
        if (!ctx) return { data: await blob.arrayBuffer() }

        ctx.drawImage(bitmap, 0, 0)
        const image = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
        recolorFloodZonePixels(image.data)
        ctx.putImageData(image, 0, 0)
        return { data: await canvasToPngBytes(canvas) }
      } finally {
        bitmap.close()
      }
    } catch {
      return { data: new ArrayBuffer(0) }
    }
  })
}
