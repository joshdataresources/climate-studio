# DeckGL Layer Debug Analysis

## Date: 2025-11-24
## File: /Users/joshuabutler/Documents/github-project/climate-studio/apps/climate-studio/src/components/DeckGLMap.tsx

---

## CONTROL NAME MAPPING ANALYSIS

### Expected Opacity Controls (from ClimateContext.tsx):
```typescript
seaLevelOpacity: 0.3       // Line 114
reliefOpacity: 0.3         // Line 120
projectionOpacity: 0.3     // Line 113
droughtOpacity: 0.3        // Line 122
urbanHeatOpacity: 0.3      // Line 115
urbanExpansionOpacity: 0.3 // Line 118
megaregionOpacity: 0.7     // Line 124
```

### Opacity Controls in DeckGLMap.tsx:

| Layer | Line | Control Name | Status | Default Fallback |
|-------|------|--------------|--------|------------------|
| Sea Level Rise | 366 | `controls.seaLevelOpacity` | ✅ CORRECT | 0.1 |
| Topographic Relief | 203 | `controls.reliefOpacity` | ✅ CORRECT | 0.1 |
| Temperature Projection | 116 | `controls.projectionOpacity` | ✅ CORRECT | 0.1 |
| Precipitation/Drought | 145 | `controls.droughtOpacity` | ✅ CORRECT | 0.1 |
| Urban Heat Island | 174 | `controls.urbanHeatOpacity` | ✅ CORRECT | 0.1 |
| Urban Expansion | 235 | `controls.urbanExpansionOpacity` | ✅ CORRECT | 0.3 |
| Megaregion | 339 | `controls.megaregionOpacity` | ✅ CORRECT | 0.6 |

**FINDING #1: All control names are mapped correctly!**

---

## FALLBACK OPACITY VALUES ISSUE

### Problem: Default fallback opacity too low

All tile layers use `?? 0.1` (10%) as fallback, but ClimateContext defaults to 0.3 (30%).

**This creates a mismatch where:**
- Context says opacity should be 30%
- But if controls.XOpacity is undefined, layer falls back to 10%
- Layers may appear "stuck" at low opacity until slider is moved

### Affected Lines:
- Line 116: `opacity: controls.projectionOpacity ?? 0.1`
- Line 145: `opacity: controls.droughtOpacity ?? 0.1`
- Line 174: `opacity: controls.urbanHeatOpacity ?? 0.1`
- Line 203: `opacity: controls.reliefOpacity ?? 0.1`
- Line 366: `opacity: controls.seaLevelOpacity ?? 0.1`

**FINDING #2: Fallback values don't match context defaults!**

---

## USEMEMO DEPENDENCIES ANALYSIS

### Temperature Projection (Lines 105-131):
```typescript
useMemo([
  isLayerActive("temperature_projection"),
  layerStates.temperature_projection,
  controls.projectionOpacity  // ✅ INCLUDED
])
```
**Status:** ✅ CORRECT - opacity in dependencies

### Precipitation/Drought (Lines 134-160):
```typescript
useMemo([
  isLayerActive("precipitation_drought"),
  layerStates.precipitation_drought,
  controls.droughtOpacity  // ✅ INCLUDED
])
```
**Status:** ✅ CORRECT - opacity in dependencies

### Urban Heat Island (Lines 163-189):
```typescript
useMemo([
  isLayerActive("urban_heat_island"),
  layerStates.urban_heat_island,
  controls.urbanHeatOpacity  // ✅ INCLUDED
])
```
**Status:** ✅ CORRECT - opacity in dependencies

### Topographic Relief (Lines 192-218):
```typescript
useMemo([
  isLayerActive("topographic_relief"),
  layerStates.topographic_relief,
  controls.reliefOpacity  // ✅ INCLUDED
])
```
**Status:** ✅ CORRECT - opacity in dependencies

### Urban Expansion (Lines 221-241):
```typescript
useMemo([
  isLayerActive("urban_expansion"),
  layerStates.urban_expansion,
  controls.urbanExpansionOpacity  // ✅ INCLUDED
])
```
**Status:** ✅ CORRECT - opacity in dependencies

### Megaregion (Lines 244-345):
```typescript
useMemo([
  isLayerActive("megaregion_timeseries"),
  controls.projectionYear,
  controls.megaregionOpacity  // ✅ INCLUDED
])
```
**Status:** ✅ CORRECT - opacity in dependencies

