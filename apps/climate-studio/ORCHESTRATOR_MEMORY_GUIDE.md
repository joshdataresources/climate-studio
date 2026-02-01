# Orchestrator Memory System Guide

The Orchestrator Memory System provides persistent storage for your Climate Suite application state across browser sessions. This guide explains how to use and configure the memory system.

## Features

- **Persistent Layer States**: Automatically saves which layers are enabled and their settings
- **Viewport Memory**: Remembers your map position, zoom level, pitch, and bearing for each view
- **Panel States**: Saves which panels are open and their configurations
- **User Preferences**: Stores your preferences for auto-restore and other settings
- **Import/Export**: Backup and restore your entire session state
- **Cross-Session Persistence**: All data is stored in localStorage and survives browser restarts

## Quick Start

### 1. Basic Usage (Already Integrated)

The memory system is **automatically integrated** into the `LayerOrchestrator`. No additional setup is required in your views.

```tsx
// In your view component (e.g., FactoriesView.tsx)
import { useLayerOrchestrator } from '../hooks/useLayerOrchestrator'

function MyView() {
  const { map } = useMap()
  const { getEnabledLayersForView } = useLayer()

  // Memory is automatically handled by the orchestrator
  useLayerOrchestrator({
    map,
    viewId: 'my-view',
    getEnabledLayers: () => getEnabledLayersForView('my-view')
  })

  return <div>...</div>
}
```

### 2. Using Memory in React Components

Use the `useOrchestratorMemory` hook to access memory features:

```tsx
import { useOrchestratorMemory } from '../hooks/useOrchestratorMemory'

function MyComponent() {
  const {
    preferences,
    lastActiveView,
    updatePreferences,
    getSavedLayers,
    clearMemory
  } = useOrchestratorMemory()

  return (
    <div>
      <p>Last view: {lastActiveView}</p>
      <p>Saved layers: {getSavedLayers().length}</p>

      <button onClick={() => updatePreferences({ autoRestoreSession: false })}>
        Disable Auto-restore
      </button>
    </div>
  )
}
```

### 3. Memory Settings Panel

Add the `OrchestratorMemoryPanel` component to let users manage their memory settings:

```tsx
import { OrchestratorMemoryPanel } from './components/panels/OrchestratorMemoryPanel'

function SettingsPage() {
  return (
    <div>
      <h1>Settings</h1>
      <OrchestratorMemoryPanel />
    </div>
  )
}
```

## Memory API Reference

### OrchestratorMemory Class

The core memory service that handles all persistent storage.

#### Layer State Methods

```typescript
// Save layer states
memory.saveLayerStates(layerStatesMap)

// Get saved layer states
const layers = memory.getLayerStates()
// Returns: Array<{ id: string; enabled: boolean; lastViewed?: number }>

// Update single layer
memory.updateLayerState('layer-id', true, 0.8)

// Remove layer state
memory.removeLayerState('layer-id')
```

#### View Management

```typescript
// Save current view
memory.saveCurrentView('factories')

// Get last active view
const lastView = memory.getLastActiveView()

// Save viewport preferences
memory.saveViewPreferences('factories', {
  zoom: 12,
  center: [-122.4, 37.8],
  pitch: 45,
  bearing: 0
})

// Get viewport preferences
const viewport = memory.getViewPreferences('factories')
```

#### Panel Management

```typescript
// Save active panels
memory.saveActivePanels(['layer-controls', 'climate-projections'])

// Get active panels
const panels = memory.getActivePanels()

// Save panel preferences
memory.savePanelPreferences('layer-controls', {
  collapsed: false,
  width: 300
})

// Get panel preferences
const prefs = memory.getPanelPreferences('layer-controls')
```

#### User Preferences

```typescript
// Update preferences
memory.updatePreferences({
  autoRestoreSession: true,
  rememberLayerStates: true,
  rememberViewport: true
})

// Get preferences
const prefs = memory.getPreferences()
```

