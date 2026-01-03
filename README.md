# Climate Suite - Sustainable Urban Studio

A comprehensive monorepo for climate visualization and analysis, featuring interactive maps, climate projections, and water access monitoring.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Monorepo Structure](#monorepo-structure)
- [Development](#development)
- [Deployment](#deployment)
- [API Documentation](#api-documentation)
- [Climate Layers](#climate-layers)
- [Troubleshooting](#troubleshooting)

## Overview

Climate Suite is a full-stack application for visualizing and analyzing climate data, including:

- **Climate Projections**: NASA NEX-GDDP-CMIP6 temperature projections
- **Sea Level Rise**: NOAA coastal inundation data
- **Urban Heat Island**: Landsat 8/9 thermal imagery
- **Topographic Relief**: SRTM/Copernicus elevation data
- **Water Access**: USGS aquifer monitoring and projections
- **Population Migration**: Megaregion formation visualization

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + TypeScript)            │
│                    http://localhost:8080 (Vite)              │
├─────────────────────────────────────────────────────────────┤
│  UI Layer: GISAnalysisApp, DeckGLMap, WaterAccessView       │
│  State: ClimateContext, MapContext, ThemeContext            │
│  Data: useClimateLayerData (with caching)                   │
└───────────────────────────┬─────────────────────────────────┘
                             │ HTTP Requests
                             │ GET /api/climate/*
┌───────────────────────────▼─────────────────────────────────┐
│                    BACKEND (Express.js)                     │
│                 http://localhost:3001 (Node.js)              │
│  - API Gateway / Proxy                                      │
│  - CORS handling                                            │
│  - Request validation                                       │
└───────────────────────────┬─────────────────────────────────┘
                             │ HTTP Proxy
                             │ Forward to :5001
┌───────────────────────────▼─────────────────────────────────┐
│              CLIMATE SERVER (Flask + Python)               │
│              http://localhost:5001 (Python 3)               │
│  - Earth Engine Integration                                │
│  - Climate Data Processing                                 │
│  - Tile Generation                                          │
└───────────────────────────┬─────────────────────────────────┘
                             │ External APIs
┌───────────────────────────▼─────────────────────────────────┐
│                  EXTERNAL DATA SOURCES                      │
│  - Google Earth Engine (NASA NEX-GDDP-CMIP6)               │
│  - NOAA Sea Level Rise Viewer API                          │
│  - Landsat 8/9 LST Data                                    │
│  - SRTM/Copernicus DEM                                      │
└─────────────────────────────────────────────────────────────┘
```

### Key Technologies

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- Deck.gl (data visualization)
- Mapbox GL (mapping)
- Tailwind CSS (styling)

**Backend:**
- Express.js (Node.js API gateway)
- Flask (Python climate service)
- Google Earth Engine Python API
- h3-py (hexagonal grid library)

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Python 3.8+
- Google Earth Engine account (for climate data)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/joshdataresources/climate-studio.git
cd climate-suite
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
# Frontend (.env in apps/climate-studio/)
VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_token
VITE_API_URL=http://localhost:3001

# Backend (.env in backend/)
CLIMATE_SERVICE_URL=http://host.docker.internal:5001
DATABASE_URL=postgresql://postgres:password@localhost:5432/urban_studio

# Python Service (.env in qgis-processing/)
EARTHENGINE_PROJECT=your-ee-project
PORT=5001
```

4. Authenticate with Google Earth Engine:
```bash
cd qgis-processing
earthengine authenticate
```

## Monorepo Structure

```
climate-suite/
├── apps/
│   ├── climate-studio/      # Main climate visualization app
│   └── navigation/           # Navigation shell app
├── packages/
│   └── climate-core/        # Shared climate components and contexts
├── backend/                  # Node.js API gateway
├── qgis-processing/         # Python climate data service
└── docker-compose.yml       # Multi-service orchestration
```

### Workspace Scripts

```bash
# Development
npm run dev:studio           # Run Climate Studio app
npm run dev:backend          # Run backend server
npm run dev:shared           # Watch shared package

# Building
npm run build:studio         # Build Climate Studio
npm run build:shared         # Build shared package
```

## Development

### Starting Services

**1. Frontend (Climate Studio):**
```bash
npm run dev:studio
# Runs on http://localhost:8080
```

**2. Backend (Node.js API):**
```bash
cd backend
npm start
# Runs on http://localhost:3001
```

**3. Climate Service (Python):**
```bash
cd qgis-processing
PORT=5001 python3 climate_server.py
# Runs on http://localhost:5001
```

**4. Using Docker Compose:**
```bash
docker-compose up -d
# Starts all services
```

### Climate Layers

The application supports multiple climate data layers:

1. **Temperature Projection** (`temperature_projection`)
   - Source: NASA NEX-GDDP-CMIP6
   - Shows future temperature anomalies
   - Configurable: RCP scenario, projection year

2. **Sea Level Rise** (`sea_level_rise`)
   - Source: NOAA Sea Level Rise Viewer
   - Shows coastal inundation scenarios
   - Configurable: Sea level rise amount

3. **Urban Heat Island** (`urban_heat_island`)
   - Source: Landsat 8/9 LST
   - Shows surface temperature patterns
   - Configurable: Season filter

4. **Topographic Relief** (`topographic_relief`)
   - Source: SRTM/Copernicus DEM
   - Shows elevation and terrain
   - Configurable: Lighting style

5. **Population Migration** (`megaregion_timeseries`)
   - Shows population migration patterns
   - Configurable: Projection year, opacity

### Caching Strategy

Climate layer data is cached for performance:

- **In-Memory Cache**: Fast access, cleared on page refresh
- **LocalStorage Cache**: Persistent, survives page refresh
- **Expiration Times**:
  - Temperature: 1 hour
  - Sea Level Rise: 24 hours
  - Urban Heat Island: 1 hour
  - Topographic Relief: 7 days

Cache keys: `"{layerId}:{JSON.stringify(params)}"`

## Deployment

### Vercel (Frontend)

1. Set Root Directory in Vercel to: `apps/climate-studio`
2. Configure environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

Configuration (`apps/climate-studio/vercel.json`):
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "cd ../.. && npm install",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Backend Services

**Node.js Backend (Railway/Render):**
- Root Directory: `backend`
- Start Command: `node server.js`
- Port: Auto-assigned (use `process.env.PORT`)

**Python Climate Service (Render):**
- Root Directory: `qgis-processing`
- Build Command: `pip install -r requirements.txt`
- Start Command: `python climate_server.py`
- Environment: `PORT=5001`, `EARTHENGINE_PROJECT=...`

### Environment Variables

**Production Frontend:**
```
VITE_MAPBOX_ACCESS_TOKEN=...
VITE_API_URL=https://your-backend.railway.app
```

**Production Backend:**
```
CLIMATE_SERVICE_URL=https://your-python-service.onrender.com
DATABASE_URL=...
```

## API Documentation

### Climate Endpoints

**Temperature Projection:**
```
GET /api/climate/temperature-projection
Query: north, south, east, west, year, scenario, resolution
```

**Sea Level Rise:**
```
GET /api/climate/sea-level-rise
Query: north, south, east, west, seaLevel
```

**Urban Heat Island:**
```
GET /api/climate/urban-heat-island/tiles
Query: north, south, east, west, season
```

**Topographic Relief:**
```
GET /api/climate/topographic-relief/tiles
Query: north, south, east, west, style
```

### Water Access Endpoints

**USGS Aquifers:**
```
GET /api/usgs/aquifers
Query: north, south, east, west, name, generalized
```

**Aquifer Regions:**
```
GET /api/usgs/aquifers/regions
GET /api/usgs/aquifers/region/:regionId
```

## Troubleshooting

### Backend Not Running

If you see "Backend not running" errors:
1. Check if backend is running: `curl http://localhost:3001/api/health`
2. Start backend: `cd backend && npm start`
3. Check Python service: `curl http://localhost:5001/health`

### Climate Layers Not Loading

1. Verify Earth Engine authentication: `earthengine authenticate`
2. Check Python service logs
3. Verify environment variables are set
4. Check browser console for API errors

### Map Not Displaying

1. Verify Mapbox access token is set
2. Check browser console for Mapbox errors
3. Verify network connectivity

### Cache Issues

Clear caches:
```javascript
// In browser console
localStorage.clear()
// Then refresh page
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

[Add your license here]

## Support

For issues and questions, please open an issue on GitHub.





