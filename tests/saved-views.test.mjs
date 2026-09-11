import { launchBrowser, createReporter, BASE_URL, BACKEND_URL } from './lib/browser.mjs'
const BASE = BASE_URL
let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log(`  PASS  ${n}`)) : (fail++, console.log(`  FAIL  ${n}${x ? ' :: ' + x : ''}`)) }

const cardState = page => page.evaluate(() =>
  Object.fromEntries([...document.querySelectorAll('.layer-card')]
    .map(el => [(el.textContent || '').trim().split('\n')[0].slice(0, 30), el.classList.contains('active')])
    .filter(([n]) => n)))
const clickCard = (page, name) => page.locator('.layer-card').filter({ hasText: name }).first().click()
const views = page => page.evaluate(() => JSON.parse(localStorage.getItem('climate-saved-views') || '[]'))

const browser = await launchBrowser()
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', e => errs.push(String(e)))

try {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.locator('.layer-card').first().waitFor({ timeout: 30000 })
  await page.waitForTimeout(3000)

  const before = await cardState(page)
  console.log('\nDefault layer state:', Object.entries(before).filter(([, v]) => v).map(([k]) => k).join(', '))

  // Turn on two view-owned layers that were off, turn one default off.
  await clickCard(page, 'Sea Level Rise'); await page.waitForTimeout(600)
  await clickCard(page, 'Aquifers');       await page.waitForTimeout(600)
  await clickCard(page, 'Factories');      await page.waitForTimeout(600)

  const wanted = await cardState(page)
  ok('Sea Level Rise toggled on', wanted['Sea Level Rise'] === true)
  ok('Aquifers toggled on', wanted['Aquifers'] === true)
  ok('Factories toggled off', wanted['Factories'] === false)

  // Save a view through the real panel UI.
  await page.getByRole('button', { name: /New View/i }).first().click()
  const nameInput = page.locator('input[placeholder="Enter view name..."]').first()
  await nameInput.fill('Roundtrip')
  await nameInput.press('Enter')
  await page.waitForTimeout(1200)

  const saved = (await views(page)).find(v => v.name === 'Roundtrip')
  ok('view was saved', !!saved)
  ok('save captured the view-owned layers',
    saved?.activeLayerIds?.includes('sea_level_rise') && saved?.activeLayerIds?.includes('aquifers'),
    JSON.stringify(saved?.activeLayerIds))
  ok('save excluded the layer that was switched off',
    !saved?.activeLayerIds?.includes('factories'), JSON.stringify(saved?.activeLayerIds))
  ok('save captured the forecast controls',
    typeof saved?.controls?.projectionYear === 'number' && !!saved?.controls?.scenario,
    JSON.stringify(saved?.controls?.projectionYear))

  // Move away from that layer state, then restore.
  await clickCard(page, 'Sea Level Rise'); await page.waitForTimeout(400)
  await clickCard(page, 'Aquifers');       await page.waitForTimeout(400)
  await clickCard(page, 'Factories');      await page.waitForTimeout(600)
  const moved = await cardState(page)
  ok('layer state actually moved away', moved['Sea Level Rise'] === false && moved['Factories'] === true)

  await page.locator('li').filter({ has: page.locator('h4', { hasText: 'Roundtrip' }) }).first()
    .locator('button').first().click()
  await page.waitForTimeout(1800)

  const restored = await cardState(page)
  ok('restore turns Sea Level Rise back on', restored['Sea Level Rise'] === true)
  ok('restore turns Aquifers back on', restored['Aquifers'] === true)
  ok('restore turns Factories back off', restored['Factories'] === false)

  // Same again after a full reload, from localStorage.
  const page2 = await ctx.newPage()
  page2.on('pageerror', e => errs.push(String(e)))
  await page2.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page2.locator('.layer-card').first().waitFor({ timeout: 30000 })
  await page2.waitForTimeout(3000)
  ok('after reload the layers are back at their defaults',
    (await cardState(page2))['Sea Level Rise'] === false)

  await page2.locator('li').filter({ has: page2.locator('h4', { hasText: 'Roundtrip' }) }).first()
    .locator('button').first().click()
  await page2.waitForTimeout(1800)
  const afterReload = await cardState(page2)
  ok('restore works across a reload', afterReload['Sea Level Rise'] === true && afterReload['Aquifers'] === true)
  ok('no uncaught page errors', errs.length === 0, errs.slice(0, 2).join(' | '))
} finally {
  await browser.close()
}
console.log(`\n${pass}/${pass + fail} passed`)
process.exit(fail === 0 ? 0 : 1)
