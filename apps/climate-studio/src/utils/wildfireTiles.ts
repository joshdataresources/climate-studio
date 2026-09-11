import maplibregl from 'maplibre-gl'

/**
 * Wildfire Hazard Potential tiles, fetched straight from the USFS image service.
 *
 * The service is an ArcGIS ImageServer, which renders an arbitrary bounding box
 * rather than serving a z/x/y tile cache — so a tile URL template cannot address it
 * directly and a protocol handler has to translate each tile into a bbox request.
 * That translation used to live in our own backend, which meant every tile was
 * downloaded twice and the server half was billed as egress. USFS sends permissive
 * CORS headers, so the browser can do it itself.
 */
export const WHP_PROTOCOL = 'whp'

const IMAGE_SERVER =
  'https://imagery.geoplatform.gov/iipp/rest/services/Fire_Aviation/' +
  'USFS_EDW_RMRS_WRC_WildfireHazardPotential/ImageServer/exportImage'

/** Half the Web Mercator world, in metres. */
const HALF = 20037508.342789244

/** Tile URL template for a maplibre raster source. */
export function wildfireTileUrl(): string {
  return `${WHP_PROTOCOL}://{z}/{x}/{y}`
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

/** Register the `whp://` protocol. Idempotent — the map effect can call it freely. */
export function registerWildfireTileProtocol(): void {
  if (registered) return
  registered = true

  maplibregl.addProtocol(WHP_PROTOCOL, async (params, abortController) => {
    const match = params.url.match(/^whp:\/\/(\d+)\/(\d+)\/(\d+)$/)
    // An unrecognised URL yields an empty tile rather than an error, so one bad
    // request cannot tear down the whole layer.
    if (!match) return { data: new ArrayBuffer(0) }

    const [, z, x, y] = match
    const query = new URLSearchParams({
      bbox: bboxForTile(Number(z), Number(x), Number(y)),
      bboxSR: '3857',
      imageSR: '3857',
      size: '256,256',
      format: 'png32',
      transparent: 'true',
      f: 'image',
    })

    try {
      const response = await fetch(`${IMAGE_SERVER}?${query}`, { signal: abortController.signal })
      // USFS migrated this service once already (the old host 403s every request).
      // Draw nothing rather than failing loudly if it moves again.
      if (!response.ok) return { data: new ArrayBuffer(0) }
      return { data: await response.arrayBuffer() }
    } catch {
      return { data: new ArrayBuffer(0) }
    }
  })
}
