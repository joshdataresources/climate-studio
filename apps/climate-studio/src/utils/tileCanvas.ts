/**
 * Canvas helpers shared by the tile protocol handlers.
 *
 * Both the NOAA sea level tiles and the FEMA flood tiles arrive as pre-rendered
 * PNGs with their colours baked in, so restyling either means rewriting pixels on
 * arrival rather than setting a paint property.
 */

export function toCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  return typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(width, height)
    : Object.assign(document.createElement('canvas'), { width, height })
}

export async function canvasToPngBytes(
  canvas: OffscreenCanvas | HTMLCanvasElement
): Promise<ArrayBuffer> {
  if ('convertToBlob' in canvas) {
    return (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer()
  }
  const blob: Blob | null = await new Promise(resolve =>
    (canvas as HTMLCanvasElement).toBlob(resolve, 'image/png')
  )
  if (!blob) throw new Error('Could not encode recoloured tile')
  return blob.arrayBuffer()
}

/** Hue of an RGB colour in degrees, plus how saturated it is (0-1). */
export function hueAndSaturation(r: number, g: number, b: number): { hue: number; sat: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min
  if (delta === 0) return { hue: 0, sat: 0 }

  let hue: number
  if (max === rn) hue = 60 * (((gn - bn) / delta) % 6)
  else if (max === gn) hue = 60 * ((bn - rn) / delta + 2)
  else hue = 60 * ((rn - gn) / delta + 4)
  if (hue < 0) hue += 360

  const lightness = (max + min) / 2
  const sat = lightness === 0 || lightness === 1 ? 0 : delta / (1 - Math.abs(2 * lightness - 1))
  return { hue, sat }
}

/**
 * Re-hue a pixel, keeping its lightness and saturation.
 *
 * Preserving both is the point: these tiles carry hatching and anti-aliased edges
 * as darker and paler variants of the same hue, so replacing a single flat colour
 * would leave most of a zone untouched. Rotating the hue moves the whole family.
 */
export function withHue(r: number, g: number, b: number, hue: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const lightness = (max + min) / 2
  const delta = max - min
  const sat = delta === 0 || lightness === 0 || lightness === 1
    ? 0
    : delta / (1 - Math.abs(2 * lightness - 1))

  const c = (1 - Math.abs(2 * lightness - 1)) * sat
  const hp = ((hue % 360) + 360) % 360 / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let rgb: [number, number, number]
  if (hp < 1) rgb = [c, x, 0]
  else if (hp < 2) rgb = [x, c, 0]
  else if (hp < 3) rgb = [0, c, x]
  else if (hp < 4) rgb = [0, x, c]
  else if (hp < 5) rgb = [x, 0, c]
  else rgb = [c, 0, x]

  const m = lightness - c / 2
  return [
    Math.round((rgb[0] + m) * 255),
    Math.round((rgb[1] + m) * 255),
    Math.round((rgb[2] + m) * 255),
  ]
}
