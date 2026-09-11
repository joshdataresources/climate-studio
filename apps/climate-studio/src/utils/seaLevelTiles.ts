import maplibregl from 'maplibre-gl'

/**
 * Recolours the NOAA sea level rise tiles as they arrive.
 *
 * The tiles are pre-rendered PNGs proxied straight from NOAA, so their colours are
 * baked into the image — no paint property can restyle them. maplibre's protocol
 * hook lets us intercept each tile, rewrite its pixels, and hand back a PNG.
 *
 * NOAA ships a depth ramp that runs dark navy (deep water, offshore) to pale cyan
 * (shallow, the newly covered land at the edge). We invert that relationship so the
 * open water reads as a light wash and the water actually taking land reads dark:
 *
 *   deep / away from the shore  ->  light blue, fading to fully transparent
 *   shallow / just covering land ->  dark blue, fully opaque
 *
 * Opacity rides the same ramp as the colour. Open water is the great majority of
 * the pixels in a coastal tile and carries no information the basemap does not
 * already show, so the lightest end is 0% opaque and drops out entirely, leaving
 * the encroachment onto land as the only thing the layer draws.
 *
 * The bright green "low-lying areas" class is a different measurement — ground below
 * the water line but not hydrologically connected — so it is passed through untouched.
 */
export const SLR_PROTOCOL = 'slr'

/** Water taking land: dark and solid, so the encroachment is what draws the eye. */
const SHORE_COLOR = [7, 42, 102] as const
/** Open water: the colour the ramp runs out to, by which point it is transparent. */
const OPEN_WATER_COLOR = [183, 224, 245] as const

/**
 * NOAA's low-lying-areas class: ground below the water line that is not
 * hydrologically connected to the sea, so it is not projected to flood from this
 * scenario. It measures something different from the depth ramp, and NOAA draws it
 * in a saturated green that dominates the map. Kept — it is real data — but muted
 * and semi-transparent so it reads as a secondary annotation.
 */
const LOW_LYING_COLOR = [150, 190, 120] as const
const LOW_LYING_ALPHA = 0.45

/**
 * How far, in tile pixels, water fades from fully opaque at the shore to nothing.
 *
 * The fade is spatial rather than depth-based on purpose. NOAA quantises depth, and
 * beyond a shallow fringe every open-water pixel carries the same value — so an
 * alpha taken from the pixel's own colour drops the whole sea at once, leaving a
 * hard edge where the water simply stops. Measuring each pixel's distance to the
 * nearest dry pixel instead gives the gradient you actually want: solid where water
 * meets land, thinning outwards.
 */
const FADE_PIXELS = 40

// Luminance of NOAA's ramp endpoints — rgb(9,9,145) deepest, rgb(192,240,243) shallowest.
const NOAA_DEEPEST_LUMA = 24
const NOAA_SHALLOWEST_LUMA = 227

const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b

/** NOAA's low-lying-areas class, a saturated green that is not part of the depth ramp. */
const isLowLyingGreen = (r: number, g: number, b: number) => g > 150 && r < 140 && b < 140

/**
 * Chamfer distance transform: for every water pixel, roughly how many pixels away
 * the nearest dry pixel is. Two linear passes, 3-4 weights, divided back down at the
 * end — close enough to Euclidean for a visual fade and far cheaper than exact.
 *
 * Pixels beyond the tile edge are unknown rather than dry, so water running off the
 * edge keeps fading outwards instead of hardening into a border on every tile.
 */
function distanceToDryPixel(isWater: Uint8Array, width: number, height: number): Float32Array {
  const INF = 1e9
  const dist = new Float32Array(width * height)
  for (let i = 0; i < dist.length; i++) dist[i] = isWater[i] ? INF : 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      if (dist[i] === 0) continue
      let d = dist[i]
      if (y > 0) d = Math.min(d, dist[i - width] + 3)
      if (x > 0) d = Math.min(d, dist[i - 1] + 3)
      if (y > 0 && x > 0) d = Math.min(d, dist[i - width - 1] + 4)
      if (y > 0 && x < width - 1) d = Math.min(d, dist[i - width + 1] + 4)
      dist[i] = d
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x
      if (dist[i] === 0) continue
      let d = dist[i]
      if (y < height - 1) d = Math.min(d, dist[i + width] + 3)
      if (x < width - 1) d = Math.min(d, dist[i + 1] + 3)
      if (y < height - 1 && x < width - 1) d = Math.min(d, dist[i + width + 1] + 4)
      if (y < height - 1 && x > 0) d = Math.min(d, dist[i + width - 1] + 4)
      dist[i] = d
    }
  }
  for (let i = 0; i < dist.length; i++) dist[i] /= 3
  return dist
}

