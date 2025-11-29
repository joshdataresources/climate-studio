// Browser Console Script - Paste this into DevTools Console at http://localhost:8082/
// This script inspects the current state of all climate layers

console.clear();
console.log('%c=== DECKGL LAYER INSPECTOR ===', 'font-size: 20px; color: #00ff00; font-weight: bold; background: #000; padding: 10px;');

// Check if we're on the right page
if (!window.location.href.includes('localhost:8082')) {
  console.error('⚠️ This script should be run on http://localhost:8082/');
  console.log('Current URL:', window.location.href);
}

// Function to inspect React Fiber to find climate context
function findClimateContext() {
  try {
    const root = document.getElementById('root');
    if (!root) {
      console.error('❌ Cannot find #root element');
      return null;
    }
    
    // Try to access React Fiber
    const fiberKey = Object.keys(root).find(key => key.startsWith('__react'));
    if (!fiberKey) {
      console.error('❌ Cannot find React Fiber');
      return null;
    }
    
    console.log('✅ Found React Fiber');
    return root[fiberKey];
  } catch (e) {
    console.error('❌ Error accessing React:', e.message);
    return null;
  }
}

// Check DeckGL layers in DOM
function inspectDeckGLLayers() {
  console.log('\n%c📊 Inspecting DeckGL Layer Rendering', 'font-size: 16px; color: #ffff00; font-weight: bold;');
  
  // Find canvas elements
  const canvases = document.querySelectorAll('canvas');
  console.log(`Found ${canvases.length} canvas elements`);
  
  canvases.forEach((canvas, i) => {
    console.log(`\nCanvas ${i + 1}:`, {
      width: canvas.width,
      height: canvas.height,
      id: canvas.id,
      class: canvas.className
    });
  });
  
  // Check for Mapbox
  const mapboxContainer = document.querySelector('.mapboxgl-map');
  if (mapboxContainer) {
    console.log('✅ Mapbox container found');
  } else {
    console.warn('⚠️ No Mapbox container found');
  }
}

// Check layer panel UI
function inspectLayerPanel() {
  console.log('\n%c🎛️ Inspecting Layer Panel UI', 'font-size: 16px; color: #ffff00; font-weight: bold;');
  
  // Look for layer toggles
  const buttons = document.querySelectorAll('button');
  console.log(`Found ${buttons.length} buttons in total`);
  
  // Look for sliders
  const sliders = document.querySelectorAll('input[type="range"]');
  console.log(`Found ${sliders.length} sliders (opacity controls)`);
  
  sliders.forEach((slider, i) => {
    console.log(`Slider ${i + 1}:`, {
      value: slider.value,
      min: slider.min,
      max: slider.max,
      step: slider.step
    });
  });
}

// Check network requests
function inspectNetworkRequests() {
  console.log('\n%c🌐 Network Request Instructions', 'font-size: 16px; color: #ffff00; font-weight: bold;');
  console.log('To inspect network requests:');
  console.log('1. Open DevTools Network tab');
  console.log('2. Filter by "Img" to see tile requests');
  console.log('3. Filter by "XHR" to see API requests');
  console.log('\nExpected tile request patterns:');
  console.log('- Sea Level: /api/tiles/noaa-slr/{feet}/{z}/{x}/{y}.png');
  console.log('- Other tiles: Earth Engine URLs');
  console.log('- GeoJSON: /api/climate/*/tiles');
}

// Check for console errors
function inspectConsoleErrors() {
  console.log('\n%c⚠️ Console Error Check', 'font-size: 16px; color: #ffff00; font-weight: bold;');
  console.log('Watch this console for any red error messages as you:');
  console.log('1. Toggle layers on/off');
  console.log('2. Adjust opacity sliders');
  console.log('3. Change layer settings');
  console.log('\nCommon errors to look for:');
  console.log('- "Failed to fetch"');
  console.log('- "TypeError: Cannot read property"');
  console.log('- "Layer xxx: accessor props not supported"');
}

