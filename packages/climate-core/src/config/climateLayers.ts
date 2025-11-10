import { LatLngBoundsLiteral } from '../types/geography';

export type ClimateLayerId =
  | 'sea_level_rise'
  | 'temperature_projection'
  | 'temperature_current'
  | 'urban_heat_island'
  | 'urban_expansion'
  | 'topographic_relief'
  | 'precipitation_drought';

export type ClimateControl =
  | 'seaLevelFeet'
  | 'scenario'
  | 'projectionYear'
  | 'analysisDate'
  | 'displayStyle'
  | 'resolution'
  | 'projectionOpacity'
  | 'seaLevelOpacity'
  | 'urbanHeatOpacity'
  | 'urbanHeatSeason'
  | 'urbanHeatColorScheme'
  | 'urbanExpansionOpacity'
  | 'reliefStyle'
  | 'reliefOpacity'
  | 'temperatureMode'
  | 'droughtOpacity'
  | 'droughtMetric';

export interface ClimateFetchContext {
  bounds: LatLngBoundsLiteral | null;
  scenario: string;
  projectionYear: number;
  seaLevelFeet: number;
  analysisDate: string;
  displayStyle: 'depth' | 'confidence';
  resolution: number;
  projectionOpacity: number;
  urbanHeatSeason: 'summer' | 'winter';
  urbanHeatColorScheme: 'temperature' | 'heat' | 'urban';
  urbanExpansionOpacity: number;
  reliefStyle: 'classic' | 'dark' | 'depth' | 'dramatic';
  reliefOpacity: number;
  temperatureMode: 'anomaly' | 'actual';
  droughtOpacity: number;
  droughtMetric: 'precipitation' | 'drought_index' | 'soil_moisture';
  useRealData: boolean;
}

export interface ClimateLayerDefinition {
  id: ClimateLayerId;
  title: string;
  description: string;
  category: 'coastal' | 'temperature' | 'topography';
  source: {
    name: string;
    url?: string;
  };
  defaultActive?: boolean;
  controls: ClimateControl[];
  fetch: {
    method: 'GET' | 'POST';
    route: string;
    /**
     * Build query parameters using the current climate control context.
     */
    query: (context: ClimateFetchContext) => Record<string, string | number | boolean>;
  };
  style: {
    color: string;
    opacity: number;
    layerType: 'point' | 'polygon' | 'heat' | 'raster';
    blendMode?: string;
    valueProperty?: string;
  };
}

