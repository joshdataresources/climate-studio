import { launchBrowser, createReporter, BASE_URL } from './lib/browser.mjs'

/**
 * The figure the Climate Projections panel shows and the inundation the map draws
 * must come from the same projection, and that projection must be the published one.
 *
 * These drifted before: the panel computed a number from invented constants while
 * the map drew a hard-coded 3 ft, so the slider moved the text and not the coastline.
 */
const report = createReporter('Projections are sourced and consistent')
const browser = await launchBrowser()

// NOAA Technical Report NOS 01 (2022), GMSL scenarios, converted to feet.
const CASES = [
  { year: 2050, scenario: 'rcp45', feet: 1, label: 'Intermediate, mid-century' },
  { year: 2100, scenario: 'rcp45', feet: 3, label: 'Intermediate, 2100 (1.0 m)' },
  { year: 2100, scenario: 'rcp85', feet: 5, label: 'Intermediate-High, 2100 (1.5 m)' },
  { year: 2100, scenario: 'rcp26', feet: 2, label: 'Intermediate-Low, 2100 (0.5 m)' },
]

for (const { year, scenario, feet, label } of CASES) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const requested = new Set()
  page.on('request', r => {
    const m = r.url().match(/slr_(\d+)ft/)
    if (m) requested.add(Number(m[1]))
  })
  await page.goto(
    `${BASE_URL}/?lat=40.61&lng=-73.83&z=10&layers=sea_level_rise&year=${year}&scenario=${scenario}`,
    { waitUntil: 'domcontentloaded' }
  )
  await page.waitForTimeout(11000)
  const shown = await page.evaluate(() => (document.body.innerText.match(/~([\d.]+)ft/) || [])[1])
  const tiles = [...requested]
  report.ok(
    `${label}: panel ~${shown}ft, tiles ${tiles.join(',') || 'none'}, expected ${feet}ft`,
    tiles.length === 1 && tiles[0] === feet && Math.round(Number(shown)) === feet
  )
  await page.close()
}

// The three unsourced figures must stay gone.
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' })
await page.locator('.layer-card').first().waitFor({ timeout: 30000 })
await page.waitForTimeout(2500)
const body = await page.evaluate(() => document.body.innerText)
report.ok('no unsourced Drought Index figure is shown', !/Drought Index/.test(body))
report.ok('no unsourced Soil Moisture figure is shown', !/Soil Moisture/.test(body))
report.ok('sources are cited in the panel', /NOAA Technical Report|IPCC AR6/.test(body))

await browser.close()
process.exit(report.finish() ? 0 : 1)
