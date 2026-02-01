# Layer System Verification Guide

## Overview
This guide verifies that all map layers are loading correctly and their accompanying right-side widgets are appearing as expected.

---

## Current Layer System Architecture

### Two Rendering Paths

#### Path 1: Built-in Factories Layer (Factories View Only)
- **Layer:** `factories` (enabled by default)
- **Rendering:** Handled by `setupFactoryLayers()` callback in FactoriesView.tsx (lines 59-189)
- **Right Panel:** FactoryLayersPanel (status, sector, risk filters)
- **Status:** ✅ **Always renders** on Factories view (hardcoded)

#### Path 2: Universal Layer System (All Views)
- **Layers:** All other layers in `layerDefinitions.ts`
- **Rendering:** Handled by `syncLayersToMap()` in layerRenderer.ts
- **Trigger:** Lines 309-334 in FactoriesView.tsx
- **Right Panel:** Dynamic via LayerControlsPanel wrapper
- **Status:** ✅ **Renders when enabled** via Layer Library

---

## How Layers Load on Factories View

### Step-by-Step Flow

1. **Map Initialization** (line 242-279)
   ```tsx
   useEffect(() => {
     const map = new mapboxgl.Map({ /* config */ })
     mapRef.current = map

     map.on('load', () => {
       setupFactoryLayers(map)  // ← Adds factories layer
       setMapLoaded(true)
     })
   }, [])
   ```

2. **Factories Layer Setup** (lines 59-189)
   - Converts `factories-expanded.json` to GeoJSON
   - Adds `factories` source with 35 factory features
   - Adds `factory-circles` layer (colored by risk_score)
   - Adds `factory-labels` layer (factory names)
   - Registers click handlers for factory detail panel

3. **Additional Layers Sync** (lines 309-334)
   ```tsx
   useEffect(() => {
     const enabledLayers = getEnabledLayersForView('factories')
     const additionalLayers = enabledLayers.filter(l => l.id !== 'factories')

     syncLayersToMap(map, additionalLayers, currentLayerIds)
   }, [mapLoaded, enabledLayers])
   ```
   - Monitors enabled layers from LayerContext
   - Filters out 'factories' (already handled)
   - Syncs remaining layers via universal renderer

4. **Right Panel Display** (lines 420-449)
   ```tsx
   {!panelsCollapsed && (
     <LayerControlsPanel viewId="factories" {...filterProps} />
   )}
   ```
   - LayerControlsPanel checks enabled layers
   - If 'factories' is enabled → shows FactoryLayersPanel
   - If climate layer enabled → shows ClimateLayerControlsPanel
   - If no layers have panels → shows nothing

---

## Layer-by-Layer Verification

### Infrastructure Layers

#### ✅ Factories
- **Enabled by default:** Yes
- **Map rendering:** ✅ Via `setupFactoryLayers()` (lines 59-189)
- **Right panel:** ✅ FactoryLayersPanel (always shows)
- **Data source:** `/data/factories-expanded.json` (35 factories)
- **Visual:** Color-coded circles by risk score (green/yellow/orange/red)
- **Interaction:** Click opens FactoryDetailPanel at bottom

#### ⏸️ Metro Service Areas
- **Enabled by default:** No
- **Map rendering:** ❌ Not implemented (`hasMapVisualization: false`)
- **Right panel:** None
- **Status:** Placeholder layer (no rendering yet)

---

### Climate Layers (DeckGL-Only)

#### ⏸️ Metro Temperature & Humidity
- **Enabled by default:** No
- **Map rendering:** ⚠️ **DeckGL required** (only works in Climate view)
- **Right panel:** ✅ ClimateLayerControlsPanel (if enabled)
- **Climate widget:** ✅ Appears when enabled
- **Available in:** Climate view only (`availableInViews: ['climate']`)
- **Rendering path:** DeckGLMap component, not Mapbox

