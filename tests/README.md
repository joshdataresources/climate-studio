# End-to-end tests

These drive the real app in a headless browser. They are not unit tests and there is
no mocking — they start from a blank browser profile, click what a user clicks, and
assert on what the page and its network traffic actually do.

## Running

Both servers must be up (`./scripts/dev.sh`), then:

    node tests/saved-views.test.mjs
    node tests/update-view.test.mjs
    node tests/sea-level-colour.test.mjs

Or all of them:

    npm run test:e2e

Override the targets with `CLIMATE_STUDIO_URL` and `CLIMATE_BACKEND_URL`.

## Requirements

`playwright-core` is resolved from wherever one is installed on the machine — see
`lib/browser.mjs`. It is deliberately not a dependency of this repo: these suites are
a local safety net, not CI, and the repo should not carry a browser download for them.

## What each covers

- **saved-views** — a full round trip through the UI: toggle layers, save a view,
  move away, restore, and again across a reload. This is the regression guard for
  the two layer systems (ClimateContext layers and ClimateStudioView's own toggles)
  staying in sync.
- **update-view** — upgrading a view saved before layers and controls were captured.
- **sea-level-colour** — the tile recolour: shore solid, open water transparent, the
  low-lying class muted, and transparent pixels untouched.
