import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClimateFetchContext, ClimateLayerId, getClimateLayer } from '../config/climateLayers';
import { useClimate } from '../contexts/ClimateContext';
import { LatLngBoundsLiteral } from '../types/geography';

type FetchStatus = 'idle' | 'loading' | 'success' | 'error';

export interface LayerFetchState {
  status: FetchStatus;
  data: any | null;
  metadata?: any;
  error?: string;
  updatedAt?: number;
  estimatedLoadTime?: number; // milliseconds
}

export type LayerStateMap = Partial<Record<ClimateLayerId, LayerFetchState>>;

const BACKEND_BASE_URL =
  import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '') || 'http://localhost:3001';

// Cache expiration times (milliseconds)
const CACHE_EXPIRATION = {
  temperature_projection: 60 * 60 * 1000,    // 1 hour
  sea_level_rise: 24 * 60 * 60 * 1000,       // 24 hours
  urban_heat_island: 60 * 60 * 1000,         // 1 hour
  topographic_relief: 7 * 24 * 60 * 60 * 1000, // 7 days
  temperature_current: 60 * 60 * 1000        // 1 hour
};

// Estimated load times for different layers (milliseconds)
const ESTIMATED_LOAD_TIME = {
  temperature_projection: 8000,  // NASA EE can take 5-10 seconds
  sea_level_rise: 3000,
  urban_heat_island: 2000,       // Tile URL is fast
  topographic_relief: 2000,      // Tile URL is fast
  temperature_current: 5000
};

// LocalStorage cache utilities
const CACHE_PREFIX = 'climate_layer_cache_';

const loadFromLocalStorage = (cacheKey: string): LayerFetchState | null => {
  try {
    const item = localStorage.getItem(CACHE_PREFIX + cacheKey);
    if (!item) return null;
    const cached = JSON.parse(item) as LayerFetchState;
    return cached;
  } catch (error) {
    console.warn('Failed to load from localStorage:', error);
    return null;
  }
};

const saveToLocalStorage = (cacheKey: string, state: LayerFetchState): void => {
  try {
    localStorage.setItem(CACHE_PREFIX + cacheKey, JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to save to localStorage:', error);
  }
};

const isCacheValid = (cached: LayerFetchState, layerId: ClimateLayerId): boolean => {
  if (!cached.updatedAt) return false;
  const expirationTime = CACHE_EXPIRATION[layerId] || 60 * 60 * 1000; // Default 1 hour
  const age = Date.now() - cached.updatedAt;
  return age < expirationTime;
};

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
      const layer = getClimateLayer(layerId);
      if (!layer) {
        setLayerState(layerId, {
          status: 'error',
          data: null,
          error: `Unknown layer: ${layerId}`
        });
        return;
      }

      const params = layer.fetch.query(fetchContext);
      const cacheKey = `${layerId}:${JSON.stringify(params)}`;

      // Check in-memory cache first
      if (!forceRefresh && cacheRef.current.has(cacheKey)) {
        const cached = cacheRef.current.get(cacheKey)!;
        if (isCacheValid(cached, layerId)) {
          console.log(`Using in-memory cache for ${layerId}`);
          setLayerState(layerId, {
            ...cached,
            status: 'success'
          });
          return;
        } else {
          // Remove expired cache
          cacheRef.current.delete(cacheKey);
        }
      }

      // Check localStorage cache
      if (!forceRefresh) {
        const cachedFromStorage = loadFromLocalStorage(cacheKey);
        if (cachedFromStorage && isCacheValid(cachedFromStorage, layerId)) {
          console.log(`Using localStorage cache for ${layerId}`);
          // Restore to in-memory cache
          cacheRef.current.set(cacheKey, cachedFromStorage);
          setLayerState(layerId, {
            ...cachedFromStorage,
            status: 'success'
          });
          return;
        }
      }

      if (abortControllers.current.has(layerId)) {
        abortControllers.current.get(layerId)?.abort();
      }

      const controller = new AbortController();
      abortControllers.current.set(layerId, controller);

      const estimatedTime = ESTIMATED_LOAD_TIME[layerId] || 5000;

      setLayerState(layerId, previous => ({
        status: 'loading',
        data: previous?.data ?? null,
        metadata: previous?.metadata,
        updatedAt: previous?.updatedAt,
        estimatedLoadTime: estimatedTime
      }));

      const startTime = Date.now();

      try {
        const queryString = buildQueryString(params);
        const url = `${BACKEND_BASE_URL}${layer.fetch.route}${queryString ? `?${queryString}` : ''}`;

        console.log(`Fetching ${layerId} from API (estimated ${estimatedTime}ms)...`);

        const response = await fetch(url, {
          method: layer.fetch.method,
          signal: controller.signal
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Request failed with status ${response.status}: ${errorText}`);
        }

        const payload = await response.json();
        const actualTime = Date.now() - startTime;

        console.log(`${layerId} loaded in ${actualTime}ms`);

        const result: LayerFetchState = {
          status: 'success',
          data: payload.data ?? payload,
          metadata: payload.metadata,
          updatedAt: Date.now()
        };

        // Save to both in-memory and localStorage cache
        cacheRef.current.set(cacheKey, result);
        saveToLocalStorage(cacheKey, result);

        setLayerState(layerId, result);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error loading ${layerId}:`, message);
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
    uniqueActiveLayers.forEach(layerId => {
      fetchLayer(layerId);
    });

    return () => {
      uniqueActiveLayers.forEach(layerId => {
        if (abortControllers.current.has(layerId)) {
          abortControllers.current.get(layerId)?.abort();
          abortControllers.current.delete(layerId);
        }
      });
    };
  }, [activeLayerIds, fetchLayer]);

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