#### ⏸️ Metro Data Statistics
- **Enabled by default:** No
- **Map rendering:** ❌ Not implemented (`hasMapVisualization: false`)
- **Right panel:** None
- **Purpose:** Data visualization in popups, not a map layer

#### ⏸️ Urban Heat Island
- **Enabled by default:** No
- **Map rendering:** ⚠️ **DeckGL required** (Climate view only)
- **Right panel:** ✅ ClimateLayerControlsPanel (if enabled)
- **Climate widget:** ✅ Appears when enabled
- **Available in:** Climate view only
- **Visual:** Heatmap overlay

#### ⏸️ Wet Bulb Temperature
- **Enabled by default:** No
- **Map rendering:** ⚠️ **DeckGL required** (Climate view only)
- **Right panel:** ✅ ClimateLayerControlsPanel (if enabled)
- **Climate widget:** ✅ Appears when enabled
- **Available in:** Climate view only
- **Visual:** Circles sized/colored by wet bulb temperature

#### ⏸️ Future Temperature Anomaly
- **Enabled by default:** No
- **Map rendering:** ⚠️ **DeckGL required** (Climate view only)
- **Right panel:** ✅ ClimateLayerControlsPanel (if enabled)
- **Climate widget:** ✅ Appears when enabled
- **Available in:** Climate view only (`availableInViews: ['climate']`)
- **Visual:** Hexagon grid from NASA Earth Engine
- **Note:** This layer triggered the fix - now properly restricted to Climate view

#### ⏸️ Precipitation & Drought
- **Enabled by default:** No
- **Map rendering:** ⚠️ **DeckGL required** (Climate view only)
- **Right panel:** ✅ ClimateLayerControlsPanel (if enabled)
- **Climate widget:** ✅ Appears when enabled
- **Available in:** Climate view only (`availableInViews: ['climate']`)
- **Visual:** Hexagon grid showing drought severity

---

### Water Layers

#### ⏸️ River Flow Status
- **Enabled by default:** No
- **Map rendering:** ❌ Not implemented (`hasMapVisualization: false`)
- **Right panel:** None
- **Status:** Placeholder layer (data source TBD)

#### ⏸️ Canals & Aqueducts
- **Enabled by default:** No
- **Map rendering:** ❌ Not implemented (`hasMapVisualization: false`)
- **Right panel:** None
- **Status:** Placeholder layer (data source TBD)

#### ⏸️ Major Dams
- **Enabled by default:** No
- **Map rendering:** ❌ Not implemented (`hasMapVisualization: false`)
- **Right panel:** None
- **Status:** Placeholder layer (data source TBD)

#### ⏸️ Groundwater
- **Enabled by default:** No
- **Map rendering:** ⚠️ **DeckGL required** (Climate view only)
- **Right panel:** ✅ ClimateLayerControlsPanel (if enabled)
- **Climate widget:** ✅ Appears when enabled
- **Available in:** Climate view only (`availableInViews: ['climate']`)
- **Visual:** GRACE satellite data hexagons

---

### Environment Layers

#### ⏸️ Topographic Relief
- **Enabled by default:** No
- **Map rendering:** ❌ Not implemented (`hasMapVisualization: false`)
- **Right panel:** None
- **Status:** Placeholder layer (raster tiles TBD)

---

## Right Panel Widget Verification

### How Right Panels Work

1. **LayerControlsPanel** (generic wrapper at lines 420-449):
   - Gets enabled layers from LayerContext
   - Checks if any have `rightPanelComponent` defined
   - Renders the appropriate panel component

2. **Panel Components:**

   | Layer ID | Right Panel Component | Props Required |
   |----------|----------------------|----------------|
   | `factories` | `FactoryLayersPanel` | 13 filter state props |
   | `metro_temperature_humidity` | `ClimateLayerControlsPanel` | layerName, layerId |
   | `urban_heat_island` | `ClimateLayerControlsPanel` | layerName, layerId |
   | `wet_bulb_temperature` | `ClimateLayerControlsPanel` | layerName, layerId |
   | `future_temperature_anomaly` | `ClimateLayerControlsPanel` | layerName, layerId |
   | `precipitation_drought` | `ClimateLayerControlsPanel` | layerName, layerId |
   | `groundwater` | `ClimateLayerControlsPanel` | layerName, layerId |