/** Rewrite one tile's pixels in place. Exported so it can be tested without a map. */
export function recolorSeaLevelPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): void {
  const span = NOAA_SHALLOWEST_LUMA - NOAA_DEEPEST_LUMA
  const count = width * height

  // Water is anything the tile draws that is not the low-lying class. Everything
  // else — transparent gaps, dry land — is what the fade measures distance from.
  const isWater = new Uint8Array(count)
  for (let p = 0; p < count; p++) {
    const i = p * 4
    if (pixels[i + 3] === 0) continue
    if (isLowLyingGreen(pixels[i], pixels[i + 1], pixels[i + 2])) continue
    isWater[p] = 1
  }

  const dist = distanceToDryPixel(isWater, width, height)

  for (let p = 0; p < count; p++) {
    const i = p * 4
    const alpha = pixels[i + 3]
    if (alpha === 0) continue

    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]

    if (isLowLyingGreen(r, g, b)) {
      pixels[i] = LOW_LYING_COLOR[0]
      pixels[i + 1] = LOW_LYING_COLOR[1]
      pixels[i + 2] = LOW_LYING_COLOR[2]
      pixels[i + 3] = alpha * LOW_LYING_ALPHA
      continue
    }

    // Colour still comes from NOAA's own depth reading: 0 at its deepest navy,
    // 1 at its shallowest cyan, mapped onto the inverted ramp.
    let depth = (luma(r, g, b) - NOAA_DEEPEST_LUMA) / span
    depth = depth < 0 ? 0 : depth > 1 ? 1 : depth

    pixels[i] = OPEN_WATER_COLOR[0] + (SHORE_COLOR[0] - OPEN_WATER_COLOR[0]) * depth
    pixels[i + 1] = OPEN_WATER_COLOR[1] + (SHORE_COLOR[1] - OPEN_WATER_COLOR[1]) * depth
    pixels[i + 2] = OPEN_WATER_COLOR[2] + (SHORE_COLOR[2] - OPEN_WATER_COLOR[2]) * depth

    // Opacity comes from distance to dry land: 100% where water meets land, 0% once
    // it is FADE_PIXELS out to sea.
    const fade = 1 - Math.min(dist[p], FADE_PIXELS) / FADE_PIXELS
    pixels[i + 3] = alpha * fade
  }
}

const toCanvas = (width: number, height: number) =>
  typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(width, height)
    : Object.assign(document.createElement('canvas'), { width, height })

