import { launchBrowser, createReporter, BASE_URL, BACKEND_URL } from './lib/browser.mjs'

/**
 * Tile bytes must not be relayed through our own backend.
 *
 * Relaying meant every tile was downloaded twice — once by the server from the
 * upstream, once by the browser from the server — and the server half was billed as
 * egress. It reached 111 GB in a month against a 5 GB allowance. Both upstreams send
 * permissive CORS headers, so the browser fetches them itself.
 *
 * This is the regression guard: if a tile layer is ever pointed back at our own
 * origin, this fails.
 */
const report = createReporter('Tiles are fetched direct from source')
const browser = await launchBrowser()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })

const requests = []
page.on('request', r => requests.push(r.url()))
const failures = []
page.on('response', r => {
  const u = r.url()
  if (r.status() >= 400 && (u.includes('coast.noaa.gov') || u.includes('geoplatform.gov'))) {
    failures.push(`${r.status()} ${u.slice(0, 80)}`)
  }
})

// Jamaica Bay: coastal, and inside the USFS wildfire coverage.
await page.goto(
  `${BASE_URL}/?lat=40.61&lng=-73.83&z=10&layers=sea_level_rise&year=2065&scenario=rcp85`,
  { waitUntil: 'domcontentloaded' }
)
await page.locator('.layer-card').first().waitFor({ timeout: 30000 })
await page.waitForTimeout(3000)
await page.locator('.layer-card').filter({ hasText: 'Wildfire Hazard' }).first().click()
await page.waitForTimeout(12000)

const noaa = requests.filter(u => u.includes('coast.noaa.gov'))
const usfs = requests.filter(u => u.includes('geoplatform.gov'))
const proxied = requests.filter(u =>
  u.startsWith(BACKEND_URL) && (u.includes('/api/tiles/noaa-slr/') || u.includes('/api/tiles/wildfire-whp/'))
)

report.ok(`sea level tiles come from coast.noaa.gov (${noaa.length} requests)`, noaa.length > 0)
report.ok(`wildfire tiles come from geoplatform.gov (${usfs.length} requests)`, usfs.length > 0)
report.ok('no tile bytes relayed through our own backend', proxied.length === 0,
  proxied.slice(0, 3).join(' | '))
report.ok('upstreams returned no errors', failures.length === 0, failures.slice(0, 3).join(' | '))

await browser.close()
process.exit(report.finish() ? 0 : 1)
