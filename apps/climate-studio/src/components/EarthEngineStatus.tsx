/**
 * EarthEngineStatus.tsx
 * Shows Earth Engine initialization and Render instance status
 * Improved with smarter connection detection and less intrusive notifications
 */

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { Loader2, CheckCircle2, AlertCircle, Zap, Cloud, X } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

interface ServerStatus {
  service: string
  status: 'healthy' | 'initializing' | 'waking' | 'error' | 'offline'
  version?: string
  earthEngineReady?: boolean
  message?: string
  isRender?: boolean
}

// Check if the API is likely proxied through the dev server
const isLocalDev = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

// Use the same backend URL as the layers to ensure consistency
const BACKEND_BASE_URL =
  import.meta.env.VITE_NODE_BACKEND_URL?.replace(/\/$/, '') || 'http://localhost:3001'

export function EarthEngineStatus() {
  const { theme } = useTheme()
  const [status, setStatus] = useState<ServerStatus | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [wakingUpTime, setWakingUpTime] = useState(0)
  const mountedRef = useRef(true)
  const hasConnectedOnce = useRef(false)
  const retryCountRef = useRef(0)

  const checkStatus = useCallback(async () => {
    const maxRetries = 15
    const wakeUpStartTime = Date.now()
    
    try {
      // Shorter initial timeout, we'll retry anyway
      const timeout = retryCountRef.current < 2 ? 8000 : 5000
      // Use BACKEND_BASE_URL to match the same backend the layers use
      const response = await fetch(`${BACKEND_BASE_URL}/api/climate/status`, {
        signal: AbortSignal.timeout(timeout),
        headers: { 'Accept': 'application/json' }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      
      if (!mountedRef.current) return

      // Successfully connected!
      hasConnectedOnce.current = true
      retryCountRef.current = 0
      
      // Check Earth Engine status
      const eeStatus = data.earthEngine;
      const eeReady = eeStatus?.ready ?? data.earthEngineReady ?? true;
      const eePartial = eeStatus?.partial ?? false;
      
      let statusMessage = data.message || 'All systems operational';
      if (!eeReady && eePartial) {
        statusMessage = 'Earth Engine partially initialized - some layers may not work';
      } else if (!eeReady) {
        statusMessage = 'Earth Engine not initialized - check server configuration';
      }
      
      setStatus({
        service: data.service || 'climate-data-server',
        status: 'healthy',
        version: data.version,
        earthEngineReady: eeReady,
        message: statusMessage,
        isRender: data.isRender || false
      })
      
      // Show success briefly then auto-hide
      setIsVisible(true)
      setTimeout(() => {
        if (mountedRef.current) setIsVisible(false)
      }, 3000)
      
    } catch (err) {
      if (!mountedRef.current) return
      
      retryCountRef.current++
      
      // If we've successfully connected before, don't show error immediately
      // The server might just be temporarily busy
      if (hasConnectedOnce.current && retryCountRef.current < 3) {
        // Silent retry for established connections
        setTimeout(checkStatus, 5000)
        return
      }
      
      // Still have retries left - show waking/initializing status
      if (retryCountRef.current < maxRetries) {
        const elapsedSeconds = Math.floor((Date.now() - wakeUpStartTime) / 1000) + (retryCountRef.current * 5)
        setWakingUpTime(elapsedSeconds)
        
        const isLikelyRender = retryCountRef.current >= 2
        
        setStatus({
          service: 'climate-data-server',
          status: isLikelyRender ? 'waking' : 'initializing',
          message: isLikelyRender
            ? `Waking up server... ${elapsedSeconds}s`
            : `Connecting... (attempt ${retryCountRef.current}/${maxRetries})`,
          isRender: isLikelyRender
        })
        
        // Only show the notification if we're actively trying to wake up
        if (retryCountRef.current >= 2) {
          setIsVisible(true)
        }
        
        // Progressive backoff: 2s, 3s, 5s, then 5s...
        const retryDelay = retryCountRef.current <= 2 ? 2000 : retryCountRef.current <= 4 ? 3000 : 5000
        setTimeout(checkStatus, retryDelay)
        
      } else {
        // All retries exhausted - but only show error if we've never connected
        // If we connected before, mark as "offline" (less alarming than "error")
        setStatus({
          service: 'climate-data-server',
          status: hasConnectedOnce.current ? 'offline' : 'error',
          message: hasConnectedOnce.current 
            ? 'Server connection lost. Retrying in background...'
            : isLocalDev 
              ? 'Backend not running. Start with: npm run dev:backend'
              : 'Server not responding. Please try again later.'
        })
        setIsVisible(true)
        
        // For offline status, continue retrying in background with longer intervals
        if (hasConnectedOnce.current) {
          retryCountRef.current = 0 // Reset for background retries
          setTimeout(checkStatus, 30000) // Check every 30s
        }
      }
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    
    // Initial check with small delay to let the app render first
    const initialDelay = setTimeout(checkStatus, 500)
    
    // Periodic health check every 60 seconds (only if healthy)
    const healthCheckInterval = setInterval(() => {
      if (mountedRef.current && status?.status === 'healthy') {
        // Silent background check - use BACKEND_BASE_URL to match layers
        fetch(`${BACKEND_BASE_URL}/api/climate/status`, { signal: AbortSignal.timeout(5000) })
          .then(res => {
            if (!res.ok) throw new Error('Health check failed')
          })
          .catch(() => {
            // Connection lost, start retry process
            retryCountRef.current = 0
            checkStatus()
          })
      }
    }, 60000)

    return () => {
      mountedRef.current = false
      clearTimeout(initialDelay)
      clearInterval(healthCheckInterval)
    }
  }, [checkStatus, status?.status])

  // Don't render if not visible
  if (!isVisible || !status) {
    return null
  }

  const getStatusIcon = () => {
    switch (status.status) {
      case 'healthy':
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />
      case 'waking':
        return <Cloud className="h-4 w-4 animate-pulse text-violet-400" />
      case 'initializing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
      case 'offline':
        return <AlertCircle className="h-4 w-4 text-amber-400" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-400" />
      default:
        return <Loader2 className="h-4 w-4 animate-spin" />
    }
  }

  const getStatusStyles = () => {
    switch (status.status) {
      case 'healthy':
        return 'border-emerald-500/40 bg-emerald-500/10'
      case 'waking':
        return 'border-violet-500/40 bg-violet-500/10'
      case 'initializing':
        return 'border-blue-500/40 bg-blue-500/10'
      case 'offline':
        return 'border-amber-500/40 bg-amber-500/10'
      case 'error':
        return 'border-red-500/40 bg-red-500/10'
      default:
        return 'border-gray-500/40 bg-gray-500/10'
    }
  }

  const getStatusText = () => {
    switch (status.status) {
      case 'healthy':
        return 'Connected'
      case 'waking':
        return 'Starting Server...'
      case 'initializing':
        return 'Connecting...'
      case 'offline':
        return 'Server Offline'
      case 'error':
        return 'Connection Failed'
      default:
        return 'Checking...'
    }
  }

  return (
    <div 
      className={`
        fixed bottom-4 left-1/2 -translate-x-1/2 z-50
        transition-all duration-300 ease-out
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}
      `}
    >
      <div
        className={`
          ${getStatusStyles()}
          border rounded-xl shadow-xl backdrop-blur-md
          px-4 py-2.5 flex items-center gap-3
        `}
      >
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          {status.status === 'healthy' && (
            <Zap className="h-4 w-4 text-amber-400" />
          )}
        </div>

        <div className="flex flex-col">
          <span className={`text-sm font-medium ${
            theme === 'light' ? 'text-black/80' : 'text-white'
          }`}>
            {getStatusText()}
          </span>
          {status.message && (
            <span className={`text-xs max-w-[280px] truncate ${
              theme === 'light' ? 'text-black/60' : 'text-white/60'
            }`}>
              {status.message}
            </span>
          )}
        </div>

        {status.version && (
          <span className={`text-[10px] ml-1 font-mono ${
            theme === 'light' ? 'text-black/40' : 'text-white/40'
          }`}>
            v{status.version}
          </span>
        )}

        <button
          onClick={() => setIsVisible(false)}
          className={`ml-1 p-1 rounded-md transition-colors ${
            theme === 'light' 
              ? 'hover:bg-black/10 text-black/60 hover:text-black/80' 
              : 'hover:bg-white/10 text-white/50 hover:text-white/80'
          }`}
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
