# Sustainable Urban Studio - Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React + TypeScript)                      │
│                         http://localhost:8082 (Vite)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      UI Layer (Components)                            │  │
│  │                                                                        │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │  │
│  │  │ GISAnalysis  │  │ CesiumGlobe  │  │    LayerPanel            │  │  │
│  │  │    App       │  │  (3D Globe)  │  │  - Climate Layers        │  │  │
│  │  │              │  │              │  │  - Layer Controls        │  │  │
│  │  │  - Map View  │  │  - Mapbox GL │  │  - Loading States        │  │  │
│  │  │  - Controls  │  │  - Cesium    │  │  - Cache Status          │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │  │
│  │                                                                        │  │
│  └────────────────────────────────────┬───────────────────────────────────┘  │
│                                        │                                      │
│  ┌────────────────────────────────────▼───────────────────────────────────┐  │
│  │                      State Management Layer                            │  │
│  │                                                                        │  │
│  │  ┌──────────────────────┐        ┌──────────────────────────────┐   │  │
│  │  │  ClimateContext      │        │  useClimateLayerData         │   │  │
│  │  │                      │        │                              │   │  │
│  │  │  - scenario          │        │  - fetchLayer()              │   │  │
│  │  │  - projectionYear    │        │  - In-Memory Cache           │   │  │
│  │  │  - reliefStyle       │        │  - LocalStorage Cache        │   │  │
│  │  │  - urbanHeatSeason   │        │  - Cache Expiration          │   │  │
│  │  │  - activeLayerIds    │        │  - Loading States            │   │  │
│  │  │  - opacity values    │        │                              │   │  │
│  │  └──────────────────────┘        └──────────────────────────────┘   │  │
│  │                                                                        │  │
│  └────────────────────────────────────┬───────────────────────────────────┘  │
│                                        │                                      │
│  ┌────────────────────────────────────▼───────────────────────────────────┐  │
│  │                    Configuration Layer                                 │  │
│  │                                                                        │  │
│  │  ┌──────────────────────────────────────────────────────────────┐    │  │
│  │  │  climateLayers.ts                                            │    │  │
│  │  │                                                              │    │  │
│  │  │  Layer Definitions:                                          │    │  │
│  │  │  - sea_level_rise           (NOAA)                          │    │  │
│  │  │  - temperature_projection   (NASA NEX-GDDP-CMIP6)          │    │  │
│  │  │  - urban_heat_island        (Landsat 8/9 LST)              │    │  │
│  │  │  - topographic_relief       (SRTM/Copernicus DEM)          │    │  │
│  │  │                                                              │    │  │
│  │  │  Each layer has:                                             │    │  │
│  │  │  - fetch.route (API endpoint)                                │    │  │
│  │  │  - fetch.query() (builds params)                             │    │  │
│  │  │  - controls (UI controls)                                    │    │  │
│  │  │  - style (color, opacity, blendMode)                         │    │  │
│  │  └──────────────────────────────────────────────────────────────┘    │  │
│  │                                                                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
└───────────────────────────────────┬───────────────────────────────────────────┘
                                    │
                                    │ HTTP Requests
                                    │ GET /api/climate/*
                                    │
┌───────────────────────────────────▼───────────────────────────────────────────┐
│                         BACKEND (Express.js)                                  │
│                      http://localhost:3001 (Node.js)                          │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         API Gateway                                   │  │
│  │                                                                        │  │
│  │  Routes:                                                               │  │
│  │  - Proxies requests to Climate Server                                 │  │
│  │  - CORS handling                                                       │  │
│  │  - Request validation                                                  │  │
│  │                                                                        │  │
│  └────────────────────────────────┬───────────────────────────────────────┘  │
│                                    │                                          │
└────────────────────────────────────┼──────────────────────────────────────────┘
                                     │
                                     │ HTTP Proxy
                                     │ Forward to :5001
                                     │
┌────────────────────────────────────▼──────────────────────────────────────────┐
│                    CLIMATE SERVER (Flask + Python)                            │
│                      http://localhost:5001 (Python 3)                         │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         Flask API Routes                              │  │
│  │                                                                        │  │
│  │  GET /api/climate/temperature-projection                              │  │
│  │  GET /api/climate/sea-level-rise                                      │  │
│  │  GET /api/climate/urban-heat-island/tiles                             │  │
│  │  GET /api/climate/topographic-relief/tiles                            │  │
│  │  GET /health                                                           │  │
│  │                                                                        │  │
│  └────────────────────────────────┬───────────────────────────────────────┘  │
│                                    │                                          │
│  ┌────────────────────────────────▼───────────────────────────────────────┐  │
│  │                      Service Layer                                     │  │
│  │                                                                        │  │
│  │  ┌──────────────────────┐  ┌─────────────────────────────────────┐  │  │
│  │  │ NASAEEClimateService │  │  NOAASeaLevelService                │  │  │
│  │  │                      │  │                                     │  │  │
│  │  │ - Earth Engine Init  │  │  - NOAA SLR Grid API               │  │  │
│  │  │ - Dataset Filtering  │  │  - Hexagon Generation              │  │  │
│  │  │ - Hexagon Tessellation│ │  - Depth Grid Processing           │  │  │
│  │  │ - Temp Calculations  │  │                                     │  │  │
│  │  │ - GeoJSON Conversion │  │                                     │  │  │
│  │  └──────────────────────┘  └─────────────────────────────────────┘  │  │
│  │                                                                        │  │
│  │  ┌─────────────────────────┐  ┌──────────────────────────────────┐  │  │
│  │  │ UrbanHeatIslandService  │  │  TopographicReliefService        │  │  │
│  │  │                         │  │                                  │  │  │
│  │  │ - Landsat LST Data      │  │  - SRTM/Copernicus DEM          │  │  │
│  │  │ - Seasonal Filtering    │  │  - Hillshade Generation         │  │  │
│  │  │ - Color Schemes         │  │  - Lighting Styles              │  │  │
│  │  │ - Tile URL Generation   │  │  - Tile URL Generation          │  │  │
│  │  └─────────────────────────┘  └──────────────────────────────────┘  │  │
│  │                                                                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
└───────────────────────────────┬───────────────────────────────────────────────┘
                                │
                                │ Google Earth Engine API
                                │ NASA Data Requests
                                │
┌───────────────────────────────▼───────────────────────────────────────────────┐
│                         EXTERNAL DATA SOURCES                                 │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐  │
│  │ Google Earth Engine  │  │   NOAA Sea Level     │  │  Landsat 8/9     │  │
│  │                      │  │   Rise Viewer API    │  │  LST Data        │  │
│  │ - NASA NEX-GDDP-     │  │                      │  │                  │  │
│  │   CMIP6 (Climate)    │  │ - Coastal Inundation │  │ - Surface Temp   │  │
│  │ - Copernicus DEM     │  │ - Depth Grids        │  │ - Thermal Data   │  │
│  │ - SRTM Elevation     │  │                      │  │                  │  │
│  │                      │  │                      │  │                  │  │
│  └──────────────────────┘  └──────────────────────┘  └──────────────────┘  │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════
                              DATA FLOW EXAMPLE
═══════════════════════════════════════════════════════════════════════════════

User clicks "Future Temperature Anomaly" layer:

1. LayerPanel → toggleLayer('temperature_projection')
2. ClimateContext → setActiveLayerIds([..., 'temperature_projection'])
3. useClimateLayerData → fetchLayer('temperature_projection')
4. Check Cache:
   - In-Memory Cache (Map) → MISS
   - LocalStorage Cache → MISS
5. Build Request:
   - climateLayers.ts → fetch.query(context)
   - Params: {north: 41, south: 40, east: -73, west: -74,
              year: 2050, scenario: 'rcp45', resolution: 7}
6. HTTP Request:
   GET http://localhost:3001/api/climate/temperature-projection?...
7. Backend Proxy → Forward to Climate Server
   GET http://localhost:5001/api/climate/temperature-projection?...
8. Climate Server (climate_server.py):
   - Validate params
   - Call NASAEEClimateService.get_temperature_projection()
9. NASAEEClimateService:
   - Initialize Earth Engine (ee.Initialize)
   - Filter NASA/GDDP-CMIP6 dataset:
     * model: ACCESS-CM2
     * scenario: ssp245 (mapped from rcp45)
     * year: 2050
   - Generate H3 hexagons at resolution 7 for bounds
   - Use ee.reduceRegions() to compute mean temp per hexagon
   - Convert Kelvin → Celsius → Anomaly
   - Build GeoJSON FeatureCollection
10. Response → Backend → Frontend
11. Cache Response:
    - Save to In-Memory Map
    - Save to LocalStorage (expires in 1 hour)
12. Update State:
    - setLayerState(layerId, {status: 'success', data: geojson})
13. CesiumGlobe receives layerStates prop
14. Render hexagons on globe with temperature colors


═══════════════════════════════════════════════════════════════════════════════
                            CACHING STRATEGY
═══════════════════════════════════════════════════════════════════════════════

Cache Key Format:
  "{layerId}:{JSON.stringify(params)}"

Example:
  "temperature_projection:{"north":41,"south":40,"east":-73,"west":-74,
   "year":2050,"scenario":"rcp45","resolution":7}"

Cache Expiration Times:
  - temperature_projection: 1 hour
  - sea_level_rise: 24 hours
  - urban_heat_island: 1 hour
  - topographic_relief: 7 days

Storage:
  1. In-Memory (Map) - Fast, cleared on page refresh
  2. LocalStorage - Persistent, survives page refresh

On Request:
  1. Check In-Memory → if valid, return immediately
  2. Check LocalStorage → if valid, restore to In-Memory, return
  3. Fetch from API → save to both caches


═══════════════════════════════════════════════════════════════════════════════
                         KEY TECHNOLOGIES
═══════════════════════════════════════════════════════════════════════════════

Frontend:
  - React 18 + TypeScript
  - Vite (build tool)
  - Cesium (3D globe)
  - Mapbox GL (2D maps)
  - Tailwind CSS (styling)
  - Context API (state management)

Backend:
  - Express.js (Node.js)
  - Flask (Python)
  - Google Earth Engine Python API
  - h3-py (Uber H3 hexagonal grid library)

Data Processing:
  - H3 Hexagonal Grids (Uber's geospatial indexing)
  - GeoJSON (geographic data format)
  - Earth Engine reduceRegions (statistical analysis)

Data Sources:
  - NASA NEX-GDDP-CMIP6 (climate projections)
  - NOAA Sea Level Rise (coastal flooding)
  - Landsat 8/9 (thermal imagery)
  - Copernicus DEM / SRTM (elevation)
```