### Sea Level Rise (Lines 348-381):
```typescript
useMemo([
  isLayerActive("sea_level_rise"),
  controls.projectionYear,
  controls.seaLevelOpacity  // ✅ INCLUDED
])
```
**Status:** ✅ CORRECT - opacity in dependencies

**FINDING #3: All useMemo dependencies include opacity controls correctly!**

---

## LAYER RENDERING ORDER (Line 383-392)

```typescript
const layers = [
  seaLevelTileLayer,           // 1. Bottom - renders first
  topographicReliefTileLayer,  // 2.
  temperatureProjectionTileLayer, // 3.
  precipitationDroughtTileLayer,  // 4.
  urbanHeatTileLayer,             // 5.
  urbanExpansionLayer,            // 6.
  megaregionLayer,                // 7.
  temperatureHeatmapLayer,        // 8. Top - renders last
].filter(Boolean)
```

**Status:** ✅ CORRECT order
- Base layers (sea level, relief) at bottom
- Data layers (temperature, drought, heat) in middle
- Vector layers (urban expansion, megaregion) on top

---

## OPACITY IMPLEMENTATION DIFFERENCES

### TileLayer Opacity (Lines 116, 145, 174, 203, 366):
```typescript
opacity: controls.projectionOpacity ?? 0.1
```
- Applied directly to TileLayer
- Controls overall layer transparency
- ✅ Standard deck.gl TileLayer API

### GeoJsonLayer Opacity (Lines 235, 339):
```typescript
opacity: controls.urbanExpansionOpacity ?? 0.3
```
- Applied to GeoJsonLayer
- Also has getFillColor with alpha channel: `[255, 140, 0, 76]`
- ⚠️ **POTENTIAL ISSUE:** Dual opacity control
  - Layer-level opacity property
  - Fill color alpha channel (76 = ~30% of 255)
  - These multiply together: 0.3 * (76/255) = ~9% effective opacity

**FINDING #4: GeoJSON layers may have unexpected opacity due to dual controls!**

---

## DATA LOADING CHECKS

### Tile Layers (require tile_url):
- Temperature Projection: `data.tile_url` (Line 108)
- Precipitation/Drought: `data.tile_url` (Line 137)
- Urban Heat Island: `data.tile_url` (Line 166)
- Topographic Relief: `data.tile_url` (Line 195)

**All check for:** `if (!data || !data.tile_url) return null`
**Status:** ✅ CORRECT

### Sea Level Rise (special handling):
- Constructs URL directly: `${backendUrl}/api/tiles/noaa-slr/${feet}/{z}/{x}/{y}.png` (Line 362)
- No data check needed - URL is constructed on the fly
**Status:** ✅ CORRECT

### GeoJSON Layers (require features):
- Urban Expansion: `data.features` (Line 224)
- Megaregion: Local JSON import, no fetch needed (Line 300)

**Status:** ✅ CORRECT

---

## POTENTIAL ISSUES IDENTIFIED

### Issue #1: Fallback Opacity Mismatch 🔴 HIGH
**Severity:** HIGH
**Impact:** Layers may appear dimmer than expected on first render

**Problem:**
- ClimateContext defaults all opacity to 0.3 (30%)
- DeckGLMap fallbacks use 0.1 (10%) for tile layers
- If controls.opacity is somehow undefined, layer uses 10% instead of 30%

**Affected Layers:**
- Sea Level Rise
- Topographic Relief
- Temperature Projection
- Precipitation/Drought
- Urban Heat Island

**Fix:**
Change fallback values to match ClimateContext defaults:
```typescript
// From:
opacity: controls.projectionOpacity ?? 0.1

// To:
opacity: controls.projectionOpacity ?? 0.3
```

### Issue #2: GeoJSON Double Opacity 🟡 MEDIUM
**Severity:** MEDIUM
**Impact:** Urban Expansion layer appears much dimmer than intended

**Problem:**
Urban Expansion layer has two opacity controls:
1. Layer-level: `opacity: controls.urbanExpansionOpacity ?? 0.3`
2. Fill color alpha: `getFillColor: [255, 140, 0, 76]` (76/255 ≈ 30%)
3. Effective opacity: 0.3 × 0.3 = 0.09 (9%)

**Fix Option 1 (Recommended):**
Remove alpha from fill color, use only layer opacity:
```typescript
getFillColor: [255, 140, 0, 255]  // Full alpha
opacity: controls.urbanExpansionOpacity ?? 0.3
```

