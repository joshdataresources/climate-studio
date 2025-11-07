/**
 * EarthEngineStatus.tsx
 * Shows Earth Engine initialization and Render instance status
 */

import React, { useEffect, useState } from 'react'
import { Loader2, CheckCircle2, AlertCircle, Zap, Cloud } from 'lucide-react'

interface ServerStatus {
  service: string
  status: 'healthy' | 'initializing' | 'waking' | 'error'
  version?: string
  earthEngineReady?: boolean
  message?: string
  isRender?: boolean
}

export function EarthEngineStatus() {
  const [status, setStatus] = useState<ServerStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isVisible, setIsVisible] = useState(true)
  const [wakingUpTime, setWakingUpTime] = useState(0)

  useEffect(() => {
    let mounted = true
    let retryCount = 0
    const maxRetries = 20 // More retries for Render wake-up (up to ~2 minutes)
    let wakeUpStartTime: number | null = null

    const checkStatus = async () => {
      try {
        const startTime = Date.now()
        const response = await fetch('/api/climate/status', {
          signal: AbortSignal.timeout(15000) // 15 second timeout for Render
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = await response.json()
        const responseTime = Date.now() - startTime

        if (mounted) {
          // Detect if this is Render (slow initial response or specific headers)
          const isRenderInstance = responseTime > 3000 || wakeUpStartTime !== null

          setStatus({
            service: data.service || 'climate-data-server',
            status: 'healthy',
            version: data.version,
            earthEngineReady: true,
            message: data.message || (isRenderInstance ? 'Render instance active' : 'All systems operational'),
            isRender: isRenderInstance
          })
          setIsLoading(false)
          setError(null)

          // Auto-hide after 5 seconds when healthy
          setTimeout(() => {
            if (mounted) setIsVisible(false)
          }, 5000)
        }
      } catch (err) {
        if (mounted) {
          if (retryCount < maxRetries) {
            retryCount++

            // Start tracking wake-up time on first failure
            if (wakeUpStartTime === null) {
              wakeUpStartTime = Date.now()
            }

            const elapsedSeconds = Math.floor((Date.now() - wakeUpStartTime) / 1000)
            setWakingUpTime(elapsedSeconds)

            // Detect if this looks like a Render cold start (assume Render if first retry fails)
            const isLikelyRender = retryCount >= 1

            setStatus({
              service: 'climate-data-server',
              status: isLikelyRender ? 'waking' : 'initializing',
              message: isLikelyRender
                ? `Waking up Render instance... ${elapsedSeconds}s (this can take up to 60s)`
                : `Connecting... (attempt ${retryCount}/${maxRetries})`,
              isRender: isLikelyRender
            })

            // Progressive backoff: 3s, 5s, 7s, then 7s...
            const retryDelay = retryCount === 1 ? 3000 : retryCount === 2 ? 5000 : 7000
            setTimeout(checkStatus, retryDelay)
          } else {
            setStatus({
              service: 'climate-data-server',
              status: 'error',
              message: 'Server not responding. Please check if backend is running.'
            })
            setError(err instanceof Error ? err.message : 'Connection failed')
            setIsLoading(false)
          }
        }
      }
    }

    checkStatus()

    return () => {
      mounted = false
    }
  }, [])

  // Don't render if hidden and healthy
  if (!isVisible && status?.status === 'healthy') {
    return null
  }

  // Don't render anything if no status yet and still loading
  if (isLoading && !status) {
    return null
  }

  const getStatusIcon = () => {
    if (!status) return <Loader2 className="h-4 w-4 animate-spin" />

    switch (status.status) {
      case 'healthy':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'waking':
        return <Cloud className="h-4 w-4 animate-pulse text-purple-500" />
      case 'initializing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Loader2 className="h-4 w-4 animate-spin" />
    }
  }

  const getStatusColor = () => {
    if (!status) return 'bg-gray-800/95 border-gray-700'

    switch (status.status) {
      case 'healthy':
        return 'bg-gray-800/95 border-green-500/50'
      case 'waking':
        return 'bg-gray-800/95 border-purple-500/50'
      case 'initializing':
        return 'bg-gray-800/95 border-blue-500/50'
      case 'error':
        return 'bg-gray-800/95 border-red-500/50'
      default:
        return 'bg-gray-800/95 border-gray-700'
    }
  }

  const getStatusText = () => {
    if (!status) return 'Checking server...'

    switch (status.status) {
      case 'healthy':
        return status.isRender ? 'Render Instance Ready' : 'Earth Engine Ready'
      case 'waking':
        return 'Waking Render Instance...'
      case 'initializing':
        return 'Connecting to Server...'
      case 'error':
        return 'Server Unavailable'
      default:
        return 'Checking status...'
    }
  }

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
      <div
        className={`
          ${getStatusColor()}
          border rounded-lg shadow-lg px-4 py-2
          flex items-center gap-3
          transition-all duration-300
          ${!isVisible ? 'opacity-0 translate-y-[10px]' : 'opacity-100 translate-y-0'}
          pointer-events-auto
        `}
      >
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <Zap className="h-4 w-4 text-yellow-500" />
        </div>

        <div className="flex flex-col">
          <span className="text-sm font-medium text-white">
            {getStatusText()}
          </span>
          {status?.message && (
            <span className="text-xs text-gray-400">
              {status.message}
            </span>
          )}
        </div>

        {status?.version && (
          <span className="text-xs text-gray-500 ml-2">
            v{status.version}
          </span>
        )}

        {status?.status === 'healthy' && (
          <button
            onClick={() => setIsVisible(false)}
            className="ml-2 text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="Dismiss"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}
