# Orchestrator Memory System

A complete persistent storage solution for the Climate Suite LayerOrchestrator that automatically saves and restores user sessions across browser sessions.

## 🎯 What It Does

- **Auto-saves** layer states, viewport positions, and panel configurations
- **Persists** across browser sessions using localStorage
- **Restores** your exact workspace when you return
- **Exports/Imports** for backup and sharing configurations
- **User-controlled** with granular preferences

## 🚀 Quick Start

### Already Integrated!

The memory system is **automatically working** in your application. No setup needed!

Every view using `useLayerOrchestrator` automatically gets:
- Layer state persistence
- Viewport memory
- Panel state tracking

### Access Settings

1. Click the **Settings** icon in the left sidebar (gear icon at bottom)
2. Configure your memory preferences
3. View saved data, export, or clear memory

## 📁 Files Created

### Core Services
- **`src/services/OrchestratorMemory.ts`** - Main memory service with localStorage persistence
- **`src/hooks/useOrchestratorMemory.ts`** - React hook for easy access
- **`src/components/panels/OrchestratorMemoryPanel.tsx`** - Settings UI component
- **`src/pages/SettingsPage.tsx`** - Full settings page

### Documentation
- **`ORCHESTRATOR_MEMORY_GUIDE.md`** - Complete API reference
- **`MEMORY_USAGE_EXAMPLES.md`** - Code examples and patterns
- **`ORCHESTRATOR_MEMORY_README.md`** - This file

### Updated Files
- **`src/orchestrators/LayerOrchestrator.ts`** - Added memory integration
- **`src/components/layout/AppSidebar.tsx`** - Added Settings button
- **`src/App.tsx`** - Added Settings route

## 💡 Key Features

### 1. Automatic Layer Persistence
```tsx
// Layers are automatically saved when enabled/disabled
// They restore on page reload if preferences allow
```

### 2. Viewport Memory
```tsx
// Save map position, zoom, pitch, bearing per view
orchestrator.saveViewport('factories', {
  zoom: 12,
  center: [-122.4, 37.8],
  pitch: 45,
  bearing: 0
})
```

### 3. User Preferences
- **Auto-restore Session** - Automatically restore last session
- **Remember Layer States** - Save enabled layers
- **Remember Viewport** - Save map position

### 4. Export/Import
```tsx
// Export for backup
const json = memory.export()

// Import to restore
memory.import(json)
```

### 5. Panel State Tracking
```tsx
// Automatically tracks which panels are open
// Restores panel configuration on reload
```

## 🔧 Usage Examples

### Simple: Check User Preferences
```tsx
import { useOrchestratorMemory } from '../hooks/useOrchestratorMemory'

function MyComponent() {
  const { preferences } = useOrchestratorMemory()

  if (preferences.autoRestoreSession) {
    // User wants auto-restore
  }
}
```

### Get Saved Layers
```tsx
const { getSavedLayers } = useOrchestratorMemory()
const layers = getSavedLayers() // Array of saved layer states
```

### Export User Data
```tsx
const { exportMemory } = useOrchestratorMemory()
const json = exportMemory() // JSON string of all saved data
```

### Clear All Memory
```tsx
const { clearMemory } = useOrchestratorMemory()
clearMemory() // Removes all saved data
```

## 📊 Memory Structure

```typescript
{
  layerStates: [
    { id: "factories", enabled: true, opacity: 0.8, lastViewed: 1234567890 }
  ],
  viewPreferences: {
    "factories": { zoom: 12, center: [-122.4, 37.8], pitch: 0, bearing: 0 }
  },
  activePanels: ["layer-controls", "climate-projections"],
  panelPreferences: {
    "layer-controls": { collapsed: false, width: 300 }
  },
  preferences: {
    autoRestoreSession: true,
    rememberLayerStates: true,
    rememberViewport: true
  },
  lastUpdated: 1234567890,
  version: "1.0.0"
}
```

## 🎨 User Interface

### Settings Panel Features
- ✅ Toggle all three memory preferences
- 📋 View saved state summary
- 💾 Export memory to JSON file
- 📥 Import memory from JSON file
- 🗑️ Clear all saved data
- 🐛 Debug information viewer