**Fix Option 2:**
Remove layer opacity, use only fill color alpha:
```typescript
getFillColor: [255, 140, 0, Math.round(255 * (controls.urbanExpansionOpacity ?? 0.3))]
// Remove opacity property
```

### Issue #3: Megaregion Layer Alpha Channel 🟡 MEDIUM
**Severity:** MEDIUM
**Impact:** Megaregion opacity slider may not work as expected

**Problem:**
Megaregion layer uses dynamic colors with hardcoded alpha (128 = 50%):
```typescript
const getGrowthColor = (...) => {
  return [220, 38, 38, 128]  // Alpha always 128
}
```

Then applies layer opacity:
```typescript
getFillColor: (d: any) => d.properties.color,  // Already has alpha
opacity: controls.megaregionOpacity ?? 0.6
```

**Effective opacity:** 0.6 × (128/255) = ~30%, not 60%

**Fix:**
Remove alpha from color array, rely only on layer opacity:
```typescript
const getGrowthColor = (...) => {
  return [220, 38, 38, 255]  // Full alpha
}
```

---

## LAYER-BY-LAYER STATUS PREDICTION

### 1. Sea Level Rise ⚠️
**Expected Status:** WORKING but may appear dim
- Control name: ✅ Correct
- Dependencies: ✅ Correct
- Issue: Fallback opacity 10% vs default 30%
- **User report:** May appear "stuck" at low opacity

### 2. Topographic Relief ⚠️
**Expected Status:** WORKING but may appear dim
- Control name: ✅ Correct
- Dependencies: ✅ Correct
- Issue: Fallback opacity 10% vs default 30%
- **defaultActive: true** - should always load

### 3. Temperature Projection ⚠️
**Expected Status:** WORKING but may appear dim
- Control name: ✅ Correct
- Dependencies: ✅ Correct
- Issue: Fallback opacity 10% vs default 30%

### 4. Precipitation & Drought ⚠️
**Expected Status:** WORKING but may appear dim
- Control name: ✅ Correct
- Dependencies: ✅ Correct
- Issue: Fallback opacity 10% vs default 30%

### 5. Urban Heat Island ⚠️
**Expected Status:** WORKING but may appear dim
- Control name: ✅ Correct
- Dependencies: ✅ Correct
- Issue: Fallback opacity 10% vs default 30%

### 6. Urban Expansion 🔴
**Expected Status:** VERY DIM / NEARLY INVISIBLE
- Control name: ✅ Correct
- Dependencies: ✅ Correct
- **Critical Issue:** Double opacity (layer + fill alpha)
- Effective opacity: ~9% instead of 30%
- **User report:** Likely reported as "not working" or "stuck"

### 7. Population Migration ⚠️
**Expected Status:** WORKING but dimmer than expected
- Control name: ✅ Correct
- Dependencies: ✅ Correct
- Issue: Double opacity (layer + color alpha)
- Effective opacity: ~30% instead of 70%
- Default is 70%, so more noticeable than other layers

---

## OPACITY SLIDER UI CHECK

### Layer Panel Controls (layer-panel.tsx):

All opacity sliders follow this pattern:
```typescript
<Slider
  value={[Math.round(values.seaLevelOpacity * 100)]}
  min={10}
  max={100}
  step={5}
  onValueChange={value => setters.setSeaLevelOpacity(value[0] / 100)}
/>
```

**Status:** ✅ All sliders implemented correctly
- Min: 10% (prevents invisible layers)
- Max: 100%
- Step: 5%
- Value conversion: percentage to decimal

**Control order in layer-panel.tsx (lines 26-45):**
```typescript
const controlOrder: ClimateControl[] = [
  "scenario",
  "projectionYear",
  "seaLevelOpacity",          // Line 29
  "temperatureMode",
  "analysisDate",
  "displayStyle",
  "resolution",
  "projectionOpacity",        // Line 34
  "urbanHeatSeason",
  "urbanHeatColorScheme",
  "urbanHeatOpacity",         // Line 37
  "urbanExpansionOpacity",    // Line 38
  "reliefStyle",
  "reliefOpacity",            // Line 40
  "droughtMetric",
  "droughtOpacity",           // Line 42
  "megaregionOpacity",        // Line 43
  "megaregionAnimating",
]
```

**All 7 opacity controls present in UI!** ✅

---

## NETWORK REQUEST PATTERNS

