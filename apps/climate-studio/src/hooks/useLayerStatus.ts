/**
 * React hook for subscribing to layer status events
 */

import { useEffect, useState } from 'react';
import { layerStatusMonitor, LayerStatusEvent } from '../agents/LayerStatusMonitor';
import { ClimateLayerId } from "@climate-studio/core/config";

/**
 * Subscribe to status events for a specific layer
 */
export function useLayerStatus(layerId: ClimateLayerId) {
  const [status, setStatus] = useState<LayerStatusEvent | null>(() =>
    layerStatusMonitor.getLatestStatus(layerId)
  );

  useEffect(() => {
    const unsubscribe = layerStatusMonitor.subscribe((event) => {
      if (event.layerId === layerId) {
        setStatus(event);
      }
    });

    return unsubscribe;
  }, [layerId]);

  return status;
}

/**
 * Subscribe to all layer status events
 */
export function useAllLayerStatuses() {
  const [events, setEvents] = useState<LayerStatusEvent[]>([]);

  useEffect(() => {
    const unsubscribe = layerStatusMonitor.subscribe((event) => {
      setEvents(prev => [...prev, event]);
    });

    return unsubscribe;
  }, []);

  return events;
}

/**
 * Get monitoring summary
 */
export function useLayerStatusSummary() {
  const [summary, setSummary] = useState(() => layerStatusMonitor.getSummary());

  useEffect(() => {
    const unsubscribe = layerStatusMonitor.subscribe(() => {
      setSummary(layerStatusMonitor.getSummary());
    });

    return unsubscribe;
  }, []);

  return summary;
}

/**
 * Check if a layer is using fallback data
 */
export function useLayerFallbackStatus(layerId: ClimateLayerId): boolean {
  const [hasFallback, setHasFallback] = useState(() =>
    layerStatusMonitor.hasFallback(layerId)
  );

  useEffect(() => {
    const unsubscribe = layerStatusMonitor.subscribe((event) => {
      if (event.layerId === layerId && event.dataSource === 'fallback') {
        setHasFallback(true);
      }
    });

    return unsubscribe;
  }, [layerId]);

  return hasFallback;
}
