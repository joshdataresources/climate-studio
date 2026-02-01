# Quick Integration Guide - Factory Layer

## Files You Need to Edit

Only **ONE** file needs modification: `apps/climate-studio/src/components/WaterAccessView.tsx`

---

## Step-by-Step Changes

### 1️⃣ Add Imports (Top of File, ~Line 14)

```typescript
// ADD THESE THREE LINES:
import { SelectedFactory, FactoryDetailsPanel } from './panels/FactoryDetailsPanel'
import factoriesData from '../data/factories.json'
import { setupFactoryLayer } from '../utils/factoryLayerSetup'
```

---

### 2️⃣ Add State Variables (~Line 530)

Find this section:
```typescript
const [selectedAquifer, setSelectedAquifer] = useState<SelectedAquifer | null>(null)
const [selectedFeatureId, setSelectedFeatureId] = useState<string | number | null>(null)
```

**Add below it:**
```typescript
// Factory state
const [selectedFactory, setSelectedFactory] = useState<SelectedFactory | null>(null)
```

---

### 3️⃣ Setup Factory Layer (~Line 2200, inside map.on('load'))

Find the section where aquifer layers are set up. After that setup, **add this code:**

```typescript
// ============================================
// FACTORY LAYER SETUP
// ============================================
try {
  setupFactoryLayer(
    map,
    factoriesData,
    (factoryProperties) => {
      setSelectedFactory({
        name: factoryProperties.name,
        company: factoryProperties.company,
        city: factoryProperties.city,
        state: factoryProperties.state,
        type: factoryProperties.type,
        investment: factoryProperties.investment,
        employees: factoryProperties.employees,
        yearEstablished: factoryProperties.yearEstablished,
        facilities: factoryProperties.facilities,
        waterUsage: factoryProperties.waterUsage,
        environmental: factoryProperties.environmental
      })
    }
  )
  console.log('✅ Factory layer loaded successfully')
} catch (error) {
  console.error('❌ Error loading factory layer:', error)
}
```

---

### 4️⃣ Add Factory Panel to Render (~Line 3946)

Find this section:
```typescript
{/* Groundwater Details Panel - Bottom Center */}
{selectedAquifer && (
  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto" style={{ width: '640px' }}>
    <GroundwaterDetailsPanel
      selectedAquifer={selectedAquifer}
      projectionYear={projectionYear}
      onClose={closeDetailsPanel}
    />
  </div>
)}
```

**Add this AFTER it:**
```typescript
{/* Factory Details Panel - Bottom Right */}
{selectedFactory && (
  <div className="absolute bottom-4 right-4 z-[1000] pointer-events-auto" style={{ width: '640px' }}>
    <FactoryDetailsPanel
      selectedFactory={selectedFactory}
      onClose={() => setSelectedFactory(null)}
    />
  </div>
)}
```

---

## 🎯 That's It!

Save the file and reload your app. You should see:
- ✅ Colored circles on the map (Texas and Phoenix)
- ✅ Hover effect when you mouse over them
- ✅ Click opens a panel at bottom-right
- ✅ Panel shows factory details and environmental impact

---

## Troubleshooting

### Issue: TypeScript errors on import
**Solution**: Make sure these files exist:
- `apps/climate-studio/src/data/factories.json`
- `apps/climate-studio/src/components/panels/FactoryDetailsPanel.tsx`
- `apps/climate-studio/src/utils/factoryLayerSetup.ts`

### Issue: Factories don't appear on map
**Solution**:
1. Open browser console (F12)
2. Look for "✅ Factory layer loaded successfully"
3. If not there, check for errors
4. Verify you're zoomed to Texas/Phoenix area

### Issue: Panel doesn't appear when clicking
**Solution**:
1. Check browser console for errors
2. Verify `setupFactoryLayer` was called
3. Make sure you added the state variables

### Issue: Map crashes when clicking factory
**Solution**:
1. Check that `factoriesData` imported correctly
2. Verify JSON structure in `factories.json`
3. Look for parsing errors in console

---

## Testing Checklist

- [ ] Import statements added (no red squiggles)
- [ ] State variables added
- [ ] Factory layer setup code added in map load
- [ ] Factory panel component added to render
- [ ] App compiles without errors
- [ ] Map loads and shows existing features (aquifers, etc.)
- [ ] Factory markers visible in Texas/Phoenix
- [ ] Hovering over factory changes cursor
- [ ] Clicking factory opens panel
- [ ] Panel shows correct factory data
- [ ] Close button (X) works
- [ ] Can click different factories and panel updates

---

## Color Reference

When testing, verify these factories show the correct colors:

### 🔴 Red (Critical)
- TSMC Phoenix
- TI Sherman
- Samsung Taylor
- Inventec Houston
- Lily Harris County

### 🟠 Orange (Stressed)
- Nestlé Glendale
- LG Queen Creek
- Amkor Peoria
- P&G Coolidge

### 🔵 Blue (Moderate)
- T1 Energy Wilmer

---

## Optional Enhancements

Once working, you can:

1. **Adjust position**: Change `right-4` to `left-4` or center it
2. **Adjust size**: Change width from `640px` to preferred size
3. **Add toggle**: Create checkbox to show/hide factories
4. **Filter by severity**: Only show critical/stressed
5. **Add to legend**: Include factories in map legend

---

## Need Help?

Check these in order:
1. Browser console (F12) for errors
2. Network tab for failed imports
3. React DevTools to verify state
4. Mapbox GL debugger for layer issues

## File Locations Reference

```
climate-suite/
├── apps/climate-studio/src/
│   ├── components/
│   │   ├── WaterAccessView.tsx          ← EDIT THIS FILE
│   │   └── panels/
│   │       ├── GroundwaterDetailsPanel.tsx
│   │       └── FactoryDetailsPanel.tsx  ← NEW (already created)
│   ├── data/
│   │   └── factories.json               ← NEW (already created)
│   └── utils/
│       └── factoryLayerSetup.ts         ← NEW (already created)
└── FACTORY_LAYER_INTEGRATION.md         ← Full documentation
```
