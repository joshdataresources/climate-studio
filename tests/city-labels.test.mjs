import { launchBrowser, createReporter, BASE_URL } from './lib/browser.mjs'

/**
 * With the Metro Weather cards off, a city dot is an unlabelled blue circle you are
 * expected to click. It needs to say which city it is.
 */
const report = createReporter('City dots are labelled when the cards are off')
const browser = await launchBrowser()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
await page.goto(`${BASE_URL}/?lat=39.5&lng=-98.5&z=5`, { waitUntil: 'domcontentloaded' })
await page.locator('.layer-card').first().waitFor({ timeout: 30000 })
await page.waitForTimeout(4000)

const metroCard = page.locator('.layer-card').filter({ hasText: 'Metro Weather' }).first()
report.ok('Metro Weather starts off', !(await metroCard.getAttribute('class'))?.includes('active'))

const named = await page.evaluate(() => document.body.innerText.includes('New Orleans, LA'))
report.ok('a city name is shown under its dot', named)

// With the cards on, the card already carries the name — no duplicate label.
await metroCard.click()
await page.waitForTimeout(3000)
const labels = await page.evaluate(() =>
  [...document.querySelectorAll('div')].filter(d => d.textContent === 'New Orleans, LA' && !d.children.length).length)
report.ok('no duplicate label once the cards are on', labels === 0, `${labels} labels`)

await browser.close()
process.exit(report.finish() ? 0 : 1)
