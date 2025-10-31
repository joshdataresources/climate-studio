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
  import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '') || 'http://localhost:5001';

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

  const boundsKey = useMemo(() => getBoundsKey(bounds), [bounds]);

  const fetchContext: ClimateFetchContext = useMemo(
    () => {
      console.log('🔄 useClimateLayerData: Creating fetch context with bounds:', bounds)
      if (bounds) {
        console.log(`  Bounds: N=${bounds.north.toFixed(3)} S=${bounds.south.toFixed(3)} E=${bounds.east.toFixed(3)} W=${bounds.west.toFixed(3)} Z=${bounds.zoom}`)
      }
      return {
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
        droughtOpacity: controls.droughtOpacity,
        droughtMetric: controls.droughtMetric,
        useRealData: controls.useRealData
      }
    },
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
        const errorMsg = `Unknown layer: ${layerId}`;
        addLayerError(layerId, errorMsg);
        setLayerState(layerId, {
          status: 'error',
          data: null,
          error: errorMsg
        });
        return;
      }
      console.log(`✅ Layer config found for: ${layerId}`, layer);

      const params = layer.fetch.query(fetchContext);
      const cacheKey = `${layerId}:${JSON.stringify(params)}`;

      if (!forceRefresh && cacheRef.current.has(cacheKey)) {
        const cached = cacheRef.current.get(cacheKey)!;
        // Validate cached data:
        // 1. Has features array with at least one feature OR has tile_url (for raster layers)
        // 2. Has metadata object
        // 3. Metadata indicates real data (not fallback)
        // 4. Cache is not stale (less than 1 hour old)
        const now = Date.now();
        const cacheAge = now - (cached.updatedAt || 0);
        const maxCacheAge = 60 * 60 * 1000; // 1 hour

        const hasValidFeatures = cached.data?.features?.length > 0;
        const hasValidTileUrl = !!cached.data?.tile_url;
        const hasValidData = hasValidFeatures || hasValidTileUrl;
        const hasMetadata = !!cached.data?.metadata;
        const isRealData = cached.data?.metadata?.isRealData !== false &&
                          cached.data?.metadata?.dataType !== 'fallback';
        const isFresh = cacheAge < maxCacheAge;

        const isValidCache = hasValidData && hasMetadata && isRealData && isFresh;

        if (isValidCache) {
          console.log(`✅ Using validated cache for ${layerId}:`, {
            source: cached.data.metadata?.source,
            features: cached.data.features?.length,
            tileUrl: cached.data.tile_url ? 'present' : undefined,
            age: Math.round(cacheAge / 1000) + 's'
          });
          setLayerState(layerId, {
            ...cached,
            status: 'success'
          });
          return;
        } else {
          console.warn(`⚠️ Cache invalid for ${layerId}, refetching...`, {
            hasValidFeatures,
            hasValidTileUrl,
            hasValidData,
            hasMetadata,
            isRealData,
            isFresh,
            cacheAge: Math.round(cacheAge / 1000) + 's'
          });
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

        console.log('='.repeat(80));
        console.log(`🌊 Fetching ${layerId} (${layer.title})`);
        console.log(`🔗 Full URL: ${url}`);
        console.log(`📦 Query params:`, params);
        console.log(`⚙️ Backend: ${BACKEND_BASE_URL}`);
        console.log(`🛣️ Route: ${layer.fetch.route}`);
        console.log('='.repeat(80));

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
        console.log('📥'.repeat(40));
        console.log(`RESPONSE for ${layerId}:`);
        console.log('Success:', payload.success);
        console.log('Has data:', !!payload.data);
        console.log('Features count:', payload.data?.features?.length || payload.features?.length || 0);
        console.log('Metadata:', payload.data?.metadata || payload.metadata);
        console.log('IS REAL DATA:', payload.data?.metadata?.isRealData);
        console.log('DATA TYPE:', payload.data?.metadata?.dataType);
        console.log('SOURCE:', payload.data?.metadata?.source);
        console.log('📥'.repeat(40));

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
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const uniqueActiveLayers = Array.from(new Set(activeLayerIds));
    console.log('🎯 Active layers in useClimateLayerData:', uniqueActiveLayers);

    const currentZoom = fetchContext.bounds?.zoom ?? 10;
    const currentBoundsKey = boundsKey;

    // Track control parameters separately from bounds for tile layers
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

    // Smaller hexagons with lazy loading
    // More aggressive resolution increase at higher zoom for detail
    const getResolutionBucket = (zoom: number) => {
      if (zoom < 7) return 2;
      if (zoom < 9) return 3;
      if (zoom < 11) return 5;  // Skip resolution 4, jump to 5 for smaller hexagons
      if (zoom < 13) return 6;
      if (zoom < 15) return 7;
      if (zoom < 17) return 8;
      return 9;
    };

    const currentResolution = getResolutionBucket(currentZoom);
    const prevResolution = prevZoomRef.current !== null ? getResolutionBucket(prevZoomRef.current) : currentResolution;

    // Check if bounds changed significantly (pan detected)
    const boundsChanged = prevBoundsRef.current !== null && prevBoundsRef.current !== currentBoundsKey;

    // Only trigger refetch if resolution actually changed
    const resolutionChanged = currentResolution !== prevResolution;
    const isFirstLoad = prevZoomRef.current === null;

    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📏 Zoom: ${prevZoomRef.current?.toFixed(2) ?? 'initial'} → ${currentZoom.toFixed(2)}`);
    console.log(`🔷 Resolution: ${prevResolution} → ${currentResolution}`);
    console.log(`🗺️  Bounds changed: ${boundsChanged ? 'YES' : 'NO'}`);
    console.log(`🔀 Resolution changed: ${resolutionChanged ? 'YES - WILL REFETCH' : 'NO'}`);
    console.log('═══════════════════════════════════════════════════════════');

    // Clear any pending debounced fetch
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // For first load, fetch immediately without debounce
    if (isFirstLoad) {
      console.log('🎬 First load - fetching all active layers immediately');
      uniqueActiveLayers.forEach(layerId => {
        console.log(`  → Fetching ${layerId}`);
        fetchLayer(layerId);
      });
      prevZoomRef.current = currentZoom;
      prevBoundsRef.current = currentBoundsKey;
    } else {
      // All climate layers now use tiles - no more hexagon layers
      // Tile-based layers that don't depend on bounds (global tiles)
      const globalTileLayers: ClimateLayerId[] = ['temperature_projection', 'urban_heat_island', 'topographic_relief', 'precipitation_drought'];

      // Refetch tile-based layers when control parameters change (not bounds)
      if (controlsChanged) {
        const activeTileLayers = uniqueActiveLayers.filter(id => globalTileLayers.includes(id));
        if (activeTileLayers.length > 0) {
          console.log(`🎛️  Controls changed - refetching tile layers:`, activeTileLayers);
          activeTileLayers.forEach(layerId => {
            fetchLayer(layerId);
          });
        }
      }

      // Always fetch bounds-based layers immediately on bounds change (no debounce)
      // All climate layers now use tiles, so only sea_level_rise is bounds-based
      const boundsBasedLayers = uniqueActiveLayers.filter(
        id => !globalTileLayers.includes(id)
      );
      if (boundsBasedLayers.length > 0 && boundsChanged) {
        console.log(`🗺️  Fetching bounds-based layers immediately:`, boundsBasedLayers);
        boundsBasedLayers.forEach(layerId => {
          fetchLayer(layerId);
        });
      }

      prevZoomRef.current = currentZoom;
      prevBoundsRef.current = currentBoundsKey;
      prevControlsRef.current = controlsKey;
    }

    // Cleanup debounce timer on unmount
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [activeLayerIds, fetchContext]);

  const refreshLayer = useCallback(
    (layerId: ClimateLayerId) => {
      // Clear all cache to force fresh fetch
      cacheRef.current.clear();
      // Clear any error state for this layer
      clearLayerErrors(layerId);
      // Force fetch with cache bypass
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
