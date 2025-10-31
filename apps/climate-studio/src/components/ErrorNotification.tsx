"use client"

import { useEffect, useState } from "react"
import { X, AlertCircle } from "lucide-react"

export interface ErrorNotificationProps {
  layerName: string
  error: string
  onDismiss: () => void
  autoHideDuration?: number
}

export function ErrorNotification({
  layerName,
  error,
  onDismiss,
  autoHideDuration = 10000
}: ErrorNotificationProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    if (autoHideDuration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        onDismiss()
      }, autoHideDuration)
      return () => clearTimeout(timer)
    }
  }, [autoHideDuration, onDismiss])

  if (!isVisible) return null

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md animate-in slide-in-from-top-2 duration-300">
      <div className="bg-red-900/95 backdrop-blur-sm border border-red-700 rounded-lg shadow-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-red-100 mb-1">
              {layerName} - Data Load Failed
            </h3>
            <p className="text-sm text-red-200/90 break-words">
              {error}
            </p>
            {error.includes('too large') || error.includes('zoom in') ? (
              <p className="text-xs text-yellow-300/90 mt-2 font-medium">
                💡 Zoom in closer to view this layer's data
              </p>
            ) : (
              <p className="text-xs text-red-300/70 mt-2">
                Please check your connection or try again later. No simulated data will be shown.
              </p>
            )}
          </div>
          <button
            onClick={() => {
              setIsVisible(false)
              onDismiss()
            }}
            className="flex-shrink-0 text-red-400 hover:text-red-200 transition-colors"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// Container component to manage multiple error notifications
export interface ErrorNotificationManagerProps {
  errors: Array<{
    id: string
    layerName: string
    error: string
  }>
  onDismiss: (id: string) => void
}

export function ErrorNotificationManager({
  errors,
  onDismiss
}: ErrorNotificationManagerProps) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {errors.map((error, index) => (
        <div
          key={error.id}
          style={{
            animationDelay: `${index * 100}ms`
          }}
        >
          <ErrorNotification
            layerName={error.layerName}
            error={error.error}
            onDismiss={() => onDismiss(error.id)}
            autoHideDuration={10000}
          />
        </div>
      ))}
    </div>
  )
}
