# Climate Suite Refactor - Claude Code Handoff

## 🎯 Project Overview
Multi-view climate visualization app with standardized layer system, consistent UI components, and cross-view layer rendering capabilities.

**Goal:** Create a polished, production-ready climate analysis tool that showcases manufacturing facility resilience analysis with professional data visualization.

---

## 📋 Tasks for Claude Code

### Task 1: Universal Layer System ⭐ HIGH PRIORITY
**Goal:** All layers work on all views (Climate, Water Access, Factories)

**Current State:**
- ✅ Layer definitions exist in `/src/config/layerDefinitions.ts`
- ✅ LayerContext manages layer state globally
- ✅ Factories layer renders on Factories view
- ❌ Other layers don't render when enabled
- ❌ No shared layer rendering system

**What to Build:**
1. Create `src/utils/mapLayerRenderer.ts` - Universal layer rendering utility
2. Extract factory rendering logic from `FactoriesView.tsx` into reusable function
3. For each layer type, create rendering logic:
   - **Factories** - Circle markers with labels (already exists, extract it)
   - **Metro Temperature** - Colored circles with popups (exists in GISAnalysisApp/WaterAccessView)
   - **Urban Heat Island** - Heatmap overlay (exists in Climate view)
   - **Groundwater** - Aquifer polygons (exists in WaterAccessView)
   - **Dams** - Dam markers (exists in WaterAccessView)
   - **Others** - Graceful no-op or placeholder

4. Each view should call the renderer when layers are enabled:
```typescript
// Pseudocode
const enabledLayers = useLayer().getEnabledLayersForView(viewId)
useEffect(() => {
  enabledLayers.forEach(layer => {
    renderLayerOnMap(map, layer)
  })
}, [enabledLayers, map])
```

**Files to Create:**
- `src/utils/mapLayerRenderer.ts`
- `src/hooks/useMapLayerRenderer.ts` (optional hook wrapper)

**Files to Modify:**
- `src/components/FactoriesView.tsx` - Use shared renderer
- `src/components/GISAnalysisApp.tsx` - Use shared renderer
- `src/components/WaterAccessView.tsx` - Use shared renderer

---

### Task 2: Component Standardization
**Goal:** All UI components look identical across all views

**Audit Checklist:**
- ☑️ All checkboxes use `data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500`
- ☑️ All buttons follow primary (blue) / secondary (gray) pattern
- ☑️ All input fields have consistent border-radius, padding, focus states
- ☑️ Layer cards have blue border when selected, consistent padding
- ☑️ Right-side panels use same `widget-container` class and positioning

**Files to Check:**
```bash
# Find all Checkbox uses
rg "Checkbox" --type tsx -A 2

# Find all Button uses
rg "<Button" --type tsx -A 2

# Find purple/violet color uses (should be blue)
rg "purple|violet" --type tsx
```

**Specific Fixes Needed:**
1. `FactoryLayersPanel.tsx` - Change checkbox styling to blue
2. Ensure all panels use `widget-container` class
3. Standardize hover states on all interactive elements

---

### Task 3: Layer-Specific Right Panels
**Goal:** Each layer can have custom controls in right panel

**Design:**
```typescript
// Add to layerDefinitions.ts
rightPanelComponent?: React.ComponentType<{ layerId: string }>
```

**Implementation:**
- Create `src/components/panels/LayerControlsPanel.tsx` that conditionally renders based on enabled layers
- Currently only Factories has custom panel (FactoryLayersPanel)
- For other layers, either show metadata or hide right panel
- Panel should be positioned consistently: `absolute right-4 top-4 w-80`

---

### Task 4: Climate Projections Widget ⭐ HIGH PRIORITY
**Goal:** Show climate widget in top-right when climate layers are enabled

**Specification:**
```typescript
// Widget should appear when ANY of these layers are enabled:
const CLIMATE_WIDGET_LAYERS = [
  'metro_temperature_humidity',
  'metro_data_statistics',
  'urban_heat_island',
  'wet_bulb_temperature',
  'future_temperature_anomaly',
  'precipitation_drought',
  'groundwater'
]

// Do NOT show for: factories, major_dams, topographic_relief
```