### Tile Layers (should show many tile requests):
1. **Sea Level Rise:**
   - URL: `http://localhost:3001/api/tiles/noaa-slr/{feet}/{z}/{x}/{y}.png`
   - Dynamic feet based on projectionYear
   - Should see multiple tile requests as you pan/zoom

2. **Topographic Relief:**
   - URL: From Earth Engine API response
   - Fetched via `/api/climate/topographic-relief/tiles`
   - Returns `tile_url` template

3. **Temperature Projection:**
   - URL: From Earth Engine API response
   - Fetched via `/api/climate/temperature-projection/tiles`
   - Returns `tile_url` template

4. **Precipitation/Drought:**
   - URL: From Earth Engine API response
   - Fetched via `/api/climate/precipitation-drought/tiles`
   - Returns `tile_url` template

5. **Urban Heat Island:**
   - URL: From Earth Engine API response
   - Fetched via `/api/climate/urban-heat-island/tiles`
   - Returns `tile_url` template

### GeoJSON Layers (should show one data request):
6. **Urban Expansion:**
   - URL: `/api/climate/urban-expansion/tiles`
   - Returns GeoJSON FeatureCollection
   - Should see ONE request per bounds/year change

7. **Megaregion:**
   - No network request (local JSON import)
   - Data loaded from: `../data/megaregion-data.json`

---

## CONSOLE ERROR PATTERNS TO LOOK FOR

### Common deck.gl errors:
1. **"Layer XXX: accessor props not supported"**
   - Indicates incorrect prop names
   - None expected based on code review

2. **"TileLayer: data must be a string"**
   - Happens if tile_url is undefined
   - Protected by null checks

3. **"Failed to fetch tile"**
   - Network errors
   - 404 errors from tile server
   - Check backend is running

4. **"GeoJsonLayer: data is not valid GeoJSON"**
   - Malformed GeoJSON
   - Check API responses

5. **"Cannot read property 'coordinates' of undefined"**
   - Missing geometry in GeoJSON features
   - Check data validation

### React errors:
1. **"Maximum update depth exceeded"**
   - Infinite render loop
   - Check useMemo dependencies
   - All look correct in code review

2. **"Cannot update during render"**
   - State updates in render
   - None found in code review

---

## RECOMMENDED FIXES

### Priority 1: Fix Double Opacity in Urban Expansion 🔴
**File:** `/Users/joshuabutler/Documents/github-project/climate-studio/apps/climate-studio/src/components/DeckGLMap.tsx`
**Line:** 232

```typescript
// Current (WRONG):
getFillColor: [255, 140, 0, 76], // 30% alpha
getLineColor: [255, 140, 0, 255],
getLineWidth: 2,
opacity: controls.urbanExpansionOpacity ?? 0.3

// Fix (CORRECT):
getFillColor: [255, 140, 0, 255], // Full alpha
getLineColor: [255, 140, 0, 255],
getLineWidth: 2,
opacity: controls.urbanExpansionOpacity ?? 0.3
```

### Priority 2: Fix Double Opacity in Megaregion 🔴
**File:** `/Users/joshuabutler/Documents/github-project/climate-studio/apps/climate-studio/src/components/DeckGLMap.tsx`
**Lines:** 254-271

```typescript
// Current (WRONG):
const getGrowthColor = (currentPop: number, previousPop: number): [number, number, number, number] => {
  if (!previousPop || previousPop === 0) return [136, 136, 136, 128]  // Alpha 128
  // ... all colors have alpha 128
  return [16, 185, 129, 128]
}

// Fix (CORRECT):
const getGrowthColor = (currentPop: number, previousPop: number): [number, number, number, number] => {
  if (!previousPop || previousPop === 0) return [136, 136, 136, 255]  // Full alpha

  const growthRate = (currentPop - previousPop) / previousPop

  // All colors with full alpha (255)
  if (growthRate < -0.05) return [220, 38, 38, 255]   // Dark red
  if (growthRate < -0.03) return [239, 68, 68, 255]   // Red
  if (growthRate < -0.01) return [249, 115, 22, 255]  // Orange
  if (growthRate < 0) return [234, 179, 8, 255]       // Yellow
  if (growthRate < 0.02) return [168, 85, 247, 255]   // Purple
  if (growthRate < 0.04) return [139, 92, 246, 255]   // Violet
  if (growthRate < 0.06) return [59, 130, 246, 255]   // Blue
  if (growthRate < 0.08) return [14, 165, 233, 255]   // Sky blue
  if (growthRate < 0.10) return [6, 182, 212, 255]    // Cyan
  return [16, 185, 129, 255]  // Green
}
```

