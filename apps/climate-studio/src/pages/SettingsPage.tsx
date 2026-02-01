/**
 * Settings Page
 *
 * Provides user settings and preferences management,
 * including orchestrator memory configuration.
 */

import React from 'react'
import { OrchestratorMemoryPanel } from '../components/panels/OrchestratorMemoryPanel'
import { useTheme } from '../contexts/ThemeContext'

export const SettingsPage: React.FC = () => {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div
      className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}
      style={{ paddingLeft: '76px' }} // Account for sidebar width
    >
      <div className="max-w-4xl mx-auto py-8 px-6">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Settings
          </h1>
          <p className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Manage your Climate Suite preferences and application settings
          </p>
        </div>

        {/* Settings Sections */}
        <div className="space-y-6">
          {/* Memory Settings Card */}
          <div
            className={`rounded-lg shadow-lg overflow-hidden ${
              isDark ? 'bg-gray-800' : 'bg-white'
            }`}
          >
            <OrchestratorMemoryPanel />
          </div>

          {/* Additional Settings Sections can be added here */}
          {/*
          <div className={`rounded-lg shadow-lg p-6 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Display Settings
            </h2>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Coming soon...
            </p>
          </div>
          */}
        </div>

        {/* Footer Info */}
        <div className={`mt-8 text-center text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          Climate Suite v1.0.0
        </div>
      </div>
    </div>
  )
}
