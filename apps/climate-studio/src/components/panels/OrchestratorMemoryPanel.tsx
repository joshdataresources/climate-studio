/**
 * Orchestrator Memory Panel
 *
 * Allows users to view and manage orchestrator memory settings
 * and persistent state across sessions.
 */

import React, { useState } from 'react'
import { useOrchestratorMemory } from '../../hooks/useOrchestratorMemory'

export const OrchestratorMemoryPanel: React.FC = () => {
  const {
    preferences,
    lastActiveView,
    updatePreferences,
    getSavedLayers,
    clearMemory,
    exportMemory,
    importMemory,
    getState
  } = useOrchestratorMemory()

  const [showDebug, setShowDebug] = useState(false)
  const [importText, setImportText] = useState('')
  const [showImport, setShowImport] = useState(false)

  const savedLayers = getSavedLayers()
  const debugState = getState()

  const handleExport = () => {
    const json = exportMemory()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `orchestrator-memory-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    try {
      importMemory(importText)
      setShowImport(false)
      setImportText('')
      alert('Memory imported successfully!')
    } catch (error) {
      alert(`Failed to import: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleClear = () => {
    if (confirm('Are you sure you want to clear all saved memory? This cannot be undone.')) {
      clearMemory()
      alert('Memory cleared!')
    }
  }

  return (
    <div className="p-4 space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-2">Orchestrator Memory</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Manage persistent state and preferences across sessions
        </p>
      </div>

      {/* Preferences Section */}
      <div className="space-y-3">
        <h3 className="font-semibold text-lg">Preferences</h3>

        <label className="flex items-center space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={preferences.autoRestoreSession ?? true}
            onChange={(e) => updatePreferences({ autoRestoreSession: e.target.checked })}
            className="w-4 h-4"
          />
          <div>
            <div className="font-medium">Auto-restore session</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Restore your last session when you return
            </div>
          </div>
        </label>

        <label className="flex items-center space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={preferences.rememberLayerStates ?? true}
            onChange={(e) => updatePreferences({ rememberLayerStates: e.target.checked })}
            className="w-4 h-4"
          />
          <div>
            <div className="font-medium">Remember layer states</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Save which layers you have enabled
            </div>
          </div>
        </label>

        <label className="flex items-center space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={preferences.rememberViewport ?? true}
            onChange={(e) => updatePreferences({ rememberViewport: e.target.checked })}
            className="w-4 h-4"
          />
          <div>
            <div className="font-medium">Remember viewport</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Save your map position and zoom level
            </div>
          </div>
        </label>
      </div>

      {/* Saved State Info */}
      <div className="space-y-2">
        <h3 className="font-semibold text-lg">Saved State</h3>

        <div className="text-sm space-y-1">
          <div>
            <span className="font-medium">Last Active View:</span>{' '}
            {lastActiveView || 'None'}
          </div>
          <div>
            <span className="font-medium">Saved Layers:</span>{' '}
            {savedLayers.length} layers
          </div>
          {savedLayers.length > 0 && (
            <div className="mt-2 space-y-1">
              {savedLayers.slice(0, 5).map(layer => (
                <div key={layer.id} className="text-xs text-gray-600 dark:text-gray-400 ml-4">
                  • {layer.id} {layer.enabled ? '(enabled)' : '(disabled)'}
                </div>
              ))}
              {savedLayers.length > 5 && (
                <div className="text-xs text-gray-600 dark:text-gray-400 ml-4">
                  ...and {savedLayers.length - 5} more
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <h3 className="font-semibold text-lg">Actions</h3>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          >
            Export Memory
          </button>

          <button
            onClick={() => setShowImport(!showImport)}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
          >
            {showImport ? 'Cancel Import' : 'Import Memory'}
          </button>

          <button
            onClick={handleClear}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
          >
            Clear Memory
          </button>

          <button
            onClick={() => setShowDebug(!showDebug)}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
          >
            {showDebug ? 'Hide' : 'Show'} Debug Info
          </button>
        </div>

        {showImport && (
          <div className="mt-3 space-y-2">
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Paste exported JSON here..."
              className="w-full h-32 p-2 border rounded font-mono text-xs"
            />
            <button
              onClick={handleImport}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
            >
              Import
            </button>
          </div>
        )}
      </div>

      {/* Debug Info */}
      {showDebug && (
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">Debug Information</h3>
          <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-auto max-h-96">
            {JSON.stringify(debugState, null, 2)}
          </pre>
        </div>
      )}

      {/* Footer */}
      <div className="text-xs text-gray-500 dark:text-gray-500 pt-4 border-t">
        Memory is stored in your browser's localStorage and persists between sessions.
        Last updated: {new Date(debugState.lastUpdated).toLocaleString()}
      </div>
    </div>
  )
}
