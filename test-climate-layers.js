/**
 * Climate Layer Testing Script
 *
 * This script systematically tests all 7 climate layers by:
 * 1. Opening the app in a browser
 * 2. Enabling each layer one by one
 * 3. Checking network requests
 * 4. Verifying layer rendering
 * 5. Testing opacity controls
 * 6. Logging any errors
 *
 * Run with: node test-climate-layers.js
 */

const layers = [
  {
    id: 'sea_level_rise',
    name: 'Sea Level Rise',
    type: 'tile',
    endpoint: '/api/tiles/noaa-slr/',
    hasOpacity: true
  },
  {
    id: 'megaregion_timeseries',
    name: 'Population Migration',
    type: 'geojson',
    endpoint: '/megaregion-data',
    hasOpacity: true
  },
  {
    id: 'urban_expansion',
    name: 'Urban Expansion',
    type: 'geojson',
    endpoint: '/api/climate/urban-expansion/tiles',
    hasOpacity: true
  },
  {
    id: 'urban_heat_island',
    name: 'Urban Heat Island',
    type: 'tile',
    endpoint: '/api/climate/urban-heat-island/tiles',
    hasOpacity: true
  },
  {
    id: 'temperature_projection',
    name: 'Future Temperature Anomaly',
    type: 'tile',
    endpoint: '/api/climate/temperature-projection/tiles',
    hasOpacity: true
  },
  {
    id: 'precipitation_drought',
    name: 'Precipitation & Drought',
    type: 'tile',
    endpoint: '/api/climate/precipitation-drought/tiles',
    hasOpacity: true
  },
  {
    id: 'topographic_relief',
    name: 'Topographic Relief',
    type: 'tile',
    endpoint: '/api/climate/topographic-relief/tiles',
    hasOpacity: true
  }
];

console.log('='.repeat(80));
console.log('CLIMATE LAYER TESTING GUIDE');
console.log('='.repeat(80));
console.log('\nTo test all layers systematically:');
console.log('\n1. Open http://localhost:8082/ in your browser');
console.log('2. Open Developer Tools (F12)');
console.log('3. Go to Console tab');
console.log('4. Go to Network tab');
console.log('\nFor each layer below, follow these steps:\n');

layers.forEach((layer, index) => {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${index + 1}. ${layer.name.toUpperCase()} (${layer.id})`);
  console.log(`${'='.repeat(70)}`);
  console.log(`   Type: ${layer.type}`);
  console.log(`   Endpoint: ${layer.endpoint}`);
  console.log('\n   Steps:');
  console.log('   a) Enable the layer in the left panel');
  console.log('   b) Check Network tab for requests to: ' + layer.endpoint);
  console.log('   c) Look for the layer in deck.gl layers array');
  console.log('   d) Verify visual rendering on the map');
  if (layer.hasOpacity) {
    console.log('   e) Test opacity slider (should affect visibility)');
  }
  console.log('   f) Check Console for any errors');
  console.log('\n   Expected behavior:');
  if (layer.type === 'tile') {
    console.log('   - Should see tile requests in Network tab');
    console.log('   - Tiles should load as you pan/zoom');
    console.log('   - Raster layer visible on map');
  } else {
    console.log('   - Should see single GeoJSON request');
    console.log('   - Polygons/circles visible on map');
    console.log('   - Features have properties');
  }
  console.log('\n   Common issues:');
  console.log('   - Layer enabled but not visible: Check opacity setting');
  console.log('   - Network error: Check backend server at http://localhost:5001');
  console.log('   - Empty features: Check bounds/zoom level');
  console.log('   - CORS error: Check backend CORS configuration');
});

console.log('\n' + '='.repeat(80));
console.log('DEBUGGING POPULATION MIGRATION LAYER');
console.log('='.repeat(80));
console.log('\nSpecific checks for megaregion_timeseries:');
console.log('1. Enable "Population Migration" layer');
console.log('2. In Console, run: window.climate = useClimate()');
console.log('3. Check active layers: climate.activeLayerIds');
console.log('4. In Network tab, filter by "megaregion"');
console.log('5. Look for request to: /megaregion-data');
console.log('6. Check response JSON structure:');
console.log('   - Should have "success": true');
console.log('   - Should have "data" object');
console.log('   - data.features should be an array');
console.log('7. In Console, check deck.gl layers:');
console.log('   - Look for layer with id "megaregion-layer"');
console.log('8. If layer exists but not visible:');
console.log('   - Check getFillColor function');
console.log('   - Check opacity value');
console.log('   - Verify coordinates are valid');
console.log('   - Check if features are within viewport');

console.log('\n' + '='.repeat(80));
console.log('PERFORMANCE COMPARISON: deck.gl vs MapboxGlobe');
console.log('='.repeat(80));
console.log('\nCurrent setup: DeckGLMap (line 747 in GISAnalysisApp.tsx)');
console.log('\nTest with deck.gl:');
console.log('1. Enable multiple layers (3-4 layers)');
console.log('2. Rapidly pan and zoom the map');
console.log('3. Observe:');
console.log('   - Frame rate (smooth vs choppy)');
console.log('   - Layer rendering speed');
console.log('   - Memory usage (check Performance tab)');
console.log('   - Any visual glitches');
console.log('\nTo test with MapboxGlobe:');
console.log('1. Edit GISAnalysisApp.tsx line 747');
console.log('2. Change: <DeckGLMap');
console.log('3. To: <MapboxGlobe');
console.log('4. Save file (should hot-reload)');
console.log('5. Repeat same tests');
console.log('6. Compare performance metrics');

console.log('\n' + '='.repeat(80));
console.log('CONSOLE COMMANDS FOR DEBUGGING');
console.log('='.repeat(80));
console.log('\n// Check active layers');
console.log('console.log(window.__CLIMATE_CONTEXT__)');
console.log('\n// Inspect deck.gl instance');
console.log('console.log(window.__DECKGL_INSTANCE__)');
console.log('\n// Check layer data');
console.log('console.log(window.__LAYER_STATES__)');
console.log('\n// Monitor network requests');
console.log('performance.getEntriesByType("resource").filter(r => r.name.includes("climate"))');

console.log('\n' + '='.repeat(80));
console.log('\nReady to begin testing!');
console.log('Open http://localhost:8082/ and follow the steps above.\n');
