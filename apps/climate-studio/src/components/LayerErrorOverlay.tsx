/**
 * Central error overlay for layer loading failures
 */

import React from 'react';
import { useLayerStatus } from '../hooks/useLayerStatus';
import { ClimateLayerId } from "@climate-studio/core/config";
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { Button } from './ui/button';

interface LayerErrorOverlayProps {
  activeLayerIds: ClimateLayerId[];
  onRefresh?: (layerId: ClimateLayerId) => void;
  onDismiss?: (layerId: ClimateLayerId) => void;
}

export function LayerErrorOverlay({ activeLayerIds, onRefresh, onDismiss }: LayerErrorOverlayProps) {
  const [dismissedErrors, setDismissedErrors] = React.useState<Set<ClimateLayerId>>(new Set());

  // Get status for each active layer (must be called unconditionally)
  const precipitationDroughtStatus = useLayerStatus('precipitation_drought');
  const temperatureProjectionStatus = useLayerStatus('temperature_projection');
  const seaLevelRiseStatus = useLayerStatus('sea_level_rise');
  const urbanHeatIslandStatus = useLayerStatus('urban_heat_island');
  const topographicReliefStatus = useLayerStatus('topographic_relief');

  // Build layer statuses array based on active layers
  const statusMap: Record<ClimateLayerId, any> = {
    'precipitation_drought': precipitationDroughtStatus,
    'temperature_projection': temperatureProjectionStatus,
    'sea_level_rise': seaLevelRiseStatus,
    'urban_heat_island': urbanHeatIslandStatus,
    'topographic_relief': topographicReliefStatus,
  };

  const layerStatuses = activeLayerIds
    .map(id => ({
      id,
      status: statusMap[id]
    }))
    .filter(({ status }) => status !== null);

  // Find layers with errors that haven't been dismissed
  const errorLayers = layerStatuses.filter(
    ({ id, status }) =>
      status?.status === 'error' && !dismissedErrors.has(id)
  );

  if (errorLayers.length === 0) {
    return null;
  }

  const handleDismiss = (layerId: ClimateLayerId) => {
    setDismissedErrors(prev => new Set(prev).add(layerId));
    onDismiss?.(layerId);
  };

  const handleRefresh = (layerId: ClimateLayerId) => {
    setDismissedErrors(prev => {
      const next = new Set(prev);
      next.delete(layerId);
      return next;
    });
    onRefresh?.(layerId);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-[9999]">
      <div className="bg-red-900/95 backdrop-blur-sm text-white rounded-lg shadow-2xl p-6 max-w-md pointer-events-auto border-2 border-red-500">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-6 w-6 text-red-300 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2">Layer Loading Failed</h3>
            <div className="space-y-3">
              {errorLayers.map(({ id, status }) => (
                <div key={id} className="bg-red-950/50 rounded p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium text-red-100 mb-1">
                        {id.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                      </p>
                      <p className="text-sm text-red-200">
                        {status?.metadata?.errorMessage || 'Unknown error occurred'}
                      </p>
                      {status?.metadata?.errorMessage?.toLowerCase().includes('earth engine') && (
                        <div className="text-xs text-red-300 mt-2 space-y-1">
                          <p className="font-semibold">Earth Engine Issue Detected:</p>
                          <ul className="list-disc list-inside space-y-0.5 ml-2">
                            <li>Check Earth Engine authentication on the server</li>
                            <li>Verify EARTHENGINE_PROJECT environment variable is set</li>
                            <li>Ensure Earth Engine API is enabled in Google Cloud</li>
                            <li>Check server logs for initialization errors</li>
                          </ul>
                          <p className="mt-2 text-yellow-300">
                            The layer will automatically retry. If the issue persists, contact your administrator.
                          </p>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDismiss(id)}
                      className="text-red-300 hover:text-white transition-colors"
                      title="Dismiss"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRefresh(id)}
                      className="bg-red-800 hover:bg-red-700 border-red-600 text-white"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Retry
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