export const climateLayers: ClimateLayerDefinition[] = [
  {
    id: 'sea_level_rise',
    title: 'Sea Level Rise',
    description: 'NOAA sea level rise depth grid showing coastal flooding areas based on projection year.',
    category: 'coastal',
    source: {
      name: 'NOAA Sea Level Rise Viewer',
      url: 'https://coast.noaa.gov/slr/'
    },
    defaultActive: false,
    controls: ['seaLevelOpacity'],
    fetch: {
      method: 'GET',
      route: '/api/tiles/noaa-slr-metadata',
      query: ({ projectionYear }) => {
        // Convert projection year to sea level feet using NOAA projections
        // 2025: 1ft, 2050: 3ft, 2075: 6ft, 2100: 10ft (intermediate scenario)
        const yearToFeet = (year: number): number => {
          if (year <= 2025) return 1;
          if (year >= 2100) return 10;
          // Linear interpolation between milestones
          return Math.round(1 + ((year - 2025) / (2100 - 2025)) * 9);
        };

        return {
          feet: yearToFeet(projectionYear ?? 2050)
        };
      }
    },
    style: {
      color: '#38bdf8',
      opacity: 0.8,
      layerType: 'raster',
      blendMode: 'normal',
      valueProperty: 'depth'
    }
  },
  {
    id: 'temperature_projection',
    title: 'Future Temperature Anomaly',
    description: 'Projected temperature anomalies from NASA NEX-GDDP-CMIP6 climate models via Earth Engine.',
    category: 'temperature',
    source: {
      name: 'NASA NEX-GDDP-CMIP6',
      url: 'https://www.nccs.nasa.gov/services/data-collections'
    },
    defaultActive: false,
    controls: ['temperatureMode', 'projectionOpacity'],
    fetch: {
      method: 'GET',
      route: '/api/climate/temperature-projection/tiles',
      query: ({ bounds, projectionYear, scenario, temperatureMode }) => {
        const { north, south, east, west } = bounds ?? {
          north: 41,
          south: 40,
          east: -73,
          west: -74
        };
        return {
          north,
          south,
          east,
          west,
          year: projectionYear,
          scenario,
          mode: temperatureMode
        };
      }
    },
    style: {
      color: '#fb923c',
      opacity: 0.6,
      layerType: 'raster',
      blendMode: 'screen',
      valueProperty: 'tempAnomaly'
    }
  },
  // Hidden layer - Current Surface Temperature
  // {
  //   id: 'temperature_current',
  //   title: 'Current Surface Temperature',
  //   description: 'NASA GISTEMP climatology derived from NASA POWER.',
  //   category: 'temperature',
  //   source: {
  //     name: 'NASA GISTEMP',
  //     url: 'https://data.giss.nasa.gov/gistemp/'
  //   },
  //   controls: ['resolution'],
  //   fetch: {
  //     method: 'GET',
  //     route: '/api/nasa/temperature',
  //     query: ({ bounds, resolution }) => {
  //       const { north, south, east, west } = bounds ?? {
  //         north: 90,
  //         south: -90,
  //         east: 180,
  //         west: -180
  //       };
  //       return {
  //         north,
  //         south,
  //         east,
  //         west,
  //         resolution
  //       };
  //     }
  //   },
  //   style: {
  //     color: '#ef4444',
  //     opacity: 0.5,
  //     layerType: 'point',
  //     blendMode: 'screen',
  //     valueProperty: 'temperature'
  //   }
  // },
  {
    id: 'urban_heat_island',
    title: 'Urban Heat Island',
    description: 'Global urban heat island intensity (2003-2018) from Yale YCEO showing temperature differences between urban and rural areas. Based on MODIS land surface temperature at 300m resolution.',
    category: 'temperature',
    source: {
      name: 'Yale YCEO Summer UHI v4',
      url: 'https://developers.google.com/earth-engine/datasets/catalog/YALE_YCEO_UHI_Summer_UHI_yearly_pixel_v4'
    },
    defaultActive: false,
    controls: ['urbanHeatOpacity'],
    fetch: {
      method: 'GET',
      route: '/api/climate/urban-heat-island/tiles',
      query: ({ bounds, urbanHeatSeason, urbanHeatColorScheme }) => {
        const { north, south, east, west } = bounds ?? {
          north: 41,
          south: 40,
          east: -73,
          west: -74
        };
        return {
          north,
          south,
          east,
          west,
          season: urbanHeatSeason,
          color_scheme: urbanHeatColorScheme
        };
      }
    },
    style: {
      color: '#facc15',
      opacity: 0.7,
      layerType: 'raster',
      blendMode: 'normal',
      valueProperty: 'heatIslandIntensity'
    }
  },
  {
    id: 'urban_expansion',
    title: 'Conceptual Urban Growth',
    description: '⚠️ CONCEPTUAL VISUALIZATION: Shows simplified urban expansion as translucent orange circles growing outward from current cities. Circle size increases as you move the year slider (2025→2100), representing potential metropolitan growth. Larger cities grow faster. For educational purposes only.',
    category: 'temperature',
    source: {
      name: 'GHSL 2023 Circular Buffers',
      url: 'https://ghsl.jrc.ec.europa.eu/'
    },
    defaultActive: false,
    controls: ['urbanExpansionOpacity'],
    fetch: {
      method: 'GET',
      route: '/api/climate/urban-expansion/tiles',
      query: ({ bounds, projectionYear, scenario }) => {
        const { north, south, east, west } = bounds ?? {
          north: 41,
          south: 40,
          east: -73,
          west: -74
        };
        return {
          north,
          south,
          east,
          west,
          year: projectionYear,
          scenario
        };
      }
    },
    style: {
      color: '#ff8c00',
      opacity: 0.2,  // 20% opacity
      layerType: 'polygon',  // GeoJSON polygons (circles)
      blendMode: 'normal',
      valueProperty: 'tier'
    }
  },
  {
    id: 'precipitation_drought',
    title: 'Precipitation & Drought',
    description: 'Projected precipitation changes and drought conditions from CHIRPS dataset via Earth Engine.',
    category: 'temperature',
    source: {
      name: 'CHIRPS via Earth Engine',
      url: 'https://www.chc.ucsb.edu/data/chirps'
    },
    defaultActive: false,
    controls: ['droughtMetric', 'droughtOpacity'],
    fetch: {
      method: 'GET',
      route: '/api/climate/precipitation-drought/tiles',
      query: ({ bounds, scenario, projectionYear, droughtMetric }) => {
        const { north, south, east, west } = bounds ?? {
          north: 41,
          south: 40,
          east: -73,
          west: -74
        };
        return {
          north,
          south,
          east,
          west,
          scenario,
          year: projectionYear,
          metric: droughtMetric
        };
      }
    },
    style: {
      color: '#3b82f6',
      opacity: 0.7,
      layerType: 'raster',
      blendMode: 'normal',
      valueProperty: 'value'
    }
  },
  {
    id: 'topographic_relief',
    title: 'Topographic Relief',
    description: 'Hillshade terrain visualization from SRTM/Copernicus DEM showing 3D relief with customizable lighting styles.',
    category: 'topography',
    source: {
      name: 'Google Earth Engine (SRTM/Copernicus DEM)',
      url: 'https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_DEM_GLO30'
    },
    defaultActive: true,
    controls: ['reliefStyle', 'reliefOpacity'],
    fetch: {
      method: 'GET',
      route: '/api/climate/topographic-relief/tiles',
      query: ({ bounds, reliefStyle }) => {
        const { north, south, east, west } = bounds ?? {
          north: 41,
          south: 40,
          east: -73,
          west: -74
        };
        return {
          north,
          south,
          east,
          west,
          style: reliefStyle
        };
      }
    },
    style: {
      color: '#64748b',
      opacity: 0.7,
      layerType: 'raster',
      blendMode: 'multiply',
      valueProperty: 'elevation'
    }
  }
];

export const getClimateLayer = (id: ClimateLayerId) =>
  climateLayers.find(layer => layer.id === id);

