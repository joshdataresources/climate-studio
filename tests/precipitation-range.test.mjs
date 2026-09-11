import { launchBrowser, createReporter, BACKEND_URL } from './lib/browser.mjs'

/**
 * The precipitation palette must be stretched to the data in view.
 *
 * It was fixed at 0-10 mm/day while CMIP6 daily precipitation over the US mostly
 * sits between 1 and 5, so nearly every pixel fell in the first third of the ramp
 * and the map read as one pale yellow and one pale blue. Soil moisture must also
 * stay gone: the service computed it as precipitation x 10 and called it a
 * saturation percentage.
 */
const report = createReporter('Precipitation range and metrics')

const AREAS = [
  { name: 'CONUS',     q: 'north=46&south=25&east=-67&west=-125' },
  { name: 'NYC',       q: 'north=41&south=40.5&east=-73.5&west=-74.2' },
  { name: 'Mojave',    q: 'north=37&south=33&east=-115&west=-120' },
  { name: 'Manhattan', q: 'north=40.75&south=40.70&east=-73.95&west=-74.01' },
]

const ranges = []
for (const { name, q } of AREAS) {
  const res = await fetch(`${BACKEND_URL}/api/climate/precipitation-drought/tiles?${q}&year=2065&scenario=rcp85`)
  const body = await res.json()
  const meta = (body.data ?? body).metadata ?? {}
  const range = meta.visRange
  ranges.push({ name, range })

  report.ok(`${name}: palette stretched to the visible data (${range?.join(' - ')})`,
    Array.isArray(range) && range[1] > range[0] && !(range[0] === 0 && range[1] === 10),
    JSON.stringify(range))
  report.ok(`${name}: soil moisture is not reported`, meta.soilMoisture === undefined,
    String(meta.soilMoisture))
}

// Different regions must get different ranges, or it is not really stretching.
const distinct = new Set(ranges.map(r => JSON.stringify(r.range))).size
report.ok(`dry and wet regions get different ranges (${distinct} distinct of ${ranges.length})`,
  distinct > 1)

const browser = await launchBrowser()
await browser.close()
process.exit(report.finish() ? 0 : 1)