**Use existing helper:**
```typescript
import { shouldShowClimateWidget } from '../config/layerDefinitions'

const enabledLayerIds = enabledLayers.map(l => l.id)
const showWidget = shouldShowClimateWidget(enabledLayerIds)
```

**Widget Structure:**
```tsx
<div className="absolute top-4 right-4 z-[1100] w-[320px] widget-container">
  <h3>Climate Projections</h3>

  {/* Climate Scenario */}
  <div>
    <label>Climate Scenario</label>
    <Select>
      <SelectItem>RCP 4.5 (Moderate)</SelectItem>
      <SelectItem>RCP 8.5 (High)</SelectItem>
    </Select>
  </div>

  {/* Projection Year Slider */}
  <div>
    <label>Projection Year: {year}</label>
    <Slider min={2025} max={2100} value={[year]} />
  </div>

  {/* Summary Stats */}
  <div className="grid grid-cols-2 gap-2">
    <div>
      <div className="text-xl font-bold">35</div>
      <div className="text-xs">Total Facilities</div>
    </div>
    <div>
      <div className="text-xl font-bold">$455B</div>
      <div className="text-xs">Total Investment</div>
    </div>
  </div>
</div>
```

**Files to Create:**
- `src/components/widgets/ClimateProjectionsWidget.tsx`

**Files to Modify:**
- Add to all three view files (GISAnalysisApp, WaterAccessView, FactoriesView)

---

### Task 5: Merge Metro Popovers
**Goal:** Combine two metro popups into one with toggle sections

**Current State:**
- `MetroTemperaturePopup.tsx` - Shows temperature data
- Metro Data Statistics - Shows different data
- They appear separately when clicking metros

**New Design:**
```tsx
<MetroUnifiedPopup city={cityData}>
  <h2>{city.name}</h2>

  {/* Toggle Section 1 */}
  <div className="border rounded p-2">
    <label>
      <Checkbox checked={showHumidity} />
      Humidity & Wet Bulb Events
    </label>
    {showHumidity && (
      <div>
        <Chart data={wetBulbProjections} />
        <p>Dangerous heat events: {events}</p>
      </div>
    )}
  </div>

  {/* Toggle Section 2 */}
  <div className="border rounded p-2">
    <label>
      <Checkbox checked={showPopulation} />
      Population Change
    </label>
    {showPopulation && (
      <div>
        <Chart data={populationProjections} />
        <p>2024: {pop2024} → 2050: {pop2050}</p>
      </div>
    )}
  </div>

  {/* Toggle Section 3 */}
  <div className="border rounded p-2">
    <label>
      <Checkbox checked={showTemp} />
      Average Temperature Change
    </label>
    {showTemp && (
      <div>
        <Chart data={temperatureAnomaly} />
        <p>+{tempIncrease}°F by 2050</p>
      </div>
    )}
  </div>
</MetroUnifiedPopup>
```

**Data Sources:**
- `src/data/metro_temperature_projections.json`
- `src/data/expanded_wet_bulb_projections.json`
- `src/data/megaregion-data.json`

**Files to Create:**
- `src/components/popups/MetroUnifiedPopup.tsx`

**Files to Modify:**
- `src/components/GISAnalysisApp.tsx` - Replace old popup
- `src/components/WaterAccessView.tsx` - Replace old popup

---

### Task 6: Standardize Search & Views Section
**Goal:** All three views have identical search and saved views functionality

**Current State:**
- ✅ GISAnalysisApp - Full search + saved views with drag-to-reorder
- ✅ WaterAccessView - Has search + saved views
- ❌ FactoriesView - Basic search only, missing saved views

