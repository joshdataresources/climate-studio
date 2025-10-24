import { LatLngBoundsLiteral } from '../types/geography';

export type ClimateLayerId =
  | 'sea_level_rise'
  | 'temperature_projection'
  | 'temperature_current'
  | 'urban_heat_island'
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
    description: 'NOAA sea level rise depth grid showing coastal flooding areas.',
    category: 'coastal',
    source: {
      name: 'NOAA Sea Level Rise Viewer',
      url: 'https://coast.noaa.gov/slr/'
    },
    defaultActive: false,
    controls: ['seaLevelFeet', 'seaLevelOpacity'],
    fetch: {
      method: 'GET',
      route: '/api/tiles/noaa-slr-metadata',
      query: ({ seaLevelFeet }) => {
        // Sea level uses direct NOAA tile URLs, no data fetch needed
        // This endpoint just validates the tiles are available
        return {
          feet: seaLevelFeet ?? 3
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
    controls: ['scenario', 'projectionYear', 'temperatureMode', 'projectionOpacity'],
    fetch: {
      method: 'GET',
      route: '/api/climate/temperature-projection',
      query: ({ bounds, projectionYear, scenario, useRealData }) => {
        const { north, south, east, west, zoom } = bounds ?? {
          north: 41,
          south: 40,
          east: -73,
          west: -74,
          zoom: 10
        };

        // Dynamic hexagon sizing based on zoom level
        // Lower zoom = larger hexagons (lower resolution)
        // Higher zoom = smaller hexagons (higher resolution)
        const z = zoom || 10;

        let resolution;
        if (z <= 3) {
          resolution = 2;  // Continental - very large hexagons
        } else if (z <= 5) {
          resolution = 3;  // Multi-country - large hexagons
        } else if (z <= 7) {
          resolution = 4;  // Country/state - medium-large hexagons
        } else if (z <= 9) {
          resolution = 5;  // Regional - medium hexagons
        } else if (z <= 11) {
          resolution = 6;  // Metropolitan - small hexagons
        } else if (z <= 13) {
          resolution = 7;  // City - smaller hexagons
        } else {
          resolution = 8;  // Neighborhood - very small hexagons
        }

        console.log(`🔷 Zoom ${z.toFixed(1)} → H3 resolution ${resolution}`);

        return {
          north,
          south,
          east,
          west,
          year: projectionYear,
          scenario,
          resolution,
          zoom
        };
      }
    },
    style: {
      color: '#fb923c',
      opacity: 0.6,
      layerType: 'polygon',
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
    description: 'Land surface temperature from Landsat 8/9 showing heat patterns globally. Compare summer vs winter and customize colors.',
    category: 'temperature',
    source: {
      name: 'Landsat 8/9 LST',
      url: 'https://developers.google.com/earth-engine/datasets/catalog/LANDSAT_LC08_C02_T1_L2'
    },
    defaultActive: true,
    controls: ['urbanHeatSeason', 'urbanHeatColorScheme', 'urbanHeatOpacity'],
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
    id: 'precipitation_drought',
    title: 'Precipitation & Drought',
    description: 'Projected precipitation changes and drought conditions from CHIRPS dataset via Earth Engine.',
    category: 'temperature',
    source: {
      name: 'CHIRPS via Earth Engine',
      url: 'https://www.chc.ucsb.edu/data/chirps'
    },
    defaultActive: false,
    controls: ['scenario', 'projectionYear', 'droughtMetric', 'droughtOpacity'],
    fetch: {
      method: 'GET',
      route: '/api/climate/precipitation-drought',
      query: ({ bounds, scenario, projectionYear, droughtMetric }) => {
        const { north, south, east, west, zoom } = bounds ?? {
          north: 41,
          south: 40,
          east: -73,
          west: -74,
          zoom: 10
        };

        // Dynamic hexagon sizing based on zoom level
        const z = zoom || 10;
        let resolution;
        if (z <= 3) {
          resolution = 2;
        } else if (z <= 5) {
          resolution = 3;
        } else if (z <= 7) {
          resolution = 4;
        } else if (z <= 9) {
          resolution = 5;
        } else if (z <= 11) {
          resolution = 6;
        } else if (z <= 13) {
          resolution = 7;
        } else {
          resolution = 8;
        }

        console.log(`🌧️ Zoom ${z.toFixed(1)} → H3 resolution ${resolution} for precipitation/drought`);

        return {
          north,
          south,
          east,
          west,
          scenario,
          year: projectionYear,
          metric: droughtMetric,
          resolution
        };
      }
    },
    style: {
      color: '#3b82f6',
      opacity: 0.7,
      layerType: 'polygon',
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
    defaultActive: false,
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
