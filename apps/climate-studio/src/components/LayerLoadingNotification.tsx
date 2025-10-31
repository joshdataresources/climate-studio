/**
 * Loading notification for layers taking longer than expected
 */

import React, { useEffect, useState } from 'react';
import { useLayerStatus } from '../hooks/useLayerStatus';
import { ClimateLayerId } from "@climate-studio/core/config";
import { Loader2 } from 'lucide-react';

interface LayerLoadingNotificationProps {
  activeLayerIds: ClimateLayerId[];
  delayThreshold?: number; // milliseconds before showing notification
}

export function LayerLoadingNotification({
  activeLayerIds,
  delayThreshold = 3000
}: LayerLoadingNotificationProps) {
  const [slowLoadingLayers, setSlowLoadingLayers] = useState<Set<ClimateLayerId>>(new Set());
  const [loadingTimers, setLoadingTimers] = useState<Map<ClimateLayerId, NodeJS.Timeout>>(new Map());

  // Get status for each active layer (must be called unconditionally)
  const precipitationDroughtStatus = useLayerStatus('precipitation_drought');
  const temperatureProjectionStatus = useLayerStatus('temperature_projection');
  const seaLevelRiseStatus = useLayerStatus('sea_level_rise');
  const urbanHeatIslandStatus = useLayerStatus('urban_heat_island');
  const topographicReliefStatus = useLayerStatus('topographic_relief');

  // Build layer statuses map
  const statusMap: Record<ClimateLayerId, any> = {
    'precipitation_drought': precipitationDroughtStatus,
    'temperature_projection': temperatureProjectionStatus,
    'sea_level_rise': seaLevelRiseStatus,
    'urban_heat_island': urbanHeatIslandStatus,
    'topographic_relief': topographicReliefStatus,
  };

  useEffect(() => {
    const newTimers = new Map<ClimateLayerId, NodeJS.Timeout>();
    const newSlowLayers = new Set<ClimateLayerId>();

    activeLayerIds.forEach(layerId => {
      const status = statusMap[layerId];

      if (status?.status === 'loading') {
        // Check if we already have a timer for this layer
        if (loadingTimers.has(layerId)) {
          newTimers.set(layerId, loadingTimers.get(layerId)!);
          if (slowLoadingLayers.has(layerId)) {
            newSlowLayers.add(layerId);
          }
        } else {
          // Start a new timer
          const timer = setTimeout(() => {
            setSlowLoadingLayers(prev => new Set(prev).add(layerId));
          }, delayThreshold);
          newTimers.set(layerId, timer);
        }
      } else {
        // Clear timer if layer is no longer loading
        const existingTimer = loadingTimers.get(layerId);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }
      }
    });

    // Clean up old timers
    loadingTimers.forEach((timer, layerId) => {
      if (!newTimers.has(layerId)) {
        clearTimeout(timer);
      }
    });

    setLoadingTimers(newTimers);
    setSlowLoadingLayers(newSlowLayers);

    return () => {
      newTimers.forEach(timer => clearTimeout(timer));
    };
  }, [activeLayerIds, statusMap, delayThreshold]);

  // Filter to only show layers that are still loading
  const layersToShow = Array.from(slowLoadingLayers).filter(layerId => {
    const status = statusMap[layerId];
    return status?.status === 'loading';
  });

  if (layersToShow.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[9998]">
      <div className="bg-blue-900/95 backdrop-blur-sm text-white rounded-lg shadow-2xl p-6 max-w-md pointer-events-auto border-2 border-blue-500">
        <div className="flex items-start gap-3">
          <Loader2 className="h-6 w-6 text-blue-300 flex-shrink-0 mt-0.5 animate-spin" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2">Loading Climate Data</h3>
            <p className="text-sm text-blue-100 mb-3">
              This is taking longer than expected. Please wait while we fetch data from NASA and NOAA servers...
            </p>
            <div className="space-y-2">
              {layersToShow.map(layerId => (
                <div key={layerId} className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-300" />
                  <span className="text-sm text-blue-200">
                    {layerId.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
