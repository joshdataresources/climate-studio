import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ClimateLayerId, climateLayers } from '../config/climateLayers';

type DisplayStyle = 'depth' | 'confidence';

interface ClimateControlsState {
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
  droughtMetric: 'precipitation' | 'drought_index' | 'soil_moisture';
  megaregionOpacity: number;
  megaregionAnimating: boolean;
  useRealData: boolean;
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
  setDroughtMetric: (metric: 'precipitation' | 'drought_index' | 'soil_moisture') => void;
  setMegaregionOpacity: (value: number) => void;
  setMegaregionAnimating: (value: boolean) => void;
  setUseRealData: (value: boolean) => void;
  activeLayerIds: ClimateLayerId[];
  setActiveLayerIds: (layerIds: ClimateLayerId[]) => void;
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
  const [droughtMetric, setDroughtMetric] = useState<'precipitation' | 'drought_index' | 'soil_moisture'>('drought_index');
  const [megaregionOpacity, setMegaregionOpacity] = useState<number>(0.5);
  const [megaregionAnimating, setMegaregionAnimating] = useState<boolean>(false);
  const [useRealData, setUseRealData] = useState<boolean>(true);
  const [activeLayerIds, setActiveLayerIds] = useState<ClimateLayerId[]>(
    getInitialActiveLayers()
  );
  const [layerErrors, setLayerErrors] = useState<LayerError[]>([]);

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
        // Layer is being turned off
        return prev.filter(id => id !== layerId);
      }
      // Layer is being turned on - clear any previous errors for this layer
      clearLayerErrors(layerId);
      return [...prev, layerId];
    });
  }, [clearLayerErrors]);

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
      megaregionAnimating,
      useRealData
    }),
    [scenario, projectionYear, seaLevelFeet, analysisDate, displayStyle, resolution, projectionOpacity, seaLevelOpacity, urbanHeatOpacity, urbanHeatSeason, urbanHeatColorScheme, urbanExpansionOpacity, reliefStyle, reliefOpacity, temperatureMode, droughtOpacity, droughtMetric, megaregionOpacity, megaregionAnimating, useRealData]
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
      setMegaregionAnimating,
      setUseRealData,
      activeLayerIds,
      setActiveLayerIds,
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