### Navigation
1. **Settings Icon** - Bottom of left sidebar
2. **Route** - `/settings`
3. **Direct Access** - Click Settings in sidebar

## 🔐 Privacy & Security

- All data stored **locally** in browser localStorage
- **No server communication** - fully client-side
- **User-controlled** - can be cleared at any time
- **Export/Import** - users own their data
- **Version-safe** - includes migration support

## 📈 Storage Details

- **Storage Key**: `climate-suite-orchestrator-memory`
- **Location**: Browser localStorage
- **Size Limit**: ~5-10MB (browser-dependent)
- **Auto-save Delay**: 500ms debounce
- **Version**: 1.0.0

## 🛠️ API Reference

### useOrchestratorMemory Hook

```typescript
const {
  preferences,          // Current user preferences
  lastActiveView,       // Last active view ID
  updatePreferences,    // Update preferences
  getSavedLayers,       // Get saved layer states
  getSavedViewport,     // Get saved viewport
  saveViewport,         // Save viewport
  clearMemory,          // Clear all memory
  exportMemory,         // Export as JSON
  importMemory,         // Import from JSON
  getState,             // Get full state
  refreshPreferences    // Refresh from storage
} = useOrchestratorMemory()
```

### LayerOrchestrator Methods

```typescript
orchestrator.getMemory()               // Get memory instance
orchestrator.getSavedLayerStates()     // Get saved layers
orchestrator.getLastActiveView()       // Get last view
orchestrator.saveViewport(id, vp)      // Save viewport
orchestrator.getSavedViewport(id)      // Get viewport
orchestrator.updateMemoryPreferences() // Update prefs
orchestrator.getMemoryPreferences()    // Get prefs
orchestrator.clearMemory()             // Clear all
orchestrator.exportMemory()            // Export JSON
orchestrator.importMemory(json)        // Import JSON
orchestrator.forceSaveMemory()         // Force save
```

## 📚 Documentation

- **API Reference**: `ORCHESTRATOR_MEMORY_GUIDE.md`
- **Code Examples**: `MEMORY_USAGE_EXAMPLES.md`
- **This Overview**: `ORCHESTRATOR_MEMORY_README.md`

## 🧪 Testing

### In Browser Console
```javascript
const { getOrchestratorMemory } = await import('./services/OrchestratorMemory')
const memory = getOrchestratorMemory()

console.log('State:', memory.getState())
console.log('Layers:', memory.getLayerStates())
console.log('Last view:', memory.getLastActiveView())
```

### In Components
```tsx
import { useOrchestratorMemory } from '../hooks/useOrchestratorMemory'

function DebugPanel() {
  const { getState } = useOrchestratorMemory()
  return <pre>{JSON.stringify(getState(), null, 2)}</pre>
}
```

## 🔄 Migration & Versions

The memory system includes built-in version checking and migration support:

- Current version: **1.0.0**
- Automatic migration when versions change
- Fallback to default state if migration fails

## 🎯 Next Steps

1. **Try it out** - Enable a layer, refresh the page, see it restore
2. **Configure** - Go to Settings and set your preferences
3. **Export** - Back up your configuration
4. **Customize** - See MEMORY_USAGE_EXAMPLES.md for patterns

## 💬 Support

- Check Settings panel for debug information
- Export your memory state for inspection
- Clear memory if something goes wrong
- See documentation files for detailed help

## ✅ Checklist

- [x] Core memory service created
- [x] Integrated with LayerOrchestrator
- [x] React hook for components
- [x] Settings UI panel
- [x] Settings page and route
- [x] Settings button in sidebar
- [x] Export/Import functionality
- [x] User preferences
- [x] Auto-save with debouncing
- [x] localStorage persistence
- [x] Version management
- [x] Complete documentation

## 🎉 You're All Set!

The orchestrator memory system is now fully integrated and ready to use. Users can:
- Have their sessions automatically restored
- Configure exactly what gets saved
- Export and import their configurations
- Manage their data through a friendly UI

Navigate to `/settings` to see it in action!