#### Utility Methods

```typescript
// Clear all memory
memory.clear()

// Export as JSON
const json = memory.export()

// Import from JSON
memory.import(jsonString)

// Get full state (for debugging)
const state = memory.getState()

// Force immediate save (bypasses debouncing)
memory.forceSave()

// Enable/disable auto-save
memory.setAutoSave(false)
```

### LayerOrchestrator Memory Methods

The orchestrator provides convenient methods to access memory features:

```typescript
const orchestrator = getLayerOrchestrator()

// Get memory instance
const memory = orchestrator.getMemory()

// Get saved layer states
const savedLayers = orchestrator.getSavedLayerStates()

// Get last active view
const lastView = orchestrator.getLastActiveView()

// Save viewport
orchestrator.saveViewport('my-view', {
  zoom: 10,
  center: [-122.4, 37.8]
})

// Get saved viewport
const viewport = orchestrator.getSavedViewport('my-view')

// Update memory preferences
orchestrator.updateMemoryPreferences({
  autoRestoreSession: true
})

// Get memory preferences
const prefs = orchestrator.getMemoryPreferences()

// Clear all memory
orchestrator.clearMemory()

// Export/Import
const json = orchestrator.exportMemory()
orchestrator.importMemory(json)

// Force save
orchestrator.forceSaveMemory()
```

### useOrchestratorMemory Hook

React hook for accessing memory in components:

```typescript
const {
  // State
  preferences,           // Current preferences
  lastActiveView,        // Last active view ID

  // Actions
  updatePreferences,     // Update preferences
  getSavedLayers,        // Get saved layer states
  getSavedViewport,      // Get saved viewport for a view
  saveViewport,          // Save viewport for a view
  clearMemory,           // Clear all memory
  exportMemory,          // Export as JSON string
  importMemory,          // Import from JSON string
  getState,              // Get full state for debugging
  refreshPreferences     // Refresh state from storage
} = useOrchestratorMemory()
```

## Configuration

### User Preferences

Users can configure three main preferences:

1. **Auto-restore Session** (default: `true`)
   - When enabled, automatically restores the last session on app load
   - Includes layer states, viewport, and panel configurations

2. **Remember Layer States** (default: `true`)
   - Saves which layers are enabled and their opacity settings
   - Restores them when returning to a view

3. **Remember Viewport** (default: `true`)
   - Saves map position, zoom, pitch, and bearing for each view
   - Restores the exact viewport when switching back to a view

### Storage Location

All memory data is stored in browser `localStorage` with the key:
```
climate-suite-orchestrator-memory
```

### Data Structure

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

## Advanced Usage

### Custom Auto-Save Control

```typescript
const memory = getOrchestratorMemory()

// Disable auto-save for batch operations
memory.setAutoSave(false)

// Make multiple changes
memory.updateLayerState('layer-1', true)
memory.updateLayerState('layer-2', true)
memory.updateLayerState('layer-3', true)

// Force save once
memory.forceSave()

// Re-enable auto-save
memory.setAutoSave(true)
```

### Viewport Restoration

```typescript
import { useMap } from 'react-map-gl'
import { useOrchestratorMemory } from '../hooks/useOrchestratorMemory'

function MyView() {
  const { current: map } = useMap()
  const { getSavedViewport, saveViewport, preferences } = useOrchestratorMemory()

  useEffect(() => {
    if (!map || !preferences.rememberViewport) return

    // Restore viewport on mount
    const saved = getSavedViewport('my-view')
    if (saved) {
      if (saved.center) map.setCenter(saved.center)
      if (saved.zoom !== undefined) map.setZoom(saved.zoom)
      if (saved.pitch !== undefined) map.setPitch(saved.pitch)
      if (saved.bearing !== undefined) map.setBearing(saved.bearing)
    }

    // Save viewport on move end
    const handleMoveEnd = () => {
      saveViewport('my-view', {
        zoom: map.getZoom(),
        center: map.getCenter().toArray() as [number, number],
        pitch: map.getPitch(),
        bearing: map.getBearing()
      })
    }

    map.on('moveend', handleMoveEnd)
    return () => { map.off('moveend', handleMoveEnd) }
  }, [map, preferences.rememberViewport])
}
```

