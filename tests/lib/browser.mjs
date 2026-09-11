/**
 * Headless browser for the end-to-end suites.
 *
 * playwright-core is not a dependency of this repo — these suites drive the real dev
 * server rather than running in CI, so the browser is resolved from wherever one is
 * already installed on the machine. Add a path here if yours lives somewhere else.
 */
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

const require = createRequire(import.meta.url)

const CANDIDATES = [
  'playwright-core',
  'playwright',
  path.join(homedir(), 'Documents/github-project/crypto-app/node_modules/playwright-core/index.mjs'),
]

export async function launchBrowser(options = { headless: true }) {
  const tried = []
  for (const candidate of CANDIDATES) {
    try {
      const specifier = candidate.startsWith('/')
        ? (existsSync(candidate) ? candidate : null)
        : require.resolve(candidate)
      if (!specifier) { tried.push(candidate); continue }
      const { chromium } = await import(specifier.startsWith('/') ? `file://${specifier}` : specifier)
      return await chromium.launch(options)
    } catch (error) {
      tried.push(`${candidate} (${error.code || error.message})`)
    }
  }
  throw new Error(
    'No playwright-core found. Install it (npm i -D playwright-core) or add a path to ' +
    `tests/lib/browser.mjs. Tried:\n  ${tried.join('\n  ')}`
  )
}

/** Minimal assertion helper — these suites report, they do not throw on first failure. */
export function createReporter(title) {
  let pass = 0, fail = 0
  console.log(`\n${title}`)
  return {
    ok(name, condition, detail = '') {
      if (condition) { pass++; console.log(`  PASS  ${name}`) }
      else { fail++; console.log(`  FAIL  ${name}${detail ? ' :: ' + detail : ''}`) }
    },
    finish() {
      console.log(`\n${pass}/${pass + fail} passed`)
      return fail === 0
    },
  }
}

export const BASE_URL = process.env.CLIMATE_STUDIO_URL || 'http://localhost:8080'
export const BACKEND_URL = process.env.CLIMATE_BACKEND_URL || 'http://localhost:3001'
