import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClimateFetchContext, ClimateLayerId, getClimateLayer } from "@climate-studio/core/config";
import { useClimate } from "@climate-studio/core";
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
  const { controls, activeLayerIds, addLayerError, clearLayerErrors } = useClimate();
  const [layerStates, setLayerStates] = useState<LayerStateMap>({});
  
  const cacheRef = useRef<Map<string, LayerFetchState>>(new Map());
  const abortControllers = useRef<Map<ClimateLayerId, AbortController>>(new Map());

  // Clear tile layer cache on mount to ensure fresh tile URLs
  useEffect(() => {
    const tileLayers: ClimateLayerId[] = ['temperature_projection', 'urban_heat_island', 'topographic_relief', 'precipitation_drought'];
    const keysToDelete: string[] = [];
    cacheRef.current.forEach((value, key) => {
      const layerId = key.split(':')[0] as ClimateLayerId;
      if (tileLayers.includes(layerId)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => cacheRef.current.delete(key));
  }, []);

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
      urbanExpansionOpacity: controls.urbanExpansionOpacity,
      reliefStyle: controls.reliefStyle,
      reliefOpacity: controls.reliefOpacity,
      temperatureMode: controls.temperatureMode,
      droughtOpacity: controls.droughtOpacity,
      droughtMetric: controls.droughtMetric,
      megaregionOpacity: controls.megaregionOpacity,
      megaregionAnimating: controls.megaregionAnimating,
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
      const layer = getClimateLayer(layerId);
      if (!layer) {
        const errorMsg = `Unknown layer: ${layerId}`;
        addLayerError(layerId, errorMsg);
        setLayerState(layerId, {
          status: 'error',
          data: null,
          error: errorMsg
        });
        return;
      }

      // Skip fetch if route is empty (layer uses local data only, like megaregion)
      if (!layer.fetch.route || layer.fetch.route === '') {
        setLayerState(layerId, {
          status: 'success',
          data: { features: [] },
          metadata: { source: 'local', isRealData: true },
          updatedAt: Date.now()
        });
        return;
      }

      const params = layer.fetch.query(fetchContext);
      const cacheKey = `${layerId}:${JSON.stringify(params)}`;

      if (!forceRefresh && cacheRef.current.has(cacheKey)) {
        const cached = cacheRef.current.get(cacheKey)!;
        const now = Date.now();
        const cacheAge = now - (cached.updatedAt || 0);
        const tileLayers: ClimateLayerId[] = ['temperature_projection', 'urban_heat_island', 'topographic_relief', 'precipitation_drought'];
        const isTileLayer = tileLayers.includes(layerId);
        const maxCacheAge = layerId === 'urban_expansion' ? 5 * 60 * 1000 :
                           isTileLayer ? 10 * 60 * 1000 :
                           60 * 60 * 1000;

        const hasValidFeatures = cached.data?.features?.length > 0;
        const hasValidTileUrl = !!cached.data?.tile_url;
        const hasValidData = hasValidFeatures || hasValidTileUrl;
        const hasMetadata = !!cached.data?.metadata;
        const isRealData = layerId === 'urban_expansion' ? true :
          (cached.data?.metadata?.isRealData !== false &&
            cached.data?.metadata?.dataType !== 'fallback');
        const isFresh = cacheAge < maxCacheAge;

        const isValidCache = hasValidData && hasMetadata && isRealData && isFresh;

        if (isValidCache) {
          setLayerState(layerId, {
            ...cached,
            status: 'success'
          });
          return;
        } else {
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
        const hasExplicitBackendUrl = !!import.meta.env.VITE_BACKEND_URL;
        const url = hasExplicitBackendUrl
          ? `${BACKEND_BASE_URL}${layer.fetch.route}${queryString ? `?${queryString}` : ''}`
          : `${layer.fetch.route}${queryString ? `?${queryString}` : ''}`;

        const response = await fetch(url, {
          method: layer.fetch.method,
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const payload = await response.json();

        // For tile-based APIs, the response has tile_url at top level
        // Wrap it so data.tile_url works consistently
        const layerData = payload.data ?? (payload.tile_url ? payload : { features: payload.features || [] });
        
        console.log(`📦 ${layerId} FULL response:`, JSON.stringify(payload, null, 2).substring(0, 500));
        console.log(`📦 ${layerId} layerData:`, JSON.stringify(layerData, null, 2).substring(0, 500));

        const result: LayerFetchState = {
          status: 'success',
          data: layerData,
          metadata: payload.metadata,
          updatedAt: Date.now()
        };

        // Emit success status
        const statusEvent = layerStatusMonitor.createStatusEvent(
          layerId,
          'success',
          payload.data ?? payload
        );
        layerStatusMonitor.emit(statusEvent);

        // Clear any previous errors for this layer on successful load
        clearLayerErrors(layerId);

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

        // Report error to context for user notification
        addLayerError(layerId, message);

        setLayerState(layerId, {
          status: 'error',
          data: null,
          error: message
        });
      } finally {
        abortControllers.current.delete(layerId);
      }
    },
    [fetchContext, setLayerState, addLayerError, clearLayerErrors]
  );

  // Track previous zoom and bounds to detect changes
  const prevZoomRef = useRef<number | null>(null);
  const prevBoundsRef = useRef<string | null>(null);
  const prevControlsRef = useRef<string | null>(null);
  const prevActiveLayersRef = useRef<Set<ClimateLayerId>>(new Set());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup abort controllers for inactive layers
  useEffect(() => {
    const activeSet = new Set(activeLayerIds);
    abortControllers.current.forEach((controller, layerId) => {
      if (!activeSet.has(layerId)) {
        controller.abort();
        abortControllers.current.delete(layerId);
      }
    });
  }, [activeLayerIds]);

  useEffect(() => {
    const uniqueActiveLayers = Array.from(new Set(activeLayerIds));
    const currentActiveSet = new Set(uniqueActiveLayers);

    const currentZoom = fetchContext.bounds?.zoom ?? 10;
    const currentBoundsKey = boundsKey;

    const controlsKey = JSON.stringify({
      scenario: fetchContext.scenario,
      year: fetchContext.projectionYear,
      mode: fetchContext.temperatureMode,
      season: fetchContext.urbanHeatSeason,
      colorScheme: fetchContext.urbanHeatColorScheme,
      reliefStyle: fetchContext.reliefStyle,
      droughtMetric: fetchContext.droughtMetric
    });
    const controlsChanged = prevControlsRef.current !== null && prevControlsRef.current !== controlsKey;

    const getResolutionBucket = (zoom: number) => {
      if (zoom < 7) return 2;
      if (zoom < 9) return 3;
      if (zoom < 11) return 5;
      if (zoom < 13) return 6;
      if (zoom < 15) return 7;
      if (zoom < 17) return 8;
      return 9;
    };

    const currentResolution = getResolutionBucket(currentZoom);
    const prevResolution = prevZoomRef.current !== null ? getResolutionBucket(prevZoomRef.current) : currentResolution;

    const boundsChanged = prevBoundsRef.current !== null && prevBoundsRef.current !== currentBoundsKey;
    const isFirstLoad = prevZoomRef.current === null;

    // Find newly activated layers (layers that weren't active before)
    const newlyActivatedLayers = uniqueActiveLayers.filter(
      layerId => !prevActiveLayersRef.current.has(layerId)
    );

    // Clear any pending debounced fetch
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // For first load, fetch immediately without debounce
    if (isFirstLoad) {
      uniqueActiveLayers.forEach(layerId => {
        fetchLayer(layerId);
      });
      prevZoomRef.current = currentZoom;
      prevBoundsRef.current = currentBoundsKey;
      prevActiveLayersRef.current = currentActiveSet;
    } else {
      // Tile-based layers that don't depend on bounds (global tiles)
      const globalTileLayers: ClimateLayerId[] = ['temperature_projection', 'urban_heat_island', 'topographic_relief', 'precipitation_drought'];

      // ALWAYS fetch newly activated layers immediately
      if (newlyActivatedLayers.length > 0) {
        console.log('🆕 Fetching newly activated layers:', newlyActivatedLayers);
        newlyActivatedLayers.forEach(layerId => {
          fetchLayer(layerId);
        });
      }

      // Refetch tile-based layers when control parameters change (not bounds)
      if (controlsChanged) {
        const activeTileLayers = uniqueActiveLayers.filter(
          id => globalTileLayers.includes(id) && !newlyActivatedLayers.includes(id)
        );
        if (activeTileLayers.length > 0) {
          activeTileLayers.forEach(layerId => {
            fetchLayer(layerId);
          });
        }
      }

      // Always fetch bounds-based layers immediately on bounds change
      const boundsBasedLayers = uniqueActiveLayers.filter(
        id => !globalTileLayers.includes(id) && !newlyActivatedLayers.includes(id)
      );
      if (boundsBasedLayers.length > 0 && boundsChanged) {
        boundsBasedLayers.forEach(layerId => {
          fetchLayer(layerId);
        });
      }

      prevZoomRef.current = currentZoom;
      prevBoundsRef.current = currentBoundsKey;
      prevControlsRef.current = controlsKey;
      prevActiveLayersRef.current = currentActiveSet;
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [activeLayerIds, fetchContext]);

  // Cleanup all abort controllers on unmount
  useEffect(() => {
    return () => {
      abortControllers.current.forEach((controller) => {
        controller.abort();
      });
      abortControllers.current.clear();
    };
  }, []);

  const refreshLayer = useCallback(
    (layerId: ClimateLayerId) => {
      cacheRef.current.clear();
      clearLayerErrors(layerId);
      fetchLayer(layerId, true);
    },
    [fetchLayer, clearLayerErrors]
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
