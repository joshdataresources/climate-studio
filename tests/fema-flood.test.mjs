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
    .filter({ hasText: /Zoom in/i }).count()
  report.ok('the card explains why nothing is drawn', hint === 1)
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
  await page.close()
}

await browser.close()
process.exit(report.finish() ? 0 : 1)
