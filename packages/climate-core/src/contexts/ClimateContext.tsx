import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ClimateLayerId, climateLayers } from '../config/climateLayers';

type DisplayStyle = 'depth' | 'confidence';

export interface ClimateControlsState {
  scenario: string;
  projectionYear: number;
  seaLevelFeet: number;
  analysisDate: string;
  displayStyle: DisplayStyle;
  resolution: number;
  projectionOpacity: number;
  seaLevelOpacity: number;
  urbanHeatOpacity: number;
  urbanHeatSeason: 'summer' | 'winter';
  urbanHeatColorScheme: 'temperature' | 'heat' | 'urban';
  urbanExpansionOpacity: number;
  reliefStyle: 'classic' | 'dark' | 'depth' | 'dramatic';
  reliefOpacity: number;
  temperatureMode: 'anomaly' | 'actual';
  droughtOpacity: number;
  droughtMetric: 'precipitation' | 'drought_index';
  megaregionOpacity: number;
  megaregionDataMode: 'population' | 'temperature' | 'both';
  megaregionShowPopulation: boolean;
  megaregionShowTemperature: boolean;
  megaregionAnimating: boolean;
  useRealData: boolean;
  wetBulbOpacity: number; // Wet Bulb
}

interface LayerError {
  id: string;
  layerId: ClimateLayerId;
  layerName: string;
  error: string;
  timestamp: number;
}

interface ClimateContextValue {
  controls: ClimateControlsState;
  setScenario: (scenario: string) => void;
  setProjectionYear: (year: number) => void;
  setSeaLevelFeet: (feet: number) => void;
  setAnalysisDate: (isoDate: string) => void;
  setDisplayStyle: (style: DisplayStyle) => void;
  setResolution: (resolution: number) => void;
  setProjectionOpacity: (value: number) => void;
  setSeaLevelOpacity: (value: number) => void;
  setUrbanHeatOpacity: (value: number) => void;
  setUrbanHeatSeason: (season: 'summer' | 'winter') => void;
  setUrbanHeatColorScheme: (scheme: 'temperature' | 'heat' | 'urban') => void;
  setUrbanExpansionOpacity: (value: number) => void;
  setReliefStyle: (style: 'classic' | 'dark' | 'depth' | 'dramatic') => void;
  setReliefOpacity: (value: number) => void;
  setTemperatureMode: (mode: 'anomaly' | 'actual') => void;
  setDroughtOpacity: (value: number) => void;
  setDroughtMetric: (metric: 'precipitation' | 'drought_index') => void;
  setMegaregionOpacity: (value: number) => void;
  setMegaregionDataMode: (mode: 'population' | 'temperature' | 'both') => void;
  setMegaregionShowPopulation: (value: boolean) => void;
  setMegaregionShowTemperature: (value: boolean) => void;
  setMegaregionAnimating: (value: boolean) => void;
  setUseRealData: (value: boolean) => void;
  setWetBulbOpacity: (value: number) => void;
  activeLayerIds: ClimateLayerId[];
  setActiveLayerIds: (layerIds: ClimateLayerId[]) => void;
  /**
   * Restore an exact layer selection and/or control snapshot in one shot — used when
   * loading a saved view.
   *
   * Differs from setActiveLayerIds in two ways that matter for restore:
   *  - it bypasses the accidental-clear safeguard, so a view saved with no layers
   *    restores as no layers instead of silently falling back to the defaults;
   *  - it reconciles localStorage and the restore watchdog in the same tick, so the
   *    watchdog effect does not immediately revert the layers you just applied.
   *
   * `controls` is applied as a partial: unknown keys are ignored (tolerating snapshots
   * written by older builds) and omitted keys keep their current value.
   */
  applyViewState: (state: {
    activeLayerIds?: ClimateLayerId[];
    controls?: Partial<ClimateControlsState>;
  }) => void;
  toggleLayer: (layerId: ClimateLayerId) => void;
  isLayerActive: (layerId: ClimateLayerId) => boolean;
  layerErrors: LayerError[];
  addLayerError: (layerId: ClimateLayerId, error: string) => void;
  dismissLayerError: (errorId: string) => void;
  clearLayerErrors: (layerId?: ClimateLayerId) => void;
}

