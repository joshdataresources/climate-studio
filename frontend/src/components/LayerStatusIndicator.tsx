/**
 * Visual indicator for layer loading status and data source
 */

import React from 'react';
import { useLayerStatus, useLayerFallbackStatus } from '../hooks/useLayerStatus';
import { ClimateLayerId } from '../config/climateLayers';

interface LayerStatusIndicatorProps {
  layerId: ClimateLayerId;
  showDetails?: boolean;
}

export function LayerStatusIndicator({ layerId, showDetails = false }: LayerStatusIndicatorProps) {
  const status = useLayerStatus(layerId);
  const hasFallback = useLayerFallbackStatus(layerId);

  if (!status) {
    return null;
  }

  const getStatusIcon = () => {
    switch (status.status) {
      case 'loading':
        return '⏳';
      case 'success':
        return status.dataSource === 'real' ? '✅' : '⚠️';
      case 'error':
        return '❌';
      case 'fallback':
        return '⚠️';
      default:
        return '❓';
    }
  };

  const getStatusColor = () => {
    switch (status.status) {
      case 'loading':
        return 'text-blue-500';
      case 'success':
        return status.dataSource === 'real' ? 'text-green-500' : 'text-yellow-500';
      case 'error':
        return 'text-red-500';
      case 'fallback':
        return 'text-yellow-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusText = () => {
    if (status.status === 'loading') {
      return 'Loading...';
    }
    if (status.status === 'error') {
      return `Error: ${status.metadata?.errorMessage || 'Unknown error'}`;
    }
    if (status.dataSource === 'real') {
      return `Real NASA data (${status.metadata?.featureCount || 0} features)`;
    }
    if (status.dataSource === 'fallback') {
      return `Fallback data (${status.metadata?.fallbackReason || 'real data unavailable'})`;
    }
    return 'Unknown status';
  };

  return (
    <div className={`flex items-center gap-2 text-sm ${getStatusColor()}`}>
      <span className="text-lg">{getStatusIcon()}</span>
      {showDetails && (
        <div className="flex flex-col">
          <span className="font-medium">{getStatusText()}</span>
          {status.metadata?.source && (
            <span className="text-xs opacity-75">{status.metadata.source}</span>
          )}
          {hasFallback && (
            <span className="text-xs text-yellow-600 font-semibold">
              ⚠️ Using simulated data
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Debug panel showing all layer statuses
 */
export function LayerStatusDebugPanel() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [events, setEvents] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (isOpen) {
      const unsubscribe = (window as any).layerStatusMonitor?.subscribe((event: any) => {
        setEvents(prev => [event, ...prev].slice(0, 50)); // Keep last 50 events
      });
      return unsubscribe;
    }
  }, [isOpen]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-gray-700 transition-colors z-50"
      >
        🔍 Layer Status Monitor
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 text-white rounded-lg shadow-2xl w-96 max-h-96 overflow-hidden z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h3 className="font-bold">Layer Status Monitor</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="overflow-y-auto flex-1 p-4 space-y-2">
        {events.length === 0 ? (
          <p className="text-gray-400 text-sm">No events yet...</p>
        ) : (
          events.map((event, idx) => (
            <div key={idx} className="bg-gray-800 p-2 rounded text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-blue-400">{event.layerId}</span>
                <span className="text-gray-500">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`
                  ${event.status === 'success' ? 'text-green-400' : ''}
                  ${event.status === 'error' ? 'text-red-400' : ''}
                  ${event.status === 'loading' ? 'text-blue-400' : ''}
                  ${event.status === 'fallback' ? 'text-yellow-400' : ''}
                `}>
                  {event.status}
                </span>
                <span className="text-gray-400">•</span>
                <span className={`
                  ${event.dataSource === 'real' ? 'text-green-400' : ''}
                  ${event.dataSource === 'fallback' ? 'text-yellow-400' : ''}
                  ${event.dataSource === 'unknown' ? 'text-gray-400' : ''}
                `}>
                  {event.dataSource}
                </span>
              </div>
              {event.metadata?.source && (
                <div className="text-gray-500 mt-1 truncate">
                  {event.metadata.source}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