3. **Panel Positioning:**
   - **Without Climate Widget:** `top-4` (16px from top)
   - **With Climate Widget:** `top-[340px]` (below the widget)
   - **Width:** `w-80` (320px)
   - **Z-index:** `z-[1100]` (above map, below modals)

---

## Testing Checklist

### Factories View (http://localhost:8082/factories)

#### Default State
- [ ] **Map loads** at center of USA (lng: -98.5795, lat: 39.8283, zoom: 4)
- [ ] **35 factory markers appear** as colored circles
- [ ] **Factory labels** show factory names
- [ ] **Left sidebar** shows SearchAndViewsPanel and LayerLibraryPanel
- [ ] **Right sidebar** shows FactoryLayersPanel (status/sector/risk filters)
- [ ] **No Climate Widget** (factories layer doesn't require it)

#### Layer Library Interactions
- [ ] **Click "Factories" checkbox** → Layer toggles on/off (circles disappear/appear)
- [ ] **Uncheck "Factories"** → FactoryLayersPanel disappears (no right panel)
- [ ] **Re-check "Factories"** → FactoryLayersPanel reappears

#### Filter Interactions (FactoryLayersPanel)
- [ ] **Uncheck "Operational"** → Green factories disappear from map
- [ ] **Uncheck "Semiconductors"** → 10 semiconductor facilities disappear
- [ ] **Uncheck "Low Risk"** → Green-colored factories disappear
- [ ] **All filters work** without breaking map rendering

#### Climate Layer Test
- [ ] **Enable "Metro Temperature & Humidity"** from Layer Library dropdown
- [ ] **Climate Projections Widget appears** at top-right
- [ ] **ClimateLayerControlsPanel appears** on right (below widget if shown)
- [ ] **Console shows:** "⚠️ Layer metro_temperature_humidity requires DeckGL - only available in Climate view"
- [ ] **No broken rendering** (map still works, no errors)

#### Additional Layer Test
- [ ] **Enable "Future Temperature Anomaly"** from Layer Library
- [ ] **Climate Projections Widget appears** (if not already visible)
- [ ] **Console shows:** "⚠️ Layer future_temperature_anomaly requires DeckGL - only available in Climate view"
- [ ] **Layer appears in Layer Library** as enabled (blue border)
- [ ] **Layer doesn't render** on map (DeckGL-only)

---

### Climate View (http://localhost:8082/climate-studio)

#### Default State
- [ ] **DeckGLMap loads** with globe view
- [ ] **Left sidebar** shows SearchAndViewsPanel and LayerPanel
- [ ] **No right panels** initially (no layers enabled by default)
- [ ] **EarthEngineStatus** indicator shows connection status

#### Climate Layer Test
- [ ] **Enable "Future Temperature Anomaly"** from Layer Panel
- [ ] **Hexagon grid appears** on map (colored temperature anomalies)
- [ ] **Climate Projections Widget appears** at top-right
- [ ] **ClimateLayerControlsPanel appears** on right (below widget)
- [ ] **Scenario selector works** (RCP 2.6, 4.5, 8.5)
- [ ] **Year slider works** (2025-2100)
- [ ] **Map updates** when scenario/year changes

#### Metro Popup Test
- [ ] **Click on a metro area** (e.g., New York, Los Angeles)
- [ ] **MetroUnifiedPopup appears** centered on screen
- [ ] **Three sections visible:**
   - ☑️ Humidity & Wet Bulb Events (purple)
   - ☑️ Population Change (blue)
   - ☑️ Average Temperature Change (red, with chart)
- [ ] **Toggle checkboxes** hide/show sections
- [ ] **Collapse/expand** buttons work for each section
- [ ] **Data loads** from all three JSON files

---

### Water Access View (http://localhost:8082/water-access)

⚠️ **Pre-existing Issues:**
- TypeScript errors (missing imports for DnD Kit)
- IIFE syntax error (unclosed function)

**Recommendation:** Fix these before testing Water Access view.

---

## Console Output Reference

### Expected Console Logs (Factories View)

**On initial load:**
```
🗺️ Initializing Factories map...
✅ Map loaded for Factories view
🏭 Setting up factory layers with 35 factories...
📍 Adding factory source with features: 35
📍 First factory feature: {type: "Feature", geometry: {...}, properties: {...}}
📍 Sample coordinates: [[-111.9931, 33.5186], [-121.8907, 37.3382], ...]
✅ Factory layers and labels added to map
✅ Factory layer exists on map
📊 Layer paint properties: 12
📊 Source data features: 35
```

**When enabling a DeckGL layer:**
```
🎨 Adding layer to map: metro_temperature_humidity {hasMapVisualization: true, renderConfig: {...}, requiresDeckGL: undefined}
⚠️ Layer metro_temperature_humidity requires DeckGL - only available in Climate view
💡 This layer uses NASA Earth Engine / hexagon grid rendering
```

**When enabling a Mapbox-compatible layer (future):**
```
🎨 Adding layer to map: major_dams {hasMapVisualization: true, renderConfig: {...}}
📥 Fetching data for major_dams from /data/dams.json...
📦 Loaded data for major_dams: {type: "FeatureCollection", features: 450}
✅ Added source for major_dams
🗺️ Adding circle layer with config: {paint: {...}, layout: {...}}
✅ Layer added successfully: major_dams
✅ Synced layers to map: Set(1) {"major_dams"}
```

---

## Right Panel Widget Status

### FactoryLayersPanel (Factories Layer)

**Visibility Logic:**
```tsx
{!panelsCollapsed && (
  <LayerControlsPanel viewId="factories" {...filterProps} />
)}
```

**How it works:**
1. LayerControlsPanel calls `getEnabledLayersForView('factories')`
2. Finds 'factories' layer (enabled by default)
3. Checks if it has `rightPanelComponent` (yes: `FactoryLayersPanel`)
4. Renders FactoryLayersPanel with all filter props

**Panel shows:**
- STATUS filters (Operational, Construction, Announced, Failed/Paused)
- SECTOR filters (Semiconductors, Batteries, EVs, Data Centers, Electronics)
- CLIMATE RISK filters (Low, Moderate, High, Critical)
- All with blue checkboxes ✅

**Expected behavior:**
- ✅ Shows when `factories` layer is enabled
- ✅ Hides when `factories` layer is disabled
- ✅ Positioned at `right-4 top-4` (or `top-[340px]` if Climate Widget visible)
- ✅ Width: `w-80` (320px)

---

### ClimateLayerControlsPanel (Climate Layers)

**Visibility Logic:**
- Only appears when a climate layer (with `rightPanelComponent: ClimateLayerControlsPanel`) is enabled

**Panel shows:**
- Layer name (e.g., "Future Temperature Anomaly")
- Opacity slider (0-100%)
- Informational text: "Use the Climate Projections widget above to adjust the projection year and scenario."

**Expected behavior:**
- ✅ Shows when any climate layer is enabled
- ✅ Hides when all climate layers are disabled
- ✅ Multiple climate layers = shows panel for the first one
- ⚠️ **Note:** On Factories view, climate layers won't render (DeckGL-only), but panel still appears

---

## Climate Projections Widget

**Visibility Logic:**
```tsx
const showClimateWidget = shouldShowClimateWidget(enabledLayerIds)

{showClimateWidget && !panelsCollapsed && (
  <ClimateProjectionsWidget />
)}
```

**Triggers when ANY of these layers enabled:**
- `metro_temperature_humidity`
- `urban_heat_island`
- `wet_bulb_temperature`
- `future_temperature_anomaly`
- `precipitation_drought`
- `groundwater`

**Widget shows:**
- Climate Scenario dropdown (RCP 2.6, 4.5, 8.5)
- Projection Year slider (2025-2100)
- Summary stats:
  - Sea Level Rise (calculated)
  - Temperature Anomaly (calculated)
  - Precipitation (calculated)

**Expected behavior:**
- ✅ Appears at `top-4 right-4`
- ✅ Width: `w-80` (320px)
- ✅ Z-index: `z-[1100]`
- ✅ Pushes LayerControlsPanel down to `top-[340px]`

---

## Known Limitations

### DeckGL Layers on Factories/Water Views
**Issue:** Climate layers require DeckGL, which is only in the Climate view

**Current behavior:**
- Layer appears in Layer Library dropdown
- Can be enabled (checkbox turns blue)
- Climate Projections Widget appears
- ClimateLayerControlsPanel appears
- **BUT:** No map visualization (gracefully skipped with console warning)

**Why:**
- Factories/Water views use Mapbox GL JS (`mapboxgl.Map`)
- Climate view uses DeckGL (`DeckGLMap` component)
- DeckGL layers need NASA Earth Engine API and hexagon grid rendering

**Solutions:**
1. **Current (implemented):** Restrict climate layers to Climate view only (`availableInViews: ['climate']`)
2. **Future:** Add DeckGL overlay to Factories/Water views
3. **Alternative:** Create Mapbox-compatible versions of climate layers (simplified, non-hexagon)

---

## Troubleshooting

### Problem: Right panel not appearing

**Check:**
1. Is a layer with `rightPanelComponent` enabled?
   ```typescript
   // In console:
   const enabledLayers = /* from LayerContext */
   console.log('Enabled layers:', enabledLayers.filter(l => l.rightPanelComponent))
   ```

2. Is `panelsCollapsed` false?
   ```typescript
   // In console:
   console.log('Panels collapsed:', panelsCollapsed)
   ```

3. Does LayerControlsPanel have all required props?
   - For factories: 13 filter state props (showOperational, etc.)
   - For climate: layerName, layerId

### Problem: Layer not rendering on map

**Check:**
1. Does layer have `hasMapVisualization: true`?
2. Does layer have valid `dataSource` path?
3. Does layer have `renderConfig` defined?
4. Is layer DeckGL-only? (check `requiresDeckGL` flag)
5. Check browser console for:
   - `🎨 Adding layer to map: [layerId]`
   - `📥 Fetching data for [layerId]...`
   - `✅ Layer added successfully: [layerId]`
   - OR: `⚠️ Layer [layerId] requires DeckGL`

### Problem: Factory layer not visible

**Check:**
1. Is factories layer enabled in Layer Library? (should be by default)
2. Are all filters checked in FactoryLayersPanel?
   - At least one STATUS filter must be checked
   - At least one SECTOR filter must be checked
   - At least one RISK filter must be checked
3. Check console for:
   - `🏭 Setting up factory layers with 35 factories...`
   - `✅ Factory layers and labels added to map`

---

## Summary

### ✅ Working Correctly
- Factories layer renders on Factories view (35 markers)
- FactoryLayersPanel shows when factories layer enabled
- Climate Projections Widget appears for climate layers
- ClimateLayerControlsPanel appears for climate layers
- DeckGL layers gracefully skip on Mapbox views
- Layer Library shows all available layers for each view
- Universal layer renderer ready for future Mapbox-compatible layers

### ⚠️ Expected Behavior
- DeckGL layers (temperature, precipitation, groundwater) don't render on Factories/Water views
- They show widgets and panels, but no map visualization
- This is **intentional** - they require the Climate view's DeckGL component

### 🔮 Future Implementation
- Add Mapbox-compatible data sources for water layers (rivers, dams, canals)
- Add DeckGL support to Factories/Water views (enable climate layers everywhere)
- Add topographic relief raster layer
- Implement metro service areas polygons
