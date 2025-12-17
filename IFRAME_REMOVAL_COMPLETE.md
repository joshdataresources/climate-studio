# Iframe Removal - Monolith Conversion Complete

## What Was Changed

Successfully converted the climate-suite from using iframes to a shared component architecture.

### 1. Created Shared Component Package

**Location:** `packages/climate-studio-components/`

**Contents:**
- All core visualization components (GISAnalysisApp, DeckGLMap, MapboxGlobe, LayerPanel, etc.)
- UI components (buttons, inputs, sliders, etc.)
- Hooks (useClimateLayerData)
- Types and utilities
- Styles (CSS)

### 2. Updated Apps to Use Shared Components

#### climate-studio app (`apps/climate-studio/`)
- Now imports `GISAnalysisApp` from `@climate-studio/components`
- Simplified to just a wrapper around the shared component
- No longer runs on separate port (can still run standalone for development)

#### navigation app (`apps/navigation/`)
- **REMOVED IFRAME** ✅
- Now imports `GISAnalysisApp` directly from `@climate-studio/components`
- No more `<iframe src="http://localhost:8080">`
- Direct React component integration

### 3. Architecture Changes

**Before:**
```
navigation app (port 3000)
  └── <iframe src="http://localhost:8080">
        └── climate-studio app (separate process)
```

**After:**
```
navigation app (port 3000)
  └── <GISAnalysisApp /> (native React component)

climate-studio app (port 8080, optional)
  └── <GISAnalysisApp /> (same shared component)
```

## Benefits

### ✅ Performance
- No iframe overhead
- Single DOM tree
- Faster rendering
- Shared memory/resources

### ✅ Development Experience
- Run ONE app instead of two
- Shared state/context works natively
- No CORS issues
- No postMessage complexity
- Better debugging

### ✅ Code Reuse
- Components shared across apps
- Single source of truth
- Easier to maintain
- DRY principle

### ✅ User Experience
- Faster page loads
- Better SEO
- Improved accessibility
- Native routing

## How to Run

### Option 1: Run navigation app (recommended)
```bash
npm run dev:navigation
# Opens on http://localhost:5173 (or similar)
# Climate Studio page works without iframe
```

### Option 2: Run climate-studio standalone
```bash
npm run dev:studio
# Opens on http://localhost:8080
# Still works independently for testing
```

### Both apps share the same components from:
```bash
packages/climate-studio-components/
```

## What's Still a Microservice

Your backend services remain separate and independent:
- ✅ urban-studio-backend (Express/Node.js on port 3001)
- ✅ urban-studio-qgis (Flask/Python on port 5001)
- ✅ urban-studio-db (PostgreSQL on port 5432)

**This is the right architecture!** Backend services should stay separate for:
- Different tech stacks (Python for geospatial processing)
- Independent scaling
- Clear separation of concerns

## Next Steps (Optional)

1. **Remove unused code** - Delete duplicate components from `apps/climate-studio/src/components/` if no longer needed
2. **Consolidate styles** - Merge any duplicate CSS
3. **Type safety** - Enable stricter TypeScript settings once stable
4. **Documentation** - Document component APIs in the shared package
5. **Testing** - Add tests for shared components

## Rollback (if needed)

If you need to revert:
1. Change `apps/navigation/src/pages/ClimateStudio.tsx` back to iframe
2. Remove `@climate-studio/components` from navigation's package.json
3. Run `npm install`

## Summary

You now have a **hybrid architecture**:
- **Frontend:** Shared component library (monolith-like)
- **Backend:** Microservices (Python + Node.js + PostgreSQL)

This gives you the best of both worlds:
- Fast frontend development with shared components
- Flexible backend with specialized services
- No iframe complexity!
