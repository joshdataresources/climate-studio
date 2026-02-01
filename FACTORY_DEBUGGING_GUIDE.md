# 🔍 Factory Layer Debugging Guide

## Issue Fixed
**Problem**: Mapbox doesn't support nested property access like `environmental.severity`
**Solution**: Flattened the `severity` property to the top level of each feature

## How to Check if Factory Layer is Working

### 1. Open Browser Console (F12)

You should see these console messages when the map loads:

```
✅ All river layers set up successfully (MIDDLE - on top of aquifers)
🏭 Setting up factory layer with 10 factories
🏭 First factory: TSMC North Phoenix severity: critical
✅ Factory source added to map
🎨 Adding factory-points layer...
✅ Factory-points layer added
🎨 Adding factory-labels layer...
✅ Factory-labels layer added
🖱️ Setting up factory click handlers...
✅ Factory layer setup complete! Layers: factory-points, factory-labels
🎯 Factories should now be visible on the map in Texas and Phoenix areas
✅ Factory layer loaded successfully
```

### 2. If You Don't See These Messages

**Check for errors**:
- Look for red errors in console
- Look for `❌ Error loading factory layer:` message
- Check if `setupFactoryLayer` was called

**Common Issues**:
- Import errors (TypeScript can't find files)
- JSON parsing errors (malformed factories.json)
- Mapbox style not loaded yet

### 3. Verify Map Layers Are Added

In the browser console, run:
```javascript
// Get the map instance
const map = window.__map__ // You may need to expose this

// Check if factory source exists
console.log('Factory source:', map.getSource('factories'))

// Check if factory layers exist
console.log('Factory points layer:', map.getLayer('factory-points'))
console.log('Factory labels layer:', map.getLayer('factory-labels'))

// Get factory data
const source = map.getSource('factories')
if (source) {
  console.log('Factory data:', source._data)
}
```

### 4. Where to Look for Factories

**Phoenix Area** (zoom level 8-10):
- Center: 33.4484°N, 112.0740°W
- Factories:
  - TSMC North Phoenix (33.645, -112.074) - RED
  - Nestlé Glendale (33.31, -112.30) - ORANGE
  - LG Queen Creek (33.24, -111.75) - ORANGE
  - Amkor Peoria (33.31, -111.84) - ORANGE
  - P&G Coolidge (32.88, -111.65) - ORANGE

**Texas - Sherman/Taylor** (zoom level 7-9):
- Texas Instruments Sherman (33.63, -97.13) - RED
- Samsung Taylor (30.62, -97.42) - RED

**Texas - Houston** (zoom level 9-11):
- Inventec Houston (29.76, -95.36) - RED
- Lily Harris County (29.76, -95.51) - RED

**Texas - Dallas** (zoom level 9-11):
- T1 Energy Wilmer (32.95, -96.51) - BLUE

### 5. Check Circle Colors

Factories should have these colors:
- 🔴 **Red (#ef4444)**: Critical - TSMC, TI, Samsung, Houston facilities
- 🟠 **Orange (#f97316)**: Stressed - Nestlé, LG, Amkor, P&G
- 🔵 **Blue (#3b82f6)**: Moderate - T1 Energy
- ⚫ **Gray (#6b7280)**: Default (fallback)

### 6. Test Interactions

**Hover**:
- Move mouse over a factory marker
- Cursor should change to pointer
- Circle should get a subtle highlight

**Click**:
- Click on a factory marker
- Console should show: "Clicked factory: [name]"
- Panel should appear at bottom-right
- Circle should get white border (3px)

**Close**:
- Click X button on panel
- Panel should disappear
- Circle selection should clear

### 7. Mapbox GL Inspect

If factories still don't appear, use Mapbox GL Inspect:

```javascript
// In browser console
map.on('click', (e) => {
  const features = map.queryRenderedFeatures(e.point)
  console.log('All features at click point:', features)

  const factoryFeatures = features.filter(f => f.source === 'factories')
  console.log('Factory features:', factoryFeatures)
})
```

### 8. Force Layer Visibility

If layers exist but aren't visible:

```javascript
// In browser console
map.setLayoutProperty('factory-points', 'visibility', 'visible')
map.setLayoutProperty('factory-labels', 'visibility', 'visible')
```

### 9. Check Z-Order (Layer Stacking)

Factories should be above aquifers but below labels:

```javascript
// In browser console
const style = map.getStyle()
console.log('Layer order:', style.layers.map(l => l.id))

// Look for this order:
// ... aquifer-fill, aquifer-outline, aquifer-hover ...
// ... river-lines ...
// ... factory-points, factory-labels ...
// ... waterway-label, place-labels ...
```

### 10. Common Solutions

**Issue**: Factories not visible
**Try**:
1. Zoom to correct area (Phoenix or Texas)
2. Check zoom level (factories visible at zoom 5+)
3. Refresh page (Ctrl+Shift+R / Cmd+Shift+R)
4. Check if other layers (aquifers, rivers) are visible
5. Clear browser cache

**Issue**: Click doesn't work
**Try**:
1. Check if click handler was added (console log should show)
2. Verify `setSelectedFactory` function exists
3. Check z-index of panel (should be 1000)
4. Verify no other layer is blocking clicks

**Issue**: Colors are all gray
**Try**:
1. Check if severity was flattened correctly (console log first factory)
2. Verify JSON has `environmental.severity` values
3. Check Mapbox expression syntax

## Quick Test Commands

Run these in browser console after map loads:

```javascript
// 1. Check if factory layer is loaded
console.log('Has factory source:', !!map.getSource('factories'))
console.log('Has factory layer:', !!map.getLayer('factory-points'))

// 2. Count factories
const source = map.getSource('factories')
console.log('Number of factories:', source?._data?.features?.length)

// 3. Fly to Phoenix to see factories
map.flyTo({center: [-112.074, 33.645], zoom: 9})

// 4. Fly to Texas to see factories
map.flyTo({center: [-97.13, 33.63], zoom: 8})

// 5. Log all factory names and coordinates
const factories = source?._data?.features
factories?.forEach(f => {
  console.log(`${f.properties.name}: [${f.geometry.coordinates}] - ${f.properties.severity}`)
})
```

## Files Changed (for rollback if needed)

1. **`apps/climate-studio/src/utils/factoryLayerSetup.ts`**
   - Added data flattening for `severity` property
   - Changed `['get', 'environmental.severity']` to `['get', 'severity']`
   - Added console logging for debugging

2. **No other files changed** - WaterAccessView.tsx integration is unchanged

## Still Not Working?

If factories still don't appear after checking all above:

1. **Check imports**:
   ```bash
   grep "import.*factories" apps/climate-studio/src/components/WaterAccessView.tsx
   ```

2. **Verify JSON is valid**:
   ```bash
   cat apps/climate-studio/src/data/factories.json | jq .
   ```

3. **Check TypeScript compilation**:
   - Look for TypeScript errors in terminal
   - Check VSCode problems panel

4. **Restart dev server**:
   ```bash
   # Kill existing server
   pkill -f "vite"

   # Start fresh
   npm run dev:studio
   ```

5. **Hard refresh browser**:
   - Chrome/Edge: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Firefox: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)

---

**Expected Result**: After implementing the fixes, you should see colored circles on the map in Phoenix and Texas regions. The circles should respond to hover and click interactions.
