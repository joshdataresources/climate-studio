# Orchestrator Memory - Usage Examples

Quick examples showing how to use the orchestrator memory system in your Climate Suite application.

## Basic Setup (Already Done!)

The memory system is **automatically integrated** into your LayerOrchestrator. Every view that uses `useLayerOrchestrator` automatically gets memory persistence.

```tsx
// Example: FactoriesView.tsx
import { useLayerOrchestrator } from '../hooks/useLayerOrchestrator'

function FactoriesView() {
  const { map } = useMap()
  const { getEnabledLayersForView } = useLayer()

  // Memory automatically saves/restores layer states!
  useLayerOrchestrator({
    map,
    viewId: 'factories',
    getEnabledLayers: () => getEnabledLayersForView('factories')
  })

  return <div>Your view content...</div>
}
```

## Accessing Memory in Your Components

### 1. Check User Preferences

```tsx
import { useOrchestratorMemory } from '../hooks/useOrchestratorMemory'

function MyComponent() {
  const { preferences } = useOrchestratorMemory()

  return (
    <div>
      <p>Auto-restore: {preferences.autoRestoreSession ? 'ON' : 'OFF'}</p>
      <p>Remember layers: {preferences.rememberLayerStates ? 'ON' : 'OFF'}</p>
      <p>Remember viewport: {preferences.rememberViewport ? 'ON' : 'OFF'}</p>
    </div>
  )
}
```

### 2. Get Saved Layer Information

```tsx
import { useOrchestratorMemory } from '../hooks/useOrchestratorMemory'

function LayerHistory() {
  const { getSavedLayers } = useOrchestratorMemory()

  const savedLayers = getSavedLayers()

  return (
    <div>
      <h3>Recently Used Layers</h3>
      <ul>
        {savedLayers.map(layer => (
          <li key={layer.id}>
            {layer.id} - {layer.enabled ? 'Enabled' : 'Disabled'}
            {layer.lastViewed && (
              <span> (Last viewed: {new Date(layer.lastViewed).toLocaleString()})</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

### 3. Save and Restore Viewport

```tsx
import { useEffect } from 'react'
import { useMap } from 'react-map-gl'
import { useOrchestratorMemory } from '../hooks/useOrchestratorMemory'

