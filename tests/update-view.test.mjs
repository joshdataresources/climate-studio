import { launchBrowser, createReporter, BASE_URL, BACKEND_URL } from './lib/browser.mjs'

const BASE = BASE_URL
const VIEWS_KEY = 'climate-saved-views'
const LAYERS_KEY = 'climate-active-layers'

let pass = 0, fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`) }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ' :: ' + extra : ''}`) }
}

// A view in the shape older builds wrote: position only, no layers, no controls.
const LEGACY = {
  id: 'legacy-1',
  name: 'Legacy Vegas',
  viewport: { center: { lat: 36.17, lng: -115.14 }, zoom: 9 },
}

const seed = (views, layers) => `
  try {
    localStorage.setItem(${JSON.stringify(VIEWS_KEY)}, ${JSON.stringify(JSON.stringify(views))});
    localStorage.setItem(${JSON.stringify(LAYERS_KEY)}, ${JSON.stringify(JSON.stringify(layers))});
  } catch (e) {}
`

const readViews = page => page.evaluate(k => JSON.parse(localStorage.getItem(k) || '[]'), VIEWS_KEY)
const readLayers = page => page.evaluate(k => JSON.parse(localStorage.getItem(k) || '[]'), LAYERS_KEY)

const row = page => page.locator('li').filter({ has: page.locator('h4', { hasText: 'Legacy Vegas' }) }).first()
const dot = page => row(page).locator('span[title*="no longer matches"]')

const browser = await launchBrowser()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const pageErrors = []
page.on('pageerror', e => pageErrors.push(String(e)))

try {
  // ---- A: a legacy view is flagged as out of date and can be updated ----
  console.log('\nA. legacy view -> update to current view')
  await page.addInitScript(seed([LEGACY], ['topographic_relief']))
  await page.goto(
    `${BASE}/?lat=36.17&lng=-115.14&z=9&layers=sea_level_rise,precipitation_drought&year=2065&scenario=rcp85`,
    { waitUntil: 'domcontentloaded' }
  )
  await page.locator('h4', { hasText: 'Legacy Vegas' }).first().waitFor({ timeout: 30000 })
  await page.waitForTimeout(1500) // let the shared-view effect land

  ok('legacy view shows the unsaved-changes dot', await dot(page).count() === 1)

  await row(page).locator('button[aria-haspopup="menu"]').click()
  const item = page.getByRole('menuitem').filter({ hasText: /Update to current view|Up to date/ }).first()
  await item.waitFor({ timeout: 5000 })
  const label = (await item.textContent())?.trim()
  ok('menu offers "Update to current view"', label === 'Update to current view', `got "${label}"`)
  ok('menu item is enabled', await item.getAttribute('data-disabled') === null)

  await item.click()
  await page.waitForTimeout(800)

  const afterUpdate = (await readViews(page)).find(v => v.id === LEGACY.id)
  ok('view still exists with its id and name',
    !!afterUpdate && afterUpdate.name === 'Legacy Vegas')
  ok('update captured the live layers',
    JSON.stringify((afterUpdate?.activeLayerIds ?? []).slice().sort()) ===
    JSON.stringify(['precipitation_drought', 'sea_level_rise']),
    JSON.stringify(afterUpdate?.activeLayerIds))
  ok('update captured the forecast year',
    afterUpdate?.controls?.projectionYear === 2065, String(afterUpdate?.controls?.projectionYear))
  ok('update captured the scenario',
    afterUpdate?.controls?.scenario === 'rcp85', String(afterUpdate?.controls?.scenario))
  ok('dot clears once the view matches the map', await dot(page).count() === 0)

  const upgraded = afterUpdate

  // ---- B: the upgraded view now restores layers and forecast date ----
  console.log('\nB. upgraded view -> restore')
  const page2 = await ctx.newPage()
  page2.on('pageerror', e => pageErrors.push(String(e)))
  await page2.addInitScript(seed([upgraded], ['topographic_relief']))
  await page2.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page2.locator('h4', { hasText: 'Legacy Vegas' }).first().waitFor({ timeout: 30000 })
  await page2.waitForTimeout(1500)

  ok('view reads as out of date against different live state', await dot(page2).count() === 1)

  await row(page2).locator('button').first().click() // the row body loads the view
  await page2.waitForTimeout(1500)

  const restored = await readLayers(page2)
  ok('clicking the view restores its layers',
    JSON.stringify(restored.slice().sort()) === JSON.stringify(['precipitation_drought', 'sea_level_rise']),
    JSON.stringify(restored))
  // The dot compares live projectionYear/scenario against the view's, so it going
  // away is the observable proof the forecast date restored too.
  ok('dot clears, so live layers + forecast date match the view',
    await dot(page2).count() === 0)

  ok('no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '))
} finally {
  await browser.close()
}

console.log(`\n${pass}/${pass + fail} passed`)
process.exit(fail === 0 ? 0 : 1)