**Extract Pattern:**
All three views should have this exact panel structure:
```tsx
<div className="widget-container">
  {/* Search */}
  <form onSubmit={handleSearch}>
    <Input placeholder="Search for a city, state, or co" />
    <Button>Search</Button>
  </form>

  {/* Search Results */}
  {searchResults.length > 0 && (
    <ul>
      {searchResults.map(result => (
        <li onClick={() => moveToResult(result)}>
          {result.display_name}
        </li>
      ))}
    </ul>
  )}

  {/* Views Section */}
  <div>
    <div className="flex justify-between">
      <h3>Views</h3>
      <Button onClick={() => setShowSaveDialog(true)}>
        <Save /> New View
      </Button>
    </div>

    {/* Draggable Saved Views List */}
    <DndContext>
      <SortableContext items={savedViews}>
        {savedViews.map(view => (
          <SortableViewItem
            view={view}
            onLoad={loadView}
            onEdit={editView}
            onDelete={deleteView}
          />
        ))}
      </SortableContext>
    </DndContext>
  </div>
</div>
```

**Implementation:**
1. Extract into `src/components/panels/SearchAndViewsPanel.tsx`
2. Use MapContext hooks: `useMap()` provides search, savedViews, etc.
3. Replace the search section in all three views with this component

**Files to Create:**
- `src/components/panels/SearchAndViewsPanel.tsx`

**Files to Modify:**
- `src/components/FactoriesView.tsx` - Replace search widget
- `src/components/GISAnalysisApp.tsx` - Use shared component
- `src/components/WaterAccessView.tsx` - Use shared component

---

## 📁 Key Files Reference

### Already Created (by me)
- ✅ `/src/config/layerDefinitions.ts` - Complete layer configuration with icons, sources
- ✅ `/src/contexts/LayerContext.tsx` - Global layer state management
- ✅ `/src/components/panels/LayerLibraryPanel.tsx` - Left panel for layer selection (blue checkboxes, icons)
- ✅ `/src/components/FactoriesView.tsx` - Working factory rendering and filtering

### Need to Create
- `src/utils/mapLayerRenderer.ts`
- `src/hooks/useMapLayerRenderer.ts`
- `src/components/widgets/ClimateProjectionsWidget.tsx`
- `src/components/popups/MetroUnifiedPopup.tsx`
- `src/components/panels/SearchAndViewsPanel.tsx`
- `src/components/panels/LayerControlsPanel.tsx`

### Need to Modify
- `src/components/GISAnalysisApp.tsx`
- `src/components/WaterAccessView.tsx`
- `src/components/FactoriesView.tsx`
- `src/components/panels/FactoryLayersPanel.tsx`

---

## 🎨 Design Specifications

