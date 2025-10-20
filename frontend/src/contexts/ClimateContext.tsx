import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
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
  reliefStyle: 'classic' | 'dark' | 'depth' | 'dramatic';
  reliefOpacity: number;
  temperatureMode: 'anomaly' | 'actual';
  useRealData: boolean;
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
  setReliefStyle: (style: 'classic' | 'dark' | 'depth' | 'dramatic') => void;
  setReliefOpacity: (value: number) => void;
  setTemperatureMode: (mode: 'anomaly' | 'actual') => void;
  setUseRealData: (value: boolean) => void;
  activeLayerIds: ClimateLayerId[];
  setActiveLayerIds: (layerIds: ClimateLayerId[]) => void;
  toggleLayer: (layerId: ClimateLayerId) => void;
  isLayerActive: (layerId: ClimateLayerId) => boolean;
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

export const ClimateProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [scenario, setScenario] = useState<string>('rcp45');
  const [projectionYear, setProjectionYear] = useState<number>(2050);
  const [seaLevelFeet, setSeaLevelFeet] = useState<number>(3);
  const [analysisDate, setAnalysisDate] = useState<string>(getDefaultAnalysisDate());
  const [displayStyle, setDisplayStyle] = useState<DisplayStyle>('depth');
  const [resolution, setResolution] = useState<number>(1);
  const [projectionOpacity, setProjectionOpacity] = useState<number>(0.15);
  const [seaLevelOpacity, setSeaLevelOpacity] = useState<number>(0.6);
  const [urbanHeatOpacity, setUrbanHeatOpacity] = useState<number>(0.7);
  const [urbanHeatSeason, setUrbanHeatSeason] = useState<'summer' | 'winter'>('summer');
  const [urbanHeatColorScheme, setUrbanHeatColorScheme] = useState<'temperature' | 'heat' | 'urban'>('temperature');
  const [reliefStyle, setReliefStyle] = useState<'classic' | 'dark' | 'depth' | 'dramatic'>('classic');
  const [reliefOpacity, setReliefOpacity] = useState<number>(0.7);
  const [temperatureMode, setTemperatureMode] = useState<'anomaly' | 'actual'>('anomaly');
  const [useRealData, setUseRealData] = useState<boolean>(true);
  const [activeLayerIds, setActiveLayerIds] = useState<ClimateLayerId[]>(
    defaultActiveLayers.length > 0 ? defaultActiveLayers : []
  );

  const toggleLayer = useCallback((layerId: ClimateLayerId) => {
    setActiveLayerIds(prev => {
      if (prev.includes(layerId)) {
        return prev.filter(id => id !== layerId);
      }
      return [...prev, layerId];
    });
  }, []);

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
      reliefStyle,
      reliefOpacity,
      temperatureMode,
      useRealData
    }),
    [scenario, projectionYear, seaLevelFeet, analysisDate, displayStyle, resolution, projectionOpacity, seaLevelOpacity, urbanHeatOpacity, urbanHeatSeason, urbanHeatColorScheme, reliefStyle, reliefOpacity, temperatureMode, useRealData]
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
      setReliefStyle,
      setReliefOpacity,
      setTemperatureMode,
      setUseRealData,
      activeLayerIds,
      setActiveLayerIds,
      toggleLayer,
      isLayerActive
    }),
    [
      controls,
      activeLayerIds,
      toggleLayer,
      isLayerActive
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
