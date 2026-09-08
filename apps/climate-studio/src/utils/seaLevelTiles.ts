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
 *   deep / away from the shore  ->  light blue
 *   shallow / just covering land ->  dark blue
 *
 * The bright green "low-lying areas" class is a different measurement — ground below
 * the water line but not hydrologically connected — so it is passed through untouched.
 */
export const SLR_PROTOCOL = 'slr'

/** Water far from shore: a light wash that stays out of the way. */
const DEEP_COLOR = [183, 224, 245] as const
/** Water taking land: dark, so the encroachment is what draws the eye. */
const SHALLOW_COLOR = [7, 42, 102] as const

// Luminance of NOAA's ramp endpoints — rgb(9,9,145) deepest, rgb(192,240,243) shallowest.
const NOAA_DEEPEST_LUMA = 24
const NOAA_SHALLOWEST_LUMA = 227

const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b

/** NOAA's low-lying-areas class, a saturated green that is not part of the depth ramp. */
const isLowLyingGreen = (r: number, g: number, b: number) => g > 150 && r < 140 && b < 140

/** Rewrite one tile's pixels in place. Exported so it can be tested without a map. */
export function recolorSeaLevelPixels(pixels: Uint8ClampedArray): void {
  const span = NOAA_SHALLOWEST_LUMA - NOAA_DEEPEST_LUMA

  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3]
    if (alpha === 0) continue

    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]
    if (isLowLyingGreen(r, g, b)) continue

    // 0 at NOAA's deepest navy, 1 at its shallowest cyan.
    let depth = (luma(r, g, b) - NOAA_DEEPEST_LUMA) / span
    depth = depth < 0 ? 0 : depth > 1 ? 1 : depth

    pixels[i] = DEEP_COLOR[0] + (SHALLOW_COLOR[0] - DEEP_COLOR[0]) * depth
    pixels[i + 1] = DEEP_COLOR[1] + (SHALLOW_COLOR[1] - DEEP_COLOR[1]) * depth
    pixels[i + 2] = DEEP_COLOR[2] + (SHALLOW_COLOR[2] - DEEP_COLOR[2]) * depth
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
 * Register the `slr://` protocol. Idempotent — the map effect can call it freely.
 * Prefix a normal tile URL with `slr://` to route it through the recolouring.
 */
export function registerSeaLevelTileProtocol(): void {
  if (registered) return
  registered = true

  maplibregl.addProtocol(SLR_PROTOCOL, async (params, abortController) => {
    const url = params.url.replace(`${SLR_PROTOCOL}://`, '')
    const response = await fetch(url, { signal: abortController.signal })
    if (!response.ok) throw new Error(`Sea level tile ${response.status}`)

    const blob = await response.blob()
    // An empty body is the proxy's "no data here" case; hand back the bytes as-is.
    if (blob.size === 0) return { data: await blob.arrayBuffer() }

    const bitmap = await createImageBitmap(blob)
    try {
      const canvas = toCanvas(bitmap.width, bitmap.height)
      const ctx = canvas.getContext('2d') as
        | OffscreenCanvasRenderingContext2D
        | CanvasRenderingContext2D
        | null
      if (!ctx) return { data: await blob.arrayBuffer() }

      ctx.drawImage(bitmap, 0, 0)
      const image = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
      recolorSeaLevelPixels(image.data)
      ctx.putImageData(image, 0, 0)

      return { data: await canvasToPngBytes(canvas) }
    } finally {
      bitmap.close()
    }
  })
}