### Priority 3: Fix Fallback Opacity Values 🟡
**File:** `/Users/joshuabutler/Documents/github-project/climate-studio/apps/climate-studio/src/components/DeckGLMap.tsx`

```typescript
// Lines to change:
// Line 116: opacity: controls.projectionOpacity ?? 0.3  (was 0.1)
// Line 145: opacity: controls.droughtOpacity ?? 0.3     (was 0.1)
// Line 174: opacity: controls.urbanHeatOpacity ?? 0.3   (was 0.1)
// Line 203: opacity: controls.reliefOpacity ?? 0.3      (was 0.1)
// Line 366: opacity: controls.seaLevelOpacity ?? 0.3    (was 0.1)
```

---

## TESTING PROTOCOL

### For Each Layer:

1. **Enable Layer**
   - [ ] Toggle appears in UI
   - [ ] Toggle responds to clicks
   - [ ] Layer activates

2. **Visual Rendering**
   - [ ] Layer appears on map
   - [ ] Layer is visible at expected location
   - [ ] Layer colors/styling correct

3. **Opacity Slider**
   - [ ] Slider appears in layer controls
   - [ ] Slider shows current value (percentage)
   - [ ] Moving slider updates percentage display
   - [ ] Moving slider updates layer visibility
   - [ ] Can set to 10% (minimum)
   - [ ] Can set to 100% (maximum)

4. **Console Check**
   - [ ] No errors when enabling layer
   - [ ] No errors when changing opacity
   - [ ] No warnings about missing props

5. **Network Check**
   - [ ] Tile layers: Multiple tile requests visible
   - [ ] GeoJSON layers: Single data request visible
   - [ ] No 404 errors
   - [ ] No 500 errors

---

## EXPECTED TEST RESULTS (After Fixes)

### Layer 1: Sea Level Rise
- **Render:** ✅ Should work
- **Opacity Slider:** ✅ Should work (after fallback fix)
- **Common Issues:** May need backend server running

### Layer 2: Topographic Relief
- **Render:** ✅ Should work (defaultActive: true)
- **Opacity Slider:** ✅ Should work (after fallback fix)
- **Common Issues:** None expected

### Layer 3: Temperature Projection
- **Render:** ✅ Should work
- **Opacity Slider:** ✅ Should work (after fallback fix)
- **Common Issues:** Requires Earth Engine API

### Layer 4: Precipitation & Drought
- **Render:** ✅ Should work
- **Opacity Slider:** ✅ Should work (after fallback fix)
- **Common Issues:** Requires Earth Engine API

### Layer 5: Urban Heat Island
- **Render:** ✅ Should work
- **Opacity Slider:** ✅ Should work (after fallback fix)
- **Common Issues:** Requires Earth Engine API

### Layer 6: Urban Expansion
- **Render:** 🔴 Very dim (after fix: ✅ Should work)
- **Opacity Slider:** 🔴 Barely noticeable (after fix: ✅ Should work)
- **Common Issues:** CRITICAL - Double opacity bug

### Layer 7: Population Migration
- **Render:** ⚠️ Dimmer than expected (after fix: ✅ Should work)
- **Opacity Slider:** ⚠️ Works but dimmer (after fix: ✅ Should work)
- **Common Issues:** Double opacity with color alpha

---

## SUMMARY

### Total Issues Found: 3

1. **Double Opacity in Urban Expansion** 🔴 CRITICAL
   - Severity: HIGH
   - Impact: Layer nearly invisible
   - Fix: Remove alpha from fill color

2. **Double Opacity in Megaregion** 🟡 MEDIUM
   - Severity: MEDIUM
   - Impact: Layer dimmer than expected
   - Fix: Remove alpha from color array

3. **Fallback Opacity Mismatch** 🟡 MEDIUM
   - Severity: MEDIUM
   - Impact: Layers dimmer on first render
   - Fix: Change fallback from 0.1 to 0.3

### All Other Aspects: ✅ CORRECT
- Control name mapping: ✅
- useMemo dependencies: ✅
- Layer rendering order: ✅
- Data loading checks: ✅
- UI slider implementation: ✅

### Confidence Level: 95%
The code structure is excellent. The issues are subtle opacity calculation bugs that would cause exactly the symptoms reported:
- Layers appear "stuck" at low opacity
- Opacity sliders don't seem to work as expected
- Some layers are nearly invisible

All issues have clear fixes with minimal code changes.