// Layer testing instructions
function printTestInstructions() {
  console.log('\n%c📋 MANUAL TEST INSTRUCTIONS', 'font-size: 18px; color: #00ff00; font-weight: bold; background: #000; padding: 10px;');
  
  const layers = [
    { name: 'Sea Level Rise', control: 'seaLevelOpacity', default: 0.3 },
    { name: 'Topographic Relief', control: 'reliefOpacity', default: 0.3 },
    { name: 'Temperature Projection', control: 'projectionOpacity', default: 0.3 },
    { name: 'Precipitation & Drought', control: 'droughtOpacity', default: 0.3 },
    { name: 'Urban Heat Island', control: 'urbanHeatOpacity', default: 0.3 },
    { name: 'Urban Expansion', control: 'urbanExpansionOpacity', default: 0.3, bug: 'DOUBLE OPACITY' },
    { name: 'Population Migration', control: 'megaregionOpacity', default: 0.7, bug: 'DOUBLE OPACITY' }
  ];
  
  layers.forEach((layer, i) => {
    console.log(`\n${i + 1}. ${layer.name}`);
    console.log(`   Control: ${layer.control}`);
    console.log(`   Default: ${layer.default * 100}%`);
    if (layer.bug) {
      console.log(`   ⚠️ KNOWN BUG: ${layer.bug}`);
    }
    console.log('   Test:');
    console.log('   [ ] Toggle ON in layer panel');
    console.log('   [ ] Verify layer renders on map');
    console.log('   [ ] Move opacity slider');
    console.log('   [ ] Verify visual opacity changes');
  });
}

// Expected vs Actual opacity values
function printOpacityDebugInfo() {
  console.log('\n%c🔍 OPACITY BUG DETECTION GUIDE', 'font-size: 18px; color: #ff0000; font-weight: bold; background: #000; padding: 10px;');
  
  console.log('\n🔴 CRITICAL BUG: Urban Expansion (Urban Growth)');
  console.log('Expected opacity: 30%');
  console.log('Actual opacity: ~9% (due to double opacity)');
  console.log('Bug: Layer opacity (30%) × Fill alpha (30%) = 9%');
  console.log('Symptoms:');
  console.log('  - Orange circles nearly invisible');
  console.log('  - Opacity slider seems to do nothing');
  console.log('  - Even at 100%, layer is very faint');
  
  console.log('\n🟡 MEDIUM BUG: Population Migration');
  console.log('Expected opacity: 70%');
  console.log('Actual opacity: ~30% (due to double opacity)');
  console.log('Bug: Layer opacity (70%) × Color alpha (50%) = 35%');
  console.log('Symptoms:');
  console.log('  - Circles dimmer than expected');
  console.log('  - Should be quite prominent but looks faded');
  console.log('  - Opacity slider works but effect is muted');
  
  console.log('\n🟡 MINOR BUG: All Tile Layers');
  console.log('Expected default: 30%');
  console.log('Fallback default: 10%');
  console.log('Bug: Fallback value doesn\'t match context default');
  console.log('Symptoms:');
  console.log('  - Layers may appear dim on first load');
  console.log('  - Brightness increases after moving slider');
}

// Run all inspections
function runFullInspection() {
  findClimateContext();
  inspectDeckGLLayers();
  inspectLayerPanel();
  inspectNetworkRequests();
  inspectConsoleErrors();
  printTestInstructions();
  printOpacityDebugInfo();
  
  console.log('\n%c✅ INSPECTION COMPLETE', 'font-size: 18px; color: #00ff00; font-weight: bold; background: #000; padding: 10px;');
  console.log('Now manually test each layer using the instructions above.');
}

// Export helper functions to window for interactive use
window.climateInspector = {
  run: runFullInspection,
  layers: inspectDeckGLLayers,
  panel: inspectLayerPanel,
  network: inspectNetworkRequests,
  errors: inspectConsoleErrors,
  test: printTestInstructions,
  bugs: printOpacityDebugInfo
};

console.log('\n%c💡 TIP: Use window.climateInspector for interactive debugging', 'font-size: 14px; color: #00ffff;');
console.log('Available commands:');
console.log('  climateInspector.run()     - Run full inspection');
console.log('  climateInspector.layers()  - Inspect DeckGL rendering');
console.log('  climateInspector.panel()   - Inspect UI controls');
console.log('  climateInspector.bugs()    - Show known bugs');

// Auto-run on load
runFullInspection();
