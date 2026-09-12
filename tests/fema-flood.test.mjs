import { launchBrowser, createReporter, BASE_URL, BACKEND_URL } from './lib/browser.mjs'

/**
 * FEMA flood zones: fetched direct from FEMA, and gated on zoom.
 *
 * NFHL layer 28 carries minScale 36,111 — roughly zoom 14 — and returns a fully
 * transparent image for anything further out however much flood zone is there. A
 * layer that switches on and silently draws nothing is the failure mode the USFS
 * wildfire layer had for months, so the zoom gate is part of the contract.
 */
const report = createReporter('FEMA flood zones')
const browser = await launchBrowser()

// ── zoomed out: no requests, and the UI says why ───────────────────────────────
{
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const fema = []
  page.on('request', r => { if (r.url().includes('hazards.fema.gov')) fema.push(r.url()) })
  await page.goto(`${BASE_URL}/?lat=29.95&lng=-90.07&z=9`, { waitUntil: 'domcontentloaded' })
  await page.locator('.layer-card').first().waitFor({ timeout: 30000 })
  await page.waitForTimeout(2500)
  await page.locator('.layer-card').filter({ hasText: 'FEMA Flood Zones' }).first().click()
  await page.waitForTimeout(6000)

  report.ok('no NFHL tiles requested below the usable zoom', fema.length === 0, `${fema.length} requests`)
  const hint = await page.locator('.layer-card').filter({ hasText: 'FEMA Flood Zones' })
    .filter({ hasText: /of 12 needed/i }).count()
  report.ok('the card names the zoom the layer needs', hint === 1)
  // A bare "zoom in" reads as broken; the card shows how much further to go.
  const progress = await page.locator('.layer-card').filter({ hasText: 'FEMA Flood Zones' })
    .filter({ hasText: /to go/ }).count()
  report.ok('the toggle shows how far from the usable zoom you are', progress === 1)
  await page.close()
}

// ── zoomed in: real tiles, straight from FEMA ──────────────────────────────────
{
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const fema = [], viaBackend = [], bad = []
  page.on('request', r => {
    if (r.url().includes('hazards.fema.gov')) fema.push(r.url())
    if (r.url().startsWith(BACKEND_URL) && /flood|nfhl/i.test(r.url())) viaBackend.push(r.url())
  })
  page.on('response', r => { if (r.url().includes('hazards.fema.gov') && r.status() >= 400) bad.push(r.status()) })
  const errs = []
  page.on('pageerror', e => errs.push(String(e).slice(0, 90)))

  await page.goto(`${BASE_URL}/?lat=29.95&lng=-90.07&z=12`, { waitUntil: 'domcontentloaded' })
  await page.locator('.layer-card').first().waitFor({ timeout: 30000 })
  await page.waitForTimeout(2500)
  await page.locator('.layer-card').filter({ hasText: 'FEMA Flood Zones' }).first().click()
  await page.waitForTimeout(14000)

  report.ok(`tiles are requested at street level (${fema.length})`, fema.length > 0)
  report.ok('tiles come straight from FEMA, not through our backend', viaBackend.length === 0,
    viaBackend.slice(0, 2).join(' | '))
  report.ok('FEMA returned no errors', bad.length === 0, bad.slice(0, 3).join(','))
  report.ok('no uncaught page errors', errs.length === 0, errs.slice(0, 2).join(' | '))
  const zoneText = await page.locator('.layer-card').filter({ hasText: 'FEMA Flood Zones' })
    .filter({ hasText: /Mapped flood zones/i }).count()
  report.ok('the card confirms mapped zones are showing', zoneText === 1)

  const attributed = await page.locator('text=FEMA National Flood Hazard Layer').count()
  report.ok('the source is attributed on the map', attributed > 0)

  // The tiles carry FEMA's baked symbology, so the legend has to explain it.
  const legend = await page.locator('.feature-card').filter({ hasText: '1% annual chance flood' }).count()
  report.ok('a legend card explains what the colours mean', legend === 1)
  const floodway = await page.locator('.feature-card').filter({ hasText: /Regulatory floodway/i }).count()
  report.ok('the legend covers the hatched classes too', floodway === 1)
  await page.close()
}

// ── the 0.2% zone must not arrive orange ───────────────────────────────────────
{
  const page = await browser.newPage()
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' })
  const r = await page.evaluate(async () => {
    const mod = await import('/src/utils/femaFloodTiles.ts')
    const HALF = 20037508.342789244
    const bbox = (z, x, y) => { const n = 2 ** z
      return [(x/n)*2*HALF-HALF, HALF-((y+1)/n)*2*HALF, ((x+1)/n)*2*HALF-HALF, HALF-(y/n)*2*HALF].join(',') }
    const q = new URLSearchParams({ bbox: bbox(13, 2046, 3381), bboxSR: '3857', imageSR: '3857',
      size: '256,256', format: 'png32', transparent: 'true', layers: 'show:28', dpi: '48', f: 'image' })
    const res = await fetch(`https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/export?${q}`)
    const bmp = await createImageBitmap(await res.blob())
    const c = new OffscreenCanvas(256, 256); const ctx = c.getContext('2d'); ctx.drawImage(bmp, 0, 0)
    const img = ctx.getImageData(0, 0, 256, 256)
    const before = new Uint8ClampedArray(img.data)
    mod.recolorFloodZonePixels(img.data)

    const hue = (r, g, b) => {
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
      if (!d) return -1
      let h = mx === r ? 60 * (((g - b) / d) % 6) : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4)
      return h < 0 ? h + 360 : h
    }
    let orangeBefore = 0, orangeAfter = 0, cyanBefore = 0, cyanAfter = 0
    for (let i = 0; i < before.length; i += 4) {
      if (before[i + 3] === 0) continue
      const hb = hue(before[i], before[i+1], before[i+2])
      const ha = hue(img.data[i], img.data[i+1], img.data[i+2])
      if (hb >= 15 && hb <= 45) orangeBefore++
      if (ha >= 15 && ha <= 45) orangeAfter++
      if (before[i] === 0 && before[i+1] === 229 && before[i+2] === 255) cyanBefore++
      if (img.data[i] === 0 && img.data[i+1] === 229 && img.data[i+2] === 255) cyanAfter++
    }
    return { orangeBefore, orangeAfter, cyanBefore, cyanAfter }
  })
  report.ok(`the 0.2% zone arrives orange from FEMA (${r.orangeBefore} px)`, r.orangeBefore > 1000)
  // Not zero: a handful of near-grey pixels on anti-aliased edges carry a trace of
  // warm hue. Catching those too would mean dropping the saturation guard far enough
  // to recolour the levee hatching, which is legitimately grey. A fringe under a
  // tenth of a percent is invisible; losing the hatching would not be.
  const fringe = (100 * r.orangeAfter) / r.orangeBefore
  report.ok(`orange is gone bar an anti-aliasing fringe (${fringe.toFixed(3)}%)`,
    fringe < 0.1, `${r.orangeAfter} px left of ${r.orangeBefore}`)
  report.ok(`the 1% zone's cyan is untouched (${r.cyanBefore} px)`,
    r.cyanAfter === r.cyanBefore && r.cyanBefore > 1000)
  await page.close()
}

await browser.close()
process.exit(report.finish() ? 0 : 1)
