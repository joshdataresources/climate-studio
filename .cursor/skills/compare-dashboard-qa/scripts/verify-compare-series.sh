#!/usr/bin/env bash
# Verify multi-city chart builders return one series per location.
# Run from repo root: .cursor/skills/compare-dashboard-qa/scripts/verify-compare-series.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../../" && pwd)"
cd "$ROOT"
npx --yes tsx -e "
import { metrosToChartInputs, buildMultiCityTemperatureTrajectory, buildMultiCitySummerSeries, buildMultiCityWinterSeries, buildMultiCityDaysOver100Series, buildMultiCityWetBulbSeries } from './apps/climate-studio/src/utils/metroChartData.ts';
import { loadMetroBundle, getDefaultDashboardMetros } from './apps/climate-studio/src/utils/metroResolver.ts';
import { buildMultiCityAquiferStorageSeries } from './apps/climate-studio/src/utils/metroAquiferData.ts';

const defaults = getDefaultDashboardMetros();
const extra = [
  { metroKey: 'Austin', metroName: 'Austin', lat: 30.27, lon: -97.74 },
  { metroKey: 'Buffalo', metroName: 'Buffalo', lat: 42.89, lon: -78.88 },
  { metroKey: 'Charlotte', metroName: 'Charlotte', lat: 35.23, lon: -80.84 },
  { metroKey: 'Chicago', metroName: 'Chicago', lat: 41.88, lon: -87.63 },
];
const locations = [...defaults.map(m => ({ metroKey: m.key, metroName: m.name, lat: m.lat, lon: m.lon })), ...extra];
const expected = locations.length;
const chartMetros = metrosToChartInputs(locations, loadMetroBundle);
const scenario = 'ssp245';
const tests = [
  ['annual', () => buildMultiCityTemperatureTrajectory(chartMetros, scenario)],
  ['summer', () => buildMultiCitySummerSeries(chartMetros, scenario)],
  ['winter', () => buildMultiCityWinterSeries(chartMetros, scenario)],
  ['days100', () => buildMultiCityDaysOver100Series(chartMetros, scenario)],
  ['wetBulb', () => buildMultiCityWetBulbSeries(chartMetros)],
  ['aquifer', () => buildMultiCityAquiferStorageSeries(locations)],
];
let failed = false;
console.log('Expected series count:', expected, '\\n');
for (const [name, fn] of tests) {
  const { series } = fn();
  const ok = series.length === expected;
  if (!ok) failed = true;
  console.log((ok ? '✓' : '✗') + ' ' + name + ': ' + series.length + ' — ' + series.map(s => s.label).join(', '));
}
process.exit(failed ? 1 : 0);
"