### Export/Import for Backup

```typescript
// Export current state to file
function exportMemoryToFile() {
  const memory = getOrchestratorMemory()
  const json = memory.export()

  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `climate-suite-backup-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// Import from file
function importMemoryFromFile(file: File) {
  const reader = new FileReader()
  reader.onload = (e) => {
    const json = e.target?.result as string
    const memory = getOrchestratorMemory()
    memory.import(json)
  }
  reader.readAsText(file)
}
```

### Debug and Monitoring

```typescript
// Log current memory state
const memory = getOrchestratorMemory()
console.log('Current memory state:', memory.getState())

// Check memory size (rough estimate)
const json = memory.export()
const sizeInBytes = new Blob([json]).size
console.log(`Memory size: ${(sizeInBytes / 1024).toFixed(2)} KB`)

// Monitor changes
const originalSave = memory.forceSave.bind(memory)
memory.forceSave = () => {
  console.log('Memory saved:', new Date().toISOString())
  originalSave()
}
```

## Best Practices

1. **Let the Orchestrator Handle It**: The memory system is automatically integrated. Don't manually save layer states unless you have a specific reason.

2. **Use Preferences**: Respect user preferences for auto-restore and memory features.

3. **Export Before Clearing**: Always export memory before clearing it in production.

4. **Version Migrations**: The memory system includes version checking. Future versions can add migration logic in the `migrateState` method.

5. **Debouncing**: Memory saves are debounced (500ms). Use `forceSave()` only when immediate persistence is required.

6. **localStorage Limits**: Browser localStorage typically has a 5-10MB limit. The memory system is designed to be lightweight, but be mindful of this when storing large amounts of data.

## Troubleshooting

### Memory Not Persisting

1. Check if `autoRestoreSession` preference is enabled
2. Verify localStorage is not disabled in browser settings
3. Check browser console for errors
4. Try clearing memory and re-saving: `orchestrator.clearMemory()`

### Memory Not Restoring on Load

1. Check the `lastUpdated` timestamp in debug info
2. Verify the version matches (should be "1.0.0")
3. Check if preferences allow restoration
4. Import a fresh backup if data is corrupted

### Large Memory Size

1. Export memory and inspect the JSON
2. Look for unexpectedly large data structures
3. Clear old/unused layer states
4. Consider implementing a cleanup strategy for old data

## Examples

See the `OrchestratorMemoryPanel` component for a complete example of:
- Displaying memory state
- Managing preferences
- Export/import functionality
- Debug information display

## Migration Guide

If you're upgrading from a version without memory:

1. The memory system is automatically enabled
2. No migration needed - it starts fresh
3. Users can import old state if needed
4. Preferences default to enabled

## API Summary

| Method | Description |
|--------|-------------|
| `getOrchestratorMemory()` | Get singleton memory instance |
| `memory.saveLayerStates()` | Save layer states |
| `memory.getLayerStates()` | Get saved layers |
| `memory.saveCurrentView()` | Save active view |
| `memory.getLastActiveView()` | Get last view |
| `memory.saveViewPreferences()` | Save viewport |
| `memory.getViewPreferences()` | Get viewport |
| `memory.updatePreferences()` | Update user prefs |
| `memory.clear()` | Clear all memory |
| `memory.export()` | Export as JSON |
| `memory.import()` | Import from JSON |
| `useOrchestratorMemory()` | React hook for memory |

## Support

For issues or questions:
1. Check the debug information in `OrchestratorMemoryPanel`
2. Export your memory state for debugging
3. Check browser console for error messages
4. Clear memory and try again if corrupted