### Colors
- **Primary Accent:** Blue (#3b82f6 / `blue-500`)
- **Success:** Green (#10b981 / `green-500`)
- **Warning:** Yellow (#eab308 / `yellow-500`)
- **Danger:** Red (#ef4444 / `red-500`)
- **Text:** Gray-900 (dark mode: white)
- **Muted:** Gray-500

### Component Styling
```css
/* Checkbox (checked state) */
.checkbox[data-state="checked"] {
  background-color: #3b82f6;
  border-color: #3b82f6;
}

/* Layer Card (selected) */
.layer-card {
  border: 2px solid #3b82f6;
  background: #eff6ff; /* blue-50 */
  border-radius: 0.5rem;
  padding: 0.75rem;
}

/* Widget Container */
.widget-container {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 0.75rem;
  padding: 1rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}
```

### Positioning
- **Left Panel:** `left-[92px] top-4 w-[360px]`
- **Right Panel:** `right-4 top-4 w-80`
- **Top-Right Widget:** `top-4 right-4 w-[320px]`
- **Bottom Modal:** `bottom-4 left-1/2 -translate-x-1/2 w-[640px]`

---

## ✅ Success Criteria

After completion, the app should have:

1. **Universal Layers** - Any layer can be enabled on any view and renders correctly
2. **Consistent UI** - All checkboxes are blue, all components match design system
3. **Climate Widget** - Appears automatically when climate layers are enabled
4. **Unified Metro Popup** - Single popup with 3 toggleable data sections
5. **Standardized Search** - Identical search + views panel on all three pages
6. **Zero TypeScript Errors** - Clean compilation
7. **Professional Polish** - Ready for demo/LinkedIn post

---

## 🚀 Suggested Execution Strategy

**Option 1: Sequential (Safer)**
1. Task 6 first (easy win - extract search component)
2. Task 2 (audit and fix styling)
3. Task 4 (climate widget)
4. Task 5 (merge popups)
5. Task 3 (layer controls panel)
6. Task 1 last (complex - universal renderer)

**Option 2: Parallel Agents (Faster)**
```bash
# Terminal 1
claude-code agent --name="layer-renderer" --task="Task 1: Universal Layer System"

# Terminal 2
claude-code agent --name="ui-standardization" --task="Task 2: Component Standardization"

# Terminal 3
claude-code agent --name="climate-widget" --task="Task 4: Climate Projections Widget"
```

---

## 💡 Implementation Tips

### Reusing Existing Code
- Climate view (GISAnalysisApp) already has metro temperature rendering - copy it
- Water view already has aquifer rendering - extract the pattern
- Factory view has the best filtering system - use it as template

### Testing Strategy
1. Start dev server: `npm run dev --workspace=climate-studio`
2. Test each view: `/climate-studio`, `/water-access`, `/factories`
3. Enable/disable layers and verify they render
4. Check console for errors
5. Verify all checkboxes are blue, not purple

### Common Pitfalls
- **Mapbox style changes remove layers** - Re-add layers in `style.load` event
- **Layer conflicts** - Use unique layer IDs (prefix with layer type)
- **Data not loading** - Check file paths in `layerDefinitions.ts`
- **Filters breaking** - Ensure filter expressions handle undefined values

---

## 📊 Current State Summary

**What Works:**
- ✅ Global layer management system (LayerContext)
- ✅ Layer configuration with icons and sources
- ✅ Factories render on map with filters
- ✅ Factory detail modal on click
- ✅ Blue checkboxes in layer library
- ✅ Theme switching (light/dark mode)

**What Needs Work:**
- ❌ Non-factory layers don't render when enabled
- ❌ Climate widget missing
- ❌ Two separate metro popups need merging
- ❌ Search panel differs on Factories view
- ❌ Some checkboxes still purple
- ❌ Right panel only works for factories

---

## 📝 LinkedIn Post Draft (After Completion)

**Title Ideas:**
- "Building Climate-Resilient Infrastructure: A Data-Driven Analysis"
- "Mapping the Future: $455B in Manufacturing Investment vs. Climate Risk"
- "Climate Intelligence for Industrial Planning"

**Post Structure:**
```
🏭 Just completed an interactive climate resilience analysis tool

Analyzed 35+ major US manufacturing facilities ($455B investment) against:
• Heat stress projections (wet bulb temperature)
• Water scarcity risk
• Urban heat island effects
• Groundwater depletion

Key findings:
📍 Phoenix area: 9.5/10 climate risk despite $40B TSMC investment
💧 Water stress in semiconductor manufacturing hot spots
🌡️ Critical wet bulb events projected to increase 300% by 2050

Built with: React, TypeScript, Mapbox GL, NASA Earth Engine data

The tool enables cross-layer analysis - overlay factories with groundwater,
temperature projections, infrastructure, and population data.

This is the kind of climate intelligence infrastructure planners need.

[Screenshots/GIF]

#ClimateData #InfrastructurePlanning #DataVisualization #ClimateResilience
```

**Include in Post:**
- 2-3 screenshots showing different views
- GIF of layer toggling and interactions
- Link to live demo if deployed

---

## 🎯 Final Notes

**Priority Order:**
1. Get all layers rendering (Task 1) - Core functionality
2. Add climate widget (Task 4) - Visual impact
3. Standardize UI (Task 2) - Professional polish
4. Everything else - Nice to have

**Time Estimate:**
- Tasks 2, 6: ~1 hour each (easy)
- Tasks 3, 4, 5: ~2 hours each (medium)
- Task 1: ~4 hours (complex)
- **Total: ~12-15 hours** for experienced developer

**When Done:**
Run final checks:
```bash
# TypeScript
npx tsc --noEmit

# Build
npm run build --workspace=climate-studio

# Test all three views
# Visit /climate-studio, /water-access, /factories
# Enable various layers and verify they render
```

Good luck! 🚀