function MapViewport() {
  const { current: map } = useMap()
  const { getSavedViewport, saveViewport, preferences } = useOrchestratorMemory()

  useEffect(() => {
    if (!map || !preferences.rememberViewport) return

    // Restore saved viewport on mount
    const saved = getSavedViewport('my-view')
    if (saved) {
      if (saved.center) map.setCenter(saved.center)
      if (saved.zoom !== undefined) map.setZoom(saved.zoom)
      if (saved.pitch !== undefined) map.setPitch(saved.pitch)
      if (saved.bearing !== undefined) map.setBearing(saved.bearing)
    }

    // Save viewport when user moves the map
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

  return null
}
```

### 4. Export User Data

```tsx
import { useOrchestratorMemory } from '../hooks/useOrchestratorMemory'

function ExportButton() {
  const { exportMemory } = useOrchestratorMemory()

  const handleExport = () => {
    const json = exportMemory()

    // Download as file
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `climate-suite-backup-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button onClick={handleExport}>
      Export My Settings
    </button>
  )
}
```

### 5. Import User Data

```tsx
import { useState } from 'react'
import { useOrchestratorMemory } from '../hooks/useOrchestratorMemory'

function ImportButton() {
  const { importMemory } = useOrchestratorMemory()
  const [error, setError] = useState<string | null>(null)

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const json = e.target?.result as string
        importMemory(json)
        setError(null)
        alert('Settings imported successfully!')
      } catch (err) {
        setError('Failed to import settings')
        console.error(err)
      }
    }
    reader.readAsText(file)
  }

  return (
    <div>
      <input
        type="file"
        accept=".json"
        onChange={handleFileUpload}
      />
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  )
}
```

### 6. Toggle User Preferences

```tsx
import { useOrchestratorMemory } from '../hooks/useOrchestratorMemory'

function PreferencesToggle() {
  const { preferences, updatePreferences } = useOrchestratorMemory()

  return (
    <div>
      <label>
        <input
          type="checkbox"
          checked={preferences.autoRestoreSession ?? true}
          onChange={(e) => updatePreferences({ autoRestoreSession: e.target.checked })}
        />
        Auto-restore my session when I return
      </label>

      <label>
        <input
          type="checkbox"
          checked={preferences.rememberLayerStates ?? true}
          onChange={(e) => updatePreferences({ rememberLayerStates: e.target.checked })}
        />
        Remember which layers I have enabled
      </label>

      <label>
        <input
          type="checkbox"
          checked={preferences.rememberViewport ?? true}
          onChange={(e) => updatePreferences({ rememberViewport: e.target.checked })}
        />
        Remember my map position
      </label>
    </div>
  )
}
```

### 7. Clear All Memory

```tsx
import { useOrchestratorMemory } from '../hooks/useOrchestratorMemory'

function ClearMemoryButton() {
  const { clearMemory } = useOrchestratorMemory()

  const handleClear = () => {
    if (confirm('Are you sure you want to clear all saved data?')) {
      clearMemory()
      alert('All memory cleared!')
    }
  }

  return (
    <button onClick={handleClear} style={{ color: 'red' }}>
      Clear All Saved Data
    </button>
  )
}
```

### 8. Direct Orchestrator Access

If you need more control, access the orchestrator directly:

```tsx
import { getLayerOrchestrator } from '../orchestrators/LayerOrchestrator'

function AdvancedMemoryControl() {
  const orchestrator = getLayerOrchestrator()

  const handleForceSave = () => {
    // Force immediate save (bypasses debouncing)
    orchestrator.forceSaveMemory()
    console.log('Memory saved immediately!')
  }

  const handleGetMemory = () => {
    const memory = orchestrator.getMemory()
    const state = memory.getState()
    console.log('Current memory state:', state)
  }

  return (
    <div>
      <button onClick={handleForceSave}>Force Save Now</button>
      <button onClick={handleGetMemory}>Log Memory State</button>
    </div>
  )
}
```

## Common Patterns

### Pattern 1: "Recently Used Layers" Sidebar

```tsx
function RecentLayersPanel() {
  const { getSavedLayers } = useOrchestratorMemory()
  const { enableLayer } = useLayer()

  const recentLayers = getSavedLayers()
    .sort((a, b) => (b.lastViewed || 0) - (a.lastViewed || 0))
    .slice(0, 5)

  return (
    <div className="recent-layers-panel">
      <h3>Recently Used</h3>
      {recentLayers.map(layer => (
        <button
          key={layer.id}
          onClick={() => enableLayer(layer.id)}
          className={layer.enabled ? 'active' : ''}
        >
          {layer.id}
        </button>
      ))}
    </div>
  )
}
```

### Pattern 2: "Restore Last Session" Prompt

```tsx
import { useEffect, useState } from 'react'
import { useOrchestratorMemory } from '../hooks/useOrchestratorMemory'

function SessionRestorePrompt() {
  const { preferences, lastActiveView, getSavedLayers } = useOrchestratorMemory()
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    // Show prompt if user has saved data and auto-restore is disabled
    if (!preferences.autoRestoreSession && getSavedLayers().length > 0) {
      setShowPrompt(true)
    }
  }, [])

  if (!showPrompt) return null

  return (
    <div className="session-restore-prompt">
      <p>Would you like to restore your last session?</p>
      <p>Last view: {lastActiveView}</p>
      <p>Saved layers: {getSavedLayers().length}</p>
      <button onClick={() => {
        // Enable auto-restore and reload
        updatePreferences({ autoRestoreSession: true })
        window.location.reload()
      }}>
        Restore Session
      </button>
      <button onClick={() => setShowPrompt(false)}>
        Start Fresh
      </button>
    </div>
  )
}
```

### Pattern 3: "Save Workspace" Feature

```tsx
function WorkspaceManager() {
  const { exportMemory, importMemory } = useOrchestratorMemory()
  const [workspaces, setWorkspaces] = useState<Record<string, string>>({})

  const saveWorkspace = (name: string) => {
    const json = exportMemory()
    setWorkspaces(prev => ({
      ...prev,
      [name]: json
    }))
    localStorage.setItem('workspaces', JSON.stringify({
      ...workspaces,
      [name]: json
    }))
  }

  const loadWorkspace = (name: string) => {
    const json = workspaces[name]
    if (json) {
      importMemory(json)
      window.location.reload()
    }
  }

  return (
    <div>
      <h3>My Workspaces</h3>
      <button onClick={() => {
        const name = prompt('Workspace name:')
        if (name) saveWorkspace(name)
      }}>
        Save Current Workspace
      </button>
      <ul>
        {Object.keys(workspaces).map(name => (
          <li key={name}>
            {name}
            <button onClick={() => loadWorkspace(name)}>Load</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

## Testing the Memory System

### Test in Browser Console

```javascript
// Get the memory instance
const { getOrchestratorMemory } = await import('./services/OrchestratorMemory')
const memory = getOrchestratorMemory()

// Check current state
console.log('Current state:', memory.getState())

// Check saved layers
console.log('Saved layers:', memory.getLayerStates())

// Check last view
console.log('Last active view:', memory.getLastActiveView())

// Export current state
console.log('Exported JSON:', memory.export())

// Clear everything
memory.clear()
console.log('Memory cleared!')
```

## Troubleshooting

### Memory Not Persisting?

```tsx
import { useOrchestratorMemory } from '../hooks/useOrchestratorMemory'

function MemoryDebugPanel() {
  const { getState, preferences } = useOrchestratorMemory()
  const state = getState()

  return (
    <div>
      <h3>Memory Debug Info</h3>
      <p>Auto-restore: {preferences.autoRestoreSession ? 'YES' : 'NO'}</p>
      <p>Last updated: {new Date(state.lastUpdated).toLocaleString()}</p>
      <p>Saved layers: {state.layerStates.length}</p>
      <p>Active panels: {state.activePanels.length}</p>
      <p>Version: {state.version}</p>
      <pre>{JSON.stringify(state, null, 2)}</pre>
    </div>
  )
}
```

## Settings Page

Navigate to `/settings` in your app to access the full memory management panel where users can:
- Toggle memory preferences
- View saved state
- Export/import memory
- Clear all saved data
- See debug information

The Settings button is in the left sidebar at the bottom.

---

For complete API documentation, see `ORCHESTRATOR_MEMORY_GUIDE.md`.
