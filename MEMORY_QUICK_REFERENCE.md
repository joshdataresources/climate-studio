# Orchestrator Memory - Quick Reference Card

## 🚀 Quick Start

### User Access
1. Click **Settings** icon (⚙️) in sidebar (bottom)
2. Configure preferences
3. Done! Sessions auto-save/restore

### Developer Access
```tsx
import { useOrchestratorMemory } from './hooks/useOrchestratorMemory'

const { preferences, getSavedLayers, exportMemory } = useOrchestratorMemory()
```

## 📁 Files Created

```
src/
├── services/
│   └── OrchestratorMemory.ts          # Core memory service
├── hooks/
│   └── useOrchestratorMemory.ts       # React hook
├── components/panels/
│   └── OrchestratorMemoryPanel.tsx    # Settings UI
├── pages/
│   └── SettingsPage.tsx               # Settings page
└── orchestrators/
    └── LayerOrchestrator.ts           # Updated with memory
```

## 🎯 Key Features

| Feature | Status | Description |
|---------|--------|-------------|
| **Auto-save** | ✅ | Automatic 500ms debounced saves |
| **Layer States** | ✅ | Which layers enabled, opacity |
| **Viewport Memory** | ✅ | Zoom, center, pitch, bearing per view |
| **Panel States** | ✅ | Which panels open, configurations |
| **Preferences** | ✅ | 3 user-controllable toggles |
| **Export** | ✅ | Download as JSON file |
| **Import** | ✅ | Restore from JSON |
| **Clear** | ✅ | Reset all data |
| **Debug** | ✅ | View full state |

## 📖 API Cheat Sheet

### Hook Methods
```tsx
const {
  preferences,          // { autoRestoreSession, rememberLayerStates, rememberViewport }
  lastActiveView,       // string | undefined
  updatePreferences,    // (prefs) => void
  getSavedLayers,       // () => LayerState[]
  getSavedViewport,     // (viewId) => Viewport
  saveViewport,         // (viewId, viewport) => void
  clearMemory,          // () => void
  exportMemory,         // () => string (JSON)
  importMemory,         // (json) => void
  getState,             // () => FullState
} = useOrchestratorMemory()
```

### Orchestrator Methods
```tsx
const orchestrator = getLayerOrchestrator()

orchestrator.getMemory()
orchestrator.getSavedLayerStates()
orchestrator.saveViewport(viewId, viewport)
orchestrator.getSavedViewport(viewId)
orchestrator.forceSaveMemory()
orchestrator.clearMemory()
orchestrator.exportMemory()
orchestrator.importMemory(json)
```

## 💾 Storage

- **Key**: `climate-suite-orchestrator-memory`
- **Location**: Browser localStorage
- **Size**: ~5-10KB typical, 5-10MB max
- **Persistence**: Survives browser restarts
- **Privacy**: 100% client-side, no server

## 🔧 Common Patterns

### Check if auto-restore is enabled
```tsx
const { preferences } = useOrchestratorMemory()
if (preferences.autoRestoreSession) {
  // User wants auto-restore
}
```

### Get recently used layers
```tsx
const { getSavedLayers } = useOrchestratorMemory()
const recent = getSavedLayers()
  .sort((a, b) => (b.lastViewed || 0) - (a.lastViewed || 0))
  .slice(0, 5)
```

### Export for backup
```tsx
const { exportMemory } = useOrchestratorMemory()
const json = exportMemory()
// Download as file or save somewhere
```

### Clear everything
```tsx
const { clearMemory } = useOrchestratorMemory()
if (confirm('Clear all?')) {
  clearMemory()
}
```

## 🐛 Debug

### Browser Console
```javascript
const { getOrchestratorMemory } = await import('./src/services/OrchestratorMemory')
const memory = getOrchestratorMemory()
console.log(memory.getState())
```

### In Component
```tsx
const { getState } = useOrchestratorMemory()
console.log('Memory state:', getState())
```

## 📚 Documentation

| File | Purpose |
|------|---------|
| `ORCHESTRATOR_MEMORY_README.md` | Overview & quick start |
| `ORCHESTRATOR_MEMORY_GUIDE.md` | Complete API reference |
| `MEMORY_USAGE_EXAMPLES.md` | Code examples & patterns |
| `ORCHESTRATOR_MEMORY_COMPLETE.md` | Implementation summary |
| `MEMORY_QUICK_REFERENCE.md` | This card |

## ✅ Checklist

- [x] Core memory service
- [x] React hook
- [x] Settings UI
- [x] Settings page & route
- [x] Sidebar integration
- [x] Auto-save functionality
- [x] Export/Import
- [x] User preferences
- [x] Documentation
- [x] Build verified

## 🎉 Status: READY TO USE

Navigate to `/settings` or click the Settings icon (⚙️) in the sidebar!