async function canvasToPngBytes(canvas: OffscreenCanvas | HTMLCanvasElement): Promise<ArrayBuffer> {
  if ('convertToBlob' in canvas) {
    return (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer()
  }
  const blob: Blob | null = await new Promise(resolve =>
    (canvas as HTMLCanvasElement).toBlob(resolve, 'image/png')
  )
  if (!blob) throw new Error('Could not encode recoloured sea level tile')
  return blob.arrayBuffer()
}

let registered = false

/**
 * NOAA's own tile path, so the neighbouring tiles can be named: the ArcGIS cache is
 * addressed /tile/{z}/{row}/{col}, i.e. y before x.
 */
const TILE_URL = /\/MapServer\/tile\/(\d+)\/(\d+)\/(\d+)(?:$|\?)/

/**
 * NOAA serves these tiles with permissive CORS, so the browser fetches them straight
 * from coast.noaa.gov. They used to be relayed through our own backend, which meant
 * every tile was downloaded twice — once by the server from NOAA, once by the browser
 * from the server — and the server half was billed as egress. The proxy existed for
 * a CORS problem that does not exist.
 */
export function noaaSeaLevelTileUrl(feet: number): string {
  return `https://coast.noaa.gov/arcgis/rest/services/dc_slr/slr_${feet}ft/MapServer/tile/{z}/{y}/{x}`
}

/**
 * Tiles already fetched, keyed by URL. The fade needs each tile's eight neighbours,
 * and neighbours are overwhelmingly tiles the map is drawing anyway — so with this
 * cache the mosaic costs roughly one extra ring of tiles around the viewport rather
 * than nine fetches per tile. Bounded so panning cannot grow it without limit.
 */
const tileCache = new Map<string, Promise<ImageBitmap | null>>()
const TILE_CACHE_LIMIT = 400

function fetchTileBitmap(url: string, signal?: AbortSignal): Promise<ImageBitmap | null> {
  const hit = tileCache.get(url)
  if (hit) return hit

  const pending = (async () => {
    try {
      const response = await fetch(url, { signal })
      if (!response.ok) return null
      const blob = await response.blob()
      if (blob.size === 0) return null
      return await createImageBitmap(blob)
    } catch {
      return null
    }
  })()

  if (tileCache.size >= TILE_CACHE_LIMIT) {
    const oldest = tileCache.keys().next().value
    if (oldest !== undefined) tileCache.delete(oldest)
  }
  tileCache.set(url, pending)
  return pending
}

/**
 * Draw the tile with its eight neighbours around it and return the whole 3x3 block.
 *
 * The opacity fade measures how far each water pixel is from dry land. Run on a lone
 * tile, water flowing off the edge cannot see the land just beyond it and fades at a
 * different rate on each side of the join, which shows up as a visible seam along
 * every tile boundary. Giving the transform a tile's worth of context in each
 * direction — comfortably more than FADE_PIXELS — removes that.
 */
async function buildMosaic(
  url: string,
  centre: ImageBitmap,
  signal?: AbortSignal
): Promise<{ canvas: OffscreenCanvas | HTMLCanvasElement; ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D } | null> {
  const match = url.match(TILE_URL)
  const w = centre.width
  const h = centre.height

  const canvas = toCanvas(w * 3, h * 3)
  const ctx = canvas.getContext('2d') as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null
  if (!ctx) return null

  ctx.drawImage(centre, w, h)
  if (!match) return { canvas, ctx } // unrecognised URL: centre only, no neighbours

  const [, z, y, x] = match
  const span = 2 ** Number(z)
  const neighbours: Array<Promise<void>> = []

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue
      const ny = Number(y) + dy
      if (ny < 0 || ny >= span) continue          // no tiles past the poles
      const nx = (Number(x) + dx + span) % span   // longitude wraps
      const neighbourUrl = url.replace(TILE_URL, `/MapServer/tile/${z}/${ny}/${nx}`)
      neighbours.push(
        fetchTileBitmap(neighbourUrl, signal).then(bmp => {
          if (!bmp) return
          ctx.drawImage(bmp, (dx + 1) * w, (dy + 1) * h)
        })
      )
    }
  }

  await Promise.all(neighbours)
  return { canvas, ctx }
}

/**
 * Register the `slr://` protocol. Idempotent — the map effect can call it freely.
 * Prefix a normal tile URL with `slr://` to route it through the recolouring.
 */
export function registerSeaLevelTileProtocol(): void {
  if (registered) return
  registered = true

  maplibregl.addProtocol(SLR_PROTOCOL, async (params, abortController) => {
    const url = params.url.replace(`${SLR_PROTOCOL}://`, '')
    const signal = abortController.signal
    const centre = await fetchTileBitmap(url, signal)
    // A missing or empty tile is the proxy's "no data here" case.
    if (!centre) return { data: new ArrayBuffer(0) }

    try {
      const mosaic = await buildMosaic(url, centre, signal)
      if (!mosaic) return { data: new ArrayBuffer(0) }
      const { canvas, ctx } = mosaic
      const w = centre.width
      const h = centre.height

      const image = ctx.getImageData(0, 0, w * 3, h * 3)
      recolorSeaLevelPixels(image.data, w * 3, h * 3)
      ctx.putImageData(image, 0, 0)

      // Hand back only the tile that was asked for.
      const out = toCanvas(w, h)
      const outCtx = out.getContext('2d') as
        | OffscreenCanvasRenderingContext2D
        | CanvasRenderingContext2D
        | null
      if (!outCtx) return { data: new ArrayBuffer(0) }
      outCtx.drawImage(canvas as CanvasImageSource, -w, -h)

      return { data: await canvasToPngBytes(out) }
    } catch {
      return { data: new ArrayBuffer(0) }
    }
  })
}
