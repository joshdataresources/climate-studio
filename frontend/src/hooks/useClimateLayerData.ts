import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClimateFetchContext, ClimateLayerId, getClimateLayer } from '../config/climateLayers';
import { useClimate } from '../contexts/ClimateContext';
import { LatLngBoundsLiteral } from '../types/geography';
import { layerStatusMonitor } from '../agents/LayerStatusMonitor';

type FetchStatus = 'idle' | 'loading' | 'success' | 'error';

export interface LayerFetchState {
  status: FetchStatus;
  data: any | null;
  metadata?: any;
  error?: string;
  updatedAt?: number;
}

export type LayerStateMap = Partial<Record<ClimateLayerId, LayerFetchState>>;

const BACKEND_BASE_URL =
  import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '') || 'http://localhost:3001';

const buildQueryString = (params: Record<string, string | number | boolean>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    search.append(key, String(value));
  });
  return search.toString();
};

const getBoundsKey = (bounds: LatLngBoundsLiteral | null) => {
  if (!bounds) return 'global';
  return `${bounds.north}:${bounds.south}:${bounds.east}:${bounds.west}:${bounds.zoom || 10}`;
};

export const useClimateLayerData = (bounds: LatLngBoundsLiteral | null) => {
  const { controls, activeLayerIds } = useClimate();
  const [layerStates, setLayerStates] = useState<LayerStateMap>({});
  const cacheRef = useRef<Map<string, LayerFetchState>>(new Map());
  const abortControllers = useRef<Map<ClimateLayerId, AbortController>>(new Map());

  const boundsKey = useMemo(() => getBoundsKey(bounds), [bounds]);

  const fetchContext: ClimateFetchContext = useMemo(
    () => ({
      bounds,
      scenario: controls.scenario,
      projectionYear: controls.projectionYear,
      seaLevelFeet: controls.seaLevelFeet,
      analysisDate: controls.analysisDate,
      displayStyle: controls.displayStyle,
      resolution: controls.resolution,
      projectionOpacity: controls.projectionOpacity,
      urbanHeatSeason: controls.urbanHeatSeason,
      urbanHeatColorScheme: controls.urbanHeatColorScheme,
      reliefStyle: controls.reliefStyle,
      reliefOpacity: controls.reliefOpacity,
      temperatureMode: controls.temperatureMode,
      useRealData: controls.useRealData
    }),
    [bounds, controls, boundsKey]
  );

  const setLayerState = useCallback(
    (
      layerId: ClimateLayerId,
      nextState: LayerFetchState | ((previous?: LayerFetchState) => LayerFetchState)
    ) => {
      setLayerStates(prev => {
        const previous = prev[layerId];
        const resolved =
          typeof nextState === 'function'
            ? (nextState as (previous?: LayerFetchState) => LayerFetchState)(previous)
            : nextState;
        return {
          ...prev,
          [layerId]: resolved
        };
      });
    },
    []
  );

  const fetchLayer = useCallback(
    async (layerId: ClimateLayerId, forceRefresh = false) => {
      console.log(`🔍 fetchLayer called for: ${layerId}`);
      const layer = getClimateLayer(layerId);
      if (!layer) {
        console.error(`❌ Unknown layer: ${layerId}`);
        setLayerState(layerId, {
          status: 'error',
          data: null,
          error: `Unknown layer: ${layerId}`
        });
        return;
      }
      console.log(`✅ Layer config found for: ${layerId}`, layer);

      const params = layer.fetch.query(fetchContext);
      const cacheKey = `${layerId}:${JSON.stringify(params)}`;

      if (!forceRefresh && cacheRef.current.has(cacheKey)) {
        const cached = cacheRef.current.get(cacheKey)!;
        // Validate cached data has features and metadata
        const isValidCache = cached.data?.features?.length > 0 && cached.data?.metadata;
        if (isValidCache) {
          console.log(`✅ Using validated cache for ${layerId}:`, cached.data.metadata?.source);
          setLayerState(layerId, {
            ...cached,
            status: 'success'
          });
          return;
        } else {
          console.warn(`⚠️ Cache invalid for ${layerId}, refetching...`);
          cacheRef.current.delete(cacheKey);
        }
      }

      if (abortControllers.current.has(layerId)) {
        abortControllers.current.get(layerId)?.abort();
      }

      const controller = new AbortController();
      abortControllers.current.set(layerId, controller);

      // Emit loading status
      layerStatusMonitor.emit(
        layerStatusMonitor.createStatusEvent(layerId, 'loading')
      );

      setLayerState(layerId, previous => ({
        status: 'loading',
        data: previous?.data ?? null,
        metadata: previous?.metadata,
        updatedAt: previous?.updatedAt
      }));

      try {
        const queryString = buildQueryString(params);
        const url = `${BACKEND_BASE_URL}${layer.fetch.route}${queryString ? `?${queryString}` : ''}`;

        console.log(`🌊 Fetching ${layerId}:`, url);
        console.log(`📦 Query params:`, params);
        console.log(`🔗 BACKEND_BASE_URL:`, BACKEND_BASE_URL);
        console.log(`🛣️ Route:`, layer.fetch.route);
        console.log(`📋 Full URL breakdown:`, {
          base: BACKEND_BASE_URL,
          route: layer.fetch.route,
          queryString,
          fullUrl: url
        });

        // Wait minimum 10s for real NASA data before considering fallback
        const minWaitTime = 10000;
        const startTime = Date.now();

        console.log(`⏳ Starting fetch for ${layerId}...`);
        console.log(`⏰ Fetch started at:`, new Date().toISOString());

        let response;
        try {
          response = await fetch(url, {
            method: layer.fetch.method,
            signal: controller.signal
          });
          console.log(`✅ Fetch complete for ${layerId}, status:`, response.status);
        } catch (fetchError) {
          console.error(`❌ Fetch failed for ${layerId}:`, fetchError);
          console.error(`❌ Fetch error type:`, fetchError instanceof Error ? fetchError.name : typeof fetchError);
          console.error(`❌ Fetch error message:`, fetchError instanceof Error ? fetchError.message : fetchError);
          throw fetchError;
        }

        const elapsedTime = Date.now() - startTime;
        if (elapsedTime < minWaitTime) {
          // Response came back too fast, might be immediate fallback
          console.warn(`⚠️ Fast response for ${layerId} (${elapsedTime}ms), checking data source...`);
        }

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const payload = await response.json();
        console.log(`📥 Full Response for ${layerId}:`, payload);
        console.log(`📦 payload.data:`, payload.data);
        console.log(`📦 payload.data?.features:`, payload.data?.features);
        console.log(`📦 payload.data?.features?.length:`, payload.data?.features?.length);
        console.log(`📦 payload.features (if not nested):`, payload.features);
        console.log(`📊 Extracted data:`, payload.data ?? payload);

        const result: LayerFetchState = {
          status: 'success',
          data: payload.data ?? payload,
          metadata: payload.metadata,
          updatedAt: Date.now()
        };

        // Emit success status and analyze data source
        const statusEvent = layerStatusMonitor.createStatusEvent(
          layerId,
          'success',
          payload.data ?? payload
        );
        layerStatusMonitor.emit(statusEvent);

        // Log definitive message based on data source
        if (statusEvent.dataSource === 'real') {
          console.log(`✅ REAL NASA DATA loaded for ${layerId}:`, {
            source: statusEvent.metadata?.source,
            features: statusEvent.metadata?.featureCount,
            model: statusEvent.metadata?.model
          });
        } else if (statusEvent.dataSource === 'fallback') {
          console.warn(`⚠️ FALLBACK DATA loaded for ${layerId}:`, {
            reason: statusEvent.metadata?.fallbackReason || 'Real data unavailable',
            source: statusEvent.metadata?.source,
            features: statusEvent.metadata?.featureCount
          });
        }

        cacheRef.current.set(cacheKey, result);
        setLayerState(layerId, result);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        const message = error instanceof Error ? error.message : 'Unknown error';

        // Emit error status
        layerStatusMonitor.emit(
          layerStatusMonitor.createStatusEvent(layerId, 'error', undefined, message)
        );

        setLayerState(layerId, {
          status: 'error',
          data: null,
          error: message
        });
      } finally {
        abortControllers.current.delete(layerId);
      }
    },
    [fetchContext, setLayerState]
  );

  useEffect(() => {
    const uniqueActiveLayers = Array.from(new Set(activeLayerIds));
    console.log('🎯 Active layers in useClimateLayerData:', uniqueActiveLayers);
    uniqueActiveLayers.forEach(layerId => {
      console.log(`🔄 Fetching layer: ${layerId}`);
      fetchLayer(layerId);
    });
  }, [activeLayerIds, fetchContext]);

  const refreshLayer = useCallback(
    (layerId: ClimateLayerId) => {
      cacheRef.current.clear();
      fetchLayer(layerId, true);
    },
    [fetchLayer]
  );

  const refreshAll = useCallback(() => {
    cacheRef.current.clear();
    activeLayerIds.forEach(layerId => fetchLayer(layerId, true));
  }, [activeLayerIds, fetchLayer]);

  return {
    layers: layerStates,
    controls: fetchContext,
    refreshLayer,
    refreshAll
  };
};
