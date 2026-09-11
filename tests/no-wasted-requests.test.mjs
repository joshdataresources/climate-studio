import { launchBrowser, createReporter, BASE_URL, BACKEND_URL } from './lib/browser.mjs'

/**
 * A layer must not fetch something it never reads, and a failing fetch must not
 * retry forever.
 *
 * wet_bulb declared /api/climate/wet-bulb-temperature, so activating it fired an
 * Earth Engine hexagon query across the viewport that exceeded EE's 5,000-element
 * limit and 500'd every time — then retried every 30 seconds, indefinitely, per open
 * tab. Nothing read the response: the layer draws from bundled metro data.
 */
const report = createReporter('No wasted backend requests')
const browser = await launchBrowser()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })

const api = []
page.on('request', r => { if (r.url().startsWith(BACKEND_URL)) api.push(r.url()) })
const failed = []
page.on('response', r => { if (r.url().startsWith(BACKEND_URL) && r.status() >= 500) failed.push(`${r.status()} ${r.url().slice(0, 70)}`) })

await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' })
await page.locator('.layer-card').first().waitFor({ timeout: 30000 })
// Long enough that the old 30s retry loop would have fired at least twice.
await page.waitForTimeout(75000)

const wetBulb = api.filter(u => u.includes('wet-bulb-temperature'))
report.ok('wet bulb endpoint is never called', wetBulb.length === 0, `${wetBulb.length} requests`)
report.ok('no 5xx from the backend', failed.length === 0, failed.slice(0, 3).join(' | '))

// Nothing should be requested more than a handful of times in a static minute.
const counts = new Map()
for (const u of api) counts.set(u, (counts.get(u) ?? 0) + 1)
const hot = [...counts.entries()].filter(([, n]) => n > 4).map(([u, n]) => `${n}x ${u.slice(0, 60)}`)
report.ok('no endpoint is called repeatedly on an idle page', hot.length === 0, hot.slice(0, 3).join(' | '))

await browser.close()
process.exit(report.finish() ? 0 : 1)