const ClimateContext = createContext<ClimateContextValue | undefined>(undefined);

const getDefaultAnalysisDate = () => {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date.toISOString().split('T')[0];
};

const defaultActiveLayers = climateLayers
  .filter(layer => layer.defaultActive)
  .map(layer => layer.id);

const STORAGE_KEY = 'climate-active-layers';

const getInitialActiveLayers = (): ClimateLayerId[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      console.log('✅ Restored active layers from localStorage:', parsed);
      console.log('📋 Default active layers from config:', defaultActiveLayers);

      // Merge stored layers with defaults to ensure all defaultActive layers are included
      const merged = Array.from(new Set([...defaultActiveLayers, ...parsed]));
      if (merged.length !== parsed.length) {
        console.log('🔄 Merged with defaults, now active:', merged);
        return merged;
      }
      return parsed;
    }
  } catch (e) {
    console.warn('⚠️ Failed to load active layers from localStorage:', e);
  }
  console.log('🎬 Using default active layers:', defaultActiveLayers);
  return defaultActiveLayers.length > 0 ? defaultActiveLayers : [];
};

export const ClimateProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [scenario, setScenario] = useState<string>('rcp45');
  const [projectionYear, setProjectionYear] = useState<number>(2030);
  const [seaLevelFeet, setSeaLevelFeet] = useState<number>(3);
  const [analysisDate, setAnalysisDate] = useState<string>(getDefaultAnalysisDate());
  const [displayStyle, setDisplayStyle] = useState<DisplayStyle>('depth');
  const [resolution, setResolution] = useState<number>(1);
  const [projectionOpacity, setProjectionOpacity] = useState<number>(0.3);
  const [seaLevelOpacity, setSeaLevelOpacity] = useState<number>(0.3);
  const [urbanHeatOpacity, setUrbanHeatOpacity] = useState<number>(0.3);
  const [urbanHeatSeason, setUrbanHeatSeason] = useState<'summer' | 'winter'>('summer');
  const [urbanHeatColorScheme, setUrbanHeatColorScheme] = useState<'temperature' | 'heat' | 'urban'>('heat');
  const [urbanExpansionOpacity, setUrbanExpansionOpacity] = useState<number>(0.3);
  const [reliefStyle, setReliefStyle] = useState<'classic' | 'dark' | 'depth' | 'dramatic'>('dramatic');
  const [reliefOpacity, setReliefOpacity] = useState<number>(0.3);
  const [temperatureMode, setTemperatureMode] = useState<'anomaly' | 'actual'>('anomaly');
  const [droughtOpacity, setDroughtOpacity] = useState<number>(0.3);
  const [droughtMetric, setDroughtMetric] = useState<'precipitation' | 'drought_index'>('precipitation');
  const [megaregionOpacity, setMegaregionOpacity] = useState<number>(0.5);
  const [megaregionDataMode, setMegaregionDataMode] = useState<'population' | 'temperature' | 'both'>('population');
  const [megaregionShowPopulation, setMegaregionShowPopulation] = useState<boolean>(true);
  const [megaregionShowTemperature, setMegaregionShowTemperature] = useState<boolean>(true);
  const [megaregionAnimating, setMegaregionAnimating] = useState<boolean>(false);
  const [useRealData, setUseRealData] = useState<boolean>(true);
  const [wetBulbOpacity, setWetBulbOpacity] = useState<number>(0.6);
  const [activeLayerIds, setActiveLayerIdsState] = useState<ClimateLayerId[]>(
    getInitialActiveLayers()
  );
  const [layerErrors, setLayerErrors] = useState<LayerError[]>([]);

  // Wrapped setActiveLayerIds to prevent accidental clearing of layers
  // This ensures layers persist across theme changes and other state resets
  const setActiveLayerIds = useCallback((layerIds: ClimateLayerId[] | ((prev: ClimateLayerId[]) => ClimateLayerId[])) => {
    setActiveLayerIdsState(prev => {
      const newLayers = typeof layerIds === 'function' ? layerIds(prev) : layerIds;

      // If trying to set empty array, check if we have stored layers to preserve
      if (newLayers.length === 0) {
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const storedLayers = JSON.parse(stored);
            if (storedLayers.length > 0) {
              console.log('🛡️ Prevented clearing layers - restoring from localStorage:', storedLayers);
              // Merge with defaults to ensure defaultActive layers are always included
              const merged = Array.from(new Set([...defaultActiveLayers, ...storedLayers]));
              return merged;
            }
          }
        } catch (error) {
          console.warn('⚠️ Failed to check localStorage when preventing layer clear:', error);
        }
      }

      return newLayers;
    });
  }, []);

  // Persist active layers to localStorage
  useEffect(() => {
    try {
      // Only store the layer IDs (strings), not the entire layer objects
      const idsOnly = activeLayerIds.filter(id => typeof id === 'string');

      // Skip saving if it would exceed quota (prevents crash loops)
      const jsonString = JSON.stringify(idsOnly);
      if (jsonString.length > 5000000) { // 5MB limit
        console.warn('⚠️ Active layers data too large, skipping localStorage save');
        return;
      }

      localStorage.setItem(STORAGE_KEY, jsonString);
      console.log('💾 Saved active layers to localStorage:', idsOnly);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('⚠️ localStorage quota exceeded, clearing ALL localStorage');
        // Clear ALL localStorage to free up space
        try {
          localStorage.clear();
          console.log('✅ localStorage cleared');
        } catch (clearError) {
          console.error('❌ Failed to clear localStorage:', clearError);
        }
      } else {
        console.error('❌ Failed to save active layers to localStorage:', error);
      }
    }
  }, [activeLayerIds]);

  // Safeguard: Restore layers from localStorage if they're unexpectedly reset
  // This ensures layers persist across theme changes and other state resets
  // Use a ref to track the last restored state to prevent infinite loops
  const lastRestoredRef = React.useRef<string>('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const storedLayers = JSON.parse(stored);
        const storedKey = JSON.stringify(storedLayers.sort());
        const currentKey = JSON.stringify([...activeLayerIds].sort());

        // Skip if we've already restored this exact state
        if (lastRestoredRef.current === storedKey && storedKey === currentKey) {
          return;
        }

        // Only restore if layers were unexpectedly cleared/reset
        const currentIsEmpty = activeLayerIds.length === 0;
        const currentIsOnlyDefaults =
          activeLayerIds.length === defaultActiveLayers.length &&
          defaultActiveLayers.every(id => activeLayerIds.includes(id)) &&
          activeLayerIds.every(id => defaultActiveLayers.includes(id));

        // If we have stored layers that are different and more comprehensive than current
        const hasStoredLayers = storedLayers.length > 0;
        const storedHasMoreLayers = storedLayers.length > activeLayerIds.length;

        // Restore if: layers were cleared OR reset to defaults when we have stored custom layers
        if (hasStoredLayers && (currentIsEmpty || (currentIsOnlyDefaults && storedHasMoreLayers))) {
          console.log('🔄 Restoring layers from localStorage after unexpected reset:', storedLayers);
          // Merge with defaults to ensure defaultActive layers are always included
          const merged = Array.from(new Set([...defaultActiveLayers, ...storedLayers]));
          lastRestoredRef.current = JSON.stringify(merged.sort());
          // Use state setter directly to bypass wrapper when intentionally restoring
          setActiveLayerIdsState(merged);
        } else {
          // Update ref to current state to prevent unnecessary checks
          lastRestoredRef.current = currentKey;
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to check/restore layers from localStorage:', error);
    }
  }, [activeLayerIds]);

  // Animation loop for megaregion time series
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (megaregionAnimating) {
      console.log('▶️ Starting animation loop');
      intervalId = setInterval(() => {
        setProjectionYear(prevYear => {
          const nextYear = prevYear + 5;
          if (nextYear > 2100) {
            return 2025;
          }
          return nextYear;
        });
      }, 1000); // Update every 1 second
    }

    return () => {
      if (intervalId) {
        console.log('ww Stopping animation loop');
        clearInterval(intervalId);
      }
    };
  }, [megaregionAnimating]);

  const addLayerError = useCallback((layerId: ClimateLayerId, error: string) => {
    const layer = climateLayers.find(l => l.id === layerId);
    const layerName = layer?.title || layerId;

    const newError: LayerError = {
      id: `${layerId}-${Date.now()}`,
      layerId,
      layerName,
      error,
      timestamp: Date.now()
    };

    setLayerErrors(prev => [...prev, newError]);
    console.error(`❌ Layer error for ${layerName}:`, error);
  }, []);

  const dismissLayerError = useCallback((errorId: string) => {
    setLayerErrors(prev => prev.filter(e => e.id !== errorId));
  }, []);

  const clearLayerErrors = useCallback((layerId?: ClimateLayerId) => {
    if (layerId) {
      setLayerErrors(prev => prev.filter(e => e.layerId !== layerId));
    } else {
      setLayerErrors([]);
    }
  }, []);

  const toggleLayer = useCallback((layerId: ClimateLayerId) => {
    setActiveLayerIds(prev => {
      if (prev.includes(layerId)) {
        // Layer is being turned off - but ensure we don't clear all layers
        const filtered = prev.filter(id => id !== layerId);
        // If this would leave us with no layers, keep at least the defaults
        if (filtered.length === 0 && defaultActiveLayers.length > 0) {
          console.log('🛡️ Prevented clearing all layers - keeping defaults');
          return [...defaultActiveLayers];
        }
        return filtered;
      }
      // Layer is being turned on - clear any previous errors for this layer
      clearLayerErrors(layerId);
      return [...prev, layerId];
    });
  }, [clearLayerErrors, setActiveLayerIds]);

  // Setters keyed by control name, so a saved snapshot can be replayed generically.
  // useState setters are referentially stable, so this map never needs to change.
  const controlSetters = useMemo(
    () => ({
      scenario: setScenario,
      projectionYear: setProjectionYear,
      seaLevelFeet: setSeaLevelFeet,
      analysisDate: setAnalysisDate,
      displayStyle: setDisplayStyle,
      resolution: setResolution,
      projectionOpacity: setProjectionOpacity,
      seaLevelOpacity: setSeaLevelOpacity,
      urbanHeatOpacity: setUrbanHeatOpacity,
      urbanHeatSeason: setUrbanHeatSeason,
      urbanHeatColorScheme: setUrbanHeatColorScheme,
      urbanExpansionOpacity: setUrbanExpansionOpacity,
      reliefStyle: setReliefStyle,
      reliefOpacity: setReliefOpacity,
      temperatureMode: setTemperatureMode,
      droughtOpacity: setDroughtOpacity,
      droughtMetric: setDroughtMetric,
      megaregionOpacity: setMegaregionOpacity,
      megaregionDataMode: setMegaregionDataMode,
      megaregionShowPopulation: setMegaregionShowPopulation,
      megaregionShowTemperature: setMegaregionShowTemperature,
      megaregionAnimating: setMegaregionAnimating,
      useRealData: setUseRealData,
      wetBulbOpacity: setWetBulbOpacity
    }) as Record<keyof ClimateControlsState, (value: never) => void>,
    []
  );

  const applyViewState = useCallback(
    (state: {
      activeLayerIds?: ClimateLayerId[];
      controls?: Partial<ClimateControlsState>;
    }) => {
      if (state.controls) {
        for (const [key, value] of Object.entries(state.controls)) {
          if (value === undefined) continue;
          // A snapshot captured mid-animation would otherwise restart the megaregion
          // loop, which ticks projectionYear every second and would immediately walk
          // the restored year forward. Restore always lands paused.
          if (key === 'megaregionAnimating') continue;
          const setter = controlSetters[key as keyof ClimateControlsState];
          if (setter) setter(value as never);
        }
        setMegaregionAnimating(false);
      }

      if (state.activeLayerIds) {
        const restored = state.activeLayerIds.filter(
          (id): id is ClimateLayerId => typeof id === 'string'
        );

        // Write storage and the watchdog marker before the state update so the
        // restore-from-localStorage effect sees a consistent world and stands down.
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(restored));
        } catch (error) {
          console.warn('WARN Failed to persist restored layers:', error);
        }
        lastRestoredRef.current = JSON.stringify([...restored].sort());

        // Bypasses the setActiveLayerIds safeguard on purpose: this is an explicit
        // user restore, not an accidental reset.
        setActiveLayerIdsState(restored);
      }
    },
    [controlSetters]
  );

  const controls: ClimateControlsState = useMemo(
    () => ({
      scenario,
      projectionYear,
      seaLevelFeet,
      analysisDate,
      displayStyle,
      resolution,
      projectionOpacity,
      seaLevelOpacity,
      urbanHeatOpacity,
      urbanHeatSeason,
      urbanHeatColorScheme,
      urbanExpansionOpacity,
      reliefStyle,
      reliefOpacity,
      temperatureMode,
      droughtOpacity,
      droughtMetric,
      megaregionOpacity,
      megaregionDataMode,
      megaregionShowPopulation,
      megaregionShowTemperature,
      megaregionAnimating,
      useRealData,
      wetBulbOpacity
    }),
    [scenario, projectionYear, seaLevelFeet, analysisDate, displayStyle, resolution, projectionOpacity, seaLevelOpacity, urbanHeatOpacity, urbanHeatSeason, urbanHeatColorScheme, urbanExpansionOpacity, reliefStyle, reliefOpacity, temperatureMode, droughtOpacity, droughtMetric, megaregionOpacity, megaregionDataMode, megaregionShowPopulation, megaregionShowTemperature, megaregionAnimating, useRealData, wetBulbOpacity]
  );

  const isLayerActive = useCallback(
    (layerId: ClimateLayerId) => activeLayerIds.includes(layerId),
    [activeLayerIds]
  );

  const value: ClimateContextValue = useMemo(
    () => ({
      controls,
      setScenario,
      setProjectionYear,
      setSeaLevelFeet,
      setAnalysisDate,
      setDisplayStyle,
      setResolution,
      setProjectionOpacity,
      setSeaLevelOpacity,
      setUrbanHeatOpacity,
      setUrbanHeatSeason,
      setUrbanHeatColorScheme,
      setUrbanExpansionOpacity,
      setReliefStyle,
      setReliefOpacity,
      setTemperatureMode,
      setDroughtOpacity,
      setDroughtMetric,
      setMegaregionOpacity,
      setMegaregionDataMode,
      setMegaregionShowPopulation,
      setMegaregionShowTemperature,
      setMegaregionAnimating,
      setUseRealData,
      setWetBulbOpacity,
      activeLayerIds,
      setActiveLayerIds,
      applyViewState,
      toggleLayer,
      isLayerActive,
      layerErrors,
      addLayerError,
      dismissLayerError,
      clearLayerErrors
    }),
    [
      controls,
      activeLayerIds,
      applyViewState,
      toggleLayer,
      isLayerActive,
      layerErrors,
      addLayerError,
      dismissLayerError,
      clearLayerErrors
    ]
  );

  return <ClimateContext.Provider value={value}>{children}</ClimateContext.Provider>;
};

export const useClimate = (): ClimateContextValue => {
  const context = useContext(ClimateContext);
  if (!context) {
    throw new Error('useClimate must be used within a ClimateProvider');
  }
  return context;
};
