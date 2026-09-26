import maplibregl from 'maplibre-gl'
import { toCanvas, canvasToPngBytes } from './tileCanvas'

/**
 * Precipitation tiles, recoloured in the browser to the legend's ramp.
 *
 * Earth Engine paints these tiles on the climate service, so the colours are
 * baked in on arrival. Keeping the map in step with the legend used to mean
 * redeploying that service every time the ramp changed, and until it was, the
 * map and the legend disagreed. Recolouring here makes the legend's ramp the
 * one that is drawn, whichever ramp the service happens to be running.
 *
 * Each pixel is placed on the ramp by its nearest colour in any ramp the
 * service has used (KNOWN_SERVICE_RAMPS), then redrawn in PRECIPITATION_RAMP.
 * The new ramp is in that list too, so a redeployed service passes through
 * unchanged.
 */

/** Dry to wet: bright orange through white to blue. The legends read this. */
export const PRECIPITATION_RAMP = [
  '#d94801', '#f16913', '#fd8d3c', '#fdae6b', '#fdd0a2',
  '#f7f7f7',
  '#c6dbef', '#9ecae1', '#6baed6', '#2171b5', '#08519c',
]

export const PRECIPITATION_GRADIENT_CSS = `linear-gradient(to right, ${PRECIPITATION_RAMP.join(', ')})`

/** Ramps the climate service has painted with, each dry to wet. */
const KNOWN_SERVICE_RAMPS: string[][] = [
  PRECIPITATION_RAMP,
  // ColorBrewer BrBG (brown to teal), used until the orange-blue change.
  ['#543005', '#8c510a', '#bf812d', '#dfc27d', '#f6e8c3', '#f5f5f5',
   '#c7eae5', '#80cdc1', '#35978f', '#01665e', '#003c30'],
]

export const PRECIP_PROTOCOL = 'precip'

type RGB = [number, number, number]
const hex = (h: string): RGB => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as RGB

/** Sample a ramp at t (0-1), linearly between stops. */
function sample(stops: RGB[], t: number): RGB {
  const s = Math.max(0, Math.min(1, t)) * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(s))
  const f = s - i
  const a = stops[i], b = stops[i + 1]
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
}

const STEPS = 128
const Q = 5 // bits per channel in the lookup cube (32 levels)
let lookup: Uint8ClampedArray | null = null

/**
 * A 32x32x32 cube from quantised input colour to output colour, built once.
 * Per-pixel nearest-colour search over every ramp would cost hundreds of
 * comparisons for each of 65,536 pixels per tile. The cube does it in one read.
 */
function buildLookup(): Uint8ClampedArray {
  const samples: { c: RGB; t: number }[] = []
  for (const ramp of KNOWN_SERVICE_RAMPS) {
    const stops = ramp.map(hex)
    for (let k = 0; k < STEPS; k++) samples.push({ c: sample(stops, k / (STEPS - 1)), t: k / (STEPS - 1) })
  }
  const out = PRECIPITATION_RAMP.map(hex)
  const levels = 1 << Q
  const cube = new Uint8ClampedArray(levels * levels * levels * 3)
  const step = 256 / levels
  for (let r = 0; r < levels; r++) {
    for (let g = 0; g < levels; g++) {
      for (let b = 0; b < levels; b++) {
        const cr = r * step + step / 2, cg = g * step + step / 2, cb = b * step + step / 2
        let best = 0, bestD = Infinity
        for (let i = 0; i < samples.length; i++) {
          const c = samples[i].c
          const d = (c[0] - cr) ** 2 + (c[1] - cg) ** 2 + (c[2] - cb) ** 2
          if (d < bestD) { bestD = d; best = i }
        }
        const rgb = sample(out, samples[best].t)
        const o = ((r * levels + g) * levels + b) * 3
        cube[o] = rgb[0]; cube[o + 1] = rgb[1]; cube[o + 2] = rgb[2]
      }
    }
  }
  return cube
}

/** Rewrite one tile's pixels in place. Exported so it can be tested without a map. */
export function recolorPrecipitationPixels(pixels: Uint8ClampedArray): void {
  if (!lookup) lookup = buildLookup()
  const levels = 1 << Q
  const shift = 8 - Q
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] === 0) continue
    const o = (((pixels[i] >> shift) * levels + (pixels[i + 1] >> shift)) * levels + (pixels[i + 2] >> shift)) * 3
    pixels[i] = lookup[o]
    pixels[i + 1] = lookup[o + 1]
    pixels[i + 2] = lookup[o + 2]
  }
}

/** Route a service tile URL template through the recolouring. */
export function precipitationTileUrl(serviceTileUrl: string): string {
  return `${PRECIP_PROTOCOL}://${serviceTileUrl}`
}

let registered = false

/** Register the `precip://` protocol. Idempotent. */
export function registerPrecipitationTileProtocol(): void {
  if (registered) return
  registered = true

  maplibregl.addProtocol(PRECIP_PROTOCOL, async (params, abortController) => {
    const url = params.url.replace(`${PRECIP_PROTOCOL}://`, '')
    try {
      const response = await fetch(url, { signal: abortController.signal })
      if (!response.ok) return { data: new ArrayBuffer(0) }
      const blob = await response.blob()
      if (blob.size === 0) return { data: new ArrayBuffer(0) }

      const bitmap = await createImageBitmap(blob)
      try {
        const canvas = toCanvas(bitmap.width, bitmap.height)
        const ctx = canvas.getContext('2d', { willReadFrequently: true }) as
          | OffscreenCanvasRenderingContext2D
          | CanvasRenderingContext2D
          | null
        // Without a context, show the service's own colours rather than nothing.
        if (!ctx) return { data: await blob.arrayBuffer() }
        ctx.drawImage(bitmap, 0, 0)
        const image = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
        recolorPrecipitationPixels(image.data)
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
