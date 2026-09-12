import { launchBrowser, createReporter, BASE_URL } from './lib/browser.mjs'

/**
 * The sea level layer inverts NOAA's palette — dark where water takes land, fading
 * to nothing offshore — and recolours NOAA's low-lying class. Nobody can read that
 * without a key, and a key taken from NOAA would be backwards.
 *
 * This card existed only in one of the two Features panels, so at desktop width the
 * layer drew a gradient with no legend at all.
 */
const report = createReporter('Sea level rise legend')
const browser = await launchBrowser()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })

await page.goto(
  `${BASE_URL}/?lat=29.95&lng=-90.07&z=11&layers=sea_level_rise&year=2100&scenario=rcp85`,
  { waitUntil: 'domcontentloaded' }
)
await page.locator('.layer-card').first().waitFor({ timeout: 30000 })
await page.waitForTimeout(12000)

const card = page.locator('.feature-card').filter({ hasText: 'Sea Level Rise' })
report.ok('the legend card is present at desktop width', await card.count() === 1)

const text = (await card.first().innerText()).replace(/\s+/g, ' ')
report.ok('it explains the depth gradient', /fading out to open sea/i.test(text))
report.ok('it explains the low-lying class', /Low-lying land/i.test(text))
report.ok('it says why low-lying land is not flooded', /not connected to the sea/i.test(text))
report.ok('it names the source', /NOAA Sea Level Rise Viewer/i.test(text))

// The figure in the card must match the projection the tiles were requested at,
// or the legend is describing a different map.
const feet = text.match(/about (\d+) ft/)?.[1]
const tiles = await page.evaluate(() => [...new Set(performance.getEntriesByType('resource')
  .map(e => e.name.match(/slr_(\d+)ft/)?.[1]).filter(Boolean))])
report.ok(`the stated depth matches the tiles drawn (card ${feet}ft, tiles ${tiles.join(',')})`,
  tiles.length === 1 && tiles[0] === feet)

// The card disappears with the layer — it describes something on screen.
await page.locator('.layer-card').filter({ hasText: 'Sea Level Rise' }).first().click()
await page.waitForTimeout(2000)
report.ok('it goes away when the layer is switched off',
  await page.locator('.feature-card').filter({ hasText: 'Sea Level Rise' }).count() === 0)

await browser.close()
process.exit(report.finish() ? 0 : 1)
