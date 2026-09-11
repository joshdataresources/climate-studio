import { launchBrowser, createReporter, BASE_URL, BACKEND_URL } from './lib/browser.mjs'
let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log(`  PASS  ${n}`)) : (fail++, console.log(`  FAIL  ${n}${x ? ' :: ' + x : ''}`)) }
const browser = await launchBrowser()
const page = await browser.newPage()
await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' })

const r = await page.evaluate(async (BACKEND_URL) => {
  const mod = await import('/src/utils/seaLevelTiles.ts')
  const F = 6, Z = 12, X0 = 1205, Y0 = 1540, NX = 5, NY = 3, W = 256, H = 256
  const load = async (x, y) => {
    const res = await fetch(`${BACKEND_URL}/api/tiles/noaa-slr/${F}/${Z}/${x}/${y}.png`)
    if (!res.ok) return null
    const b = await res.blob(); if (!b.size) return null
    return await createImageBitmap(b)
  }
  const grid = []
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) grid.push({ i, j, bmp: await load(X0 + i, Y0 + j) })

  const big = new OffscreenCanvas(W * NX, H * NY); const bctx = big.getContext('2d')
  for (const g of grid) if (g.bmp) bctx.drawImage(g.bmp, g.i * W, g.j * H)
  const img = bctx.getImageData(0, 0, W * NX, H * NY)
  const before = new Uint8ClampedArray(img.data)
  mod.recolorSeaLevelPixels(img.data, W * NX, H * NY)
  const after = img.data
  const wide = W * NX, tall = H * NY

  const isGreen = (r, g, b) => g > 150 && r < 140 && b < 140
  const isDry = p => { const i = p * 4; return before[i+3] === 0 || isGreen(before[i], before[i+1], before[i+2]) }

  // brute-force distance to dry, for a sample of water pixels
  const dryList = []
  for (let p = 0; p < wide * tall; p++) if (isDry(p)) dryList.push(p)
  const sample = []
  for (let p = 0; p < wide * tall; p += 997) {
    if (isDry(p)) continue
    const px = p % wide, py = (p / wide) | 0
    let best = 1e9
    for (let k = 0; k < dryList.length; k += 13) {
      const q = dryList[k], qx = q % wide, qy = (q / wide) | 0
      const d = Math.hypot(px - qx, py - qy)
      if (d < best) best = d
    }
    sample.push({ dist: best, alpha: after[p * 4 + 3] })
  }
  const near = sample.filter(s => s.dist <= 4)
  const far = sample.filter(s => s.dist >= 60)

  let greenN = 0, greenRecoloured = 0, greenAlpha = 0
  let transparentTouched = 0
  for (let p = 0; p < wide * tall; p++) {
    const i = p * 4
    if (before[i+3] === 0) { if (after[i+3] !== 0) transparentTouched++; continue }
    if (isGreen(before[i], before[i+1], before[i+2])) {
      greenN++
      greenAlpha += after[i+3]
      if (after[i] === 150 && after[i+1] === 190 && after[i+2] === 120) greenRecoloured++
    }
  }
  return {
    nearN: near.length, nearMin: Math.min(...near.map(s => s.alpha)),
    farN: far.length, farMax: Math.max(...far.map(s => s.alpha)),
    greenN, greenRecoloured, greenMeanAlpha: greenN ? +(greenAlpha / greenN).toFixed(1) : null,
    transparentTouched,
  }
}, BACKEND_URL)

console.log('\nSea level rise recolour')
ok(`water at the shore stays solid (${r.nearN} px sampled, min alpha ${r.nearMin})`,
  r.nearN > 0 && r.nearMin >= 200, `min ${r.nearMin}`)
ok(`open water beyond the fade is fully transparent (${r.farN} px sampled, max alpha ${r.farMax})`,
  r.farN > 0 && r.farMax === 0, `max ${r.farMax}`)
ok(`low-lying class recoloured to the muted tone (${r.greenN} px)`,
  r.greenN > 0 && r.greenRecoloured === r.greenN, `${r.greenRecoloured}/${r.greenN}`)
ok(`low-lying class is semi-transparent, mean alpha ${r.greenMeanAlpha} of 255`,
  r.greenMeanAlpha > 90 && r.greenMeanAlpha < 140, String(r.greenMeanAlpha))
ok('transparent pixels left alone', r.transparentTouched === 0, String(r.transparentTouched))
await browser.close()
console.log(`\n${pass}/${pass + fail} passed`)
process.exit(fail === 0 ? 0 : 1)
