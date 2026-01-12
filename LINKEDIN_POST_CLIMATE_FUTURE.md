# Exploring America's Climate Future: Building a 100-Year Visualization Platform

## The Question That Started It All

Where will Americans live in 2050? 2075? 2100?

I wanted to explore which regions of the United States might remain livable as our climate changes over the next century. But existing climate tools felt either too academic or too simplified. So I built something different: an interactive platform that lets you explore multiple climate scenarios across time and space.

## What I Built

A real-time climate visualization system that overlays:
- **Temperature projections** (NASA NEX-GDDP-CMIP6 data)
- **Sea level rise scenarios** (NOAA data, 0-10ft)
- **Precipitation & drought patterns** (CHIRPS dataset)
- **Urban heat islands** (Landsat thermal data)
- **Topographic relief** (for elevation context)

All visualized as high-performance raster tile layers on an interactive map, powered by real satellite data from Google Earth Engine.

## The Architecture: A Tale of Two Responsibilities

### 🌐 **Backend (Python/Flask API)**
The heavy lifting happens server-side:

**What the API Does:**
- 🛰️ Authenticates with Google Earth Engine
- 📊 Queries NASA climate models (NEX-GDDP-CMIP6)
- 🌊 Fetches CHIRPS precipitation data
- 🎨 Applies color palettes and visualization parameters
- 🗺️ Generates pre-rendered raster tile URLs from Earth Engine
- 📦 Returns tile URLs for high-performance streaming

**Key Endpoints:**
```
GET /api/climate/temperature-projection/tiles
GET /api/climate/precipitation-drought/tiles
GET /api/tiles/noaa-slr/{feet}/{z}/{x}/{y}.png
```

Each endpoint handles:
1. **Earth Engine queries** (filtered by scenario, year, model)
2. **Visualization setup** (color ramps, min/max values, resampling)
3. **Tile URL generation** (Earth Engine MapID with {z}/{x}/{y} pattern)
4. **Tile proxying** (for NOAA sea level data)

### 💻 **Frontend (React/TypeScript/DeckGL)**
The client handles visualization and interaction:

**What's Calculated Client-Side:**
- 📍 **Viewport tracking** - monitors map position for tile requests
- 🗺️ **Tile loading** - automatically fetches tiles at {z}/{x}/{y} as you pan
- 🔄 **Layer toggling** - shows/hides layers via opacity controls
- 💾 **Saved views** - stores viewport state + active layers in localStorage
- 🎯 **Scenario mapping** - converts projection year to sea level rise feet
- 🎨 **Population circles** - calculates decade-over-decade growth rates and colors

**Rendering Pipeline:**
1. User pans/zooms → new viewport bounds calculated
2. Map automatically requests tiles for visible area: `/tiles/{z}/{x}/{y}`
3. Each tile rendered as 256×256 texture on GPU
4. Layers composite with opacity blending (relief → sea level → precipitation → temperature)
5. Population circles rendered as vector polygons with dynamic fill colors

## What's an API Anyway?

Think of an API (Application Programming Interface) as a restaurant:
- **Your app (client)** = The customer who orders food
- **The API** = The menu + waiter system
- **The backend server** = The kitchen

You don't need to know how to cook (process satellite data). You just order from the menu (make HTTP requests), and the kitchen (server) prepares it for you.

In this system:
- **Request:** "Give me temperature tiles for 2075, RCP 8.5 scenario"
- **API processes:** Queries NASA Earth Engine, sets color palette, generates tile URL
- **Response:** Returns a URL template: `https://earthengine.googleapis.com/.../tiles/{z}/{x}/{y}`
- **Client:** Automatically requests tiles like `/tiles/8/45/102` as you pan the map

## The System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Browser)                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  React App (GISAnalysisApp.tsx)                        │ │
│  │  • User selects: scenario, year, layers                │ │
│  │  • Calculates viewport bounds on pan/zoom              │ │
│  │  • Manages saved views & local state                   │ │
│  └───────────────────┬────────────────────────────────────┘ │
│                      │                                       │
│                      ▼                                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  useClimateLayerData Hook                              │ │
│  │  • Triggers API calls when bounds/params change        │ │
│  │  • Caches responses to avoid redundant requests        │ │
│  └───────────────────┬────────────────────────────────────┘ │
│                      │                                       │
│                      │ HTTP GET with query params           │
│                      │ ?north=40.9&south=40.5&east=-73.7... │
└──────────────────────┼───────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND API (Flask/Python)                      │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  climate_server.py - Routes & Request Validation       │ │
│  │  • /api/climate/temperature-projection/tiles           │ │
│  │  • /api/climate/precipitation-drought                  │ │
│  │  • /api/climate/sea-level-rise                         │ │
│  └───────────────────┬────────────────────────────────────┘ │
│                      │                                       │
│                      ▼                                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Service Layer                                         │ │
│  │                                                        │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │ nasa_ee_climate.py                               │ │ │
│  │  │ • Initialize Earth Engine with project ID        │ │ │
│  │  │ • Query NASA/GDDP-CMIP6 dataset                  │ │ │
│  │  │ • Filter by model, scenario, year                │ │ │
│  │  │ • Convert Kelvin → Celsius → Anomaly             │ │ │
│  │  │ • Apply color palette visualization              │ │ │
│  │  │ • Generate Earth Engine tile URL via getMapId()  │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │                                                        │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │ precipitation_drought.py                         │ │ │
│  │  │ • Query CHIRPS precipitation dataset             │ │ │
│  │  │ • Calculate mean precipitation                   │ │ │
│  │  │ • Apply drought/moisture color gradients         │ │ │
│  │  │ • Generate tile URL with visualization params    │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  └───────────────────┬────────────────────────────────────┘ │
└────────────────────────┼────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│           GOOGLE EARTH ENGINE (Cloud Platform)               │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Datasets                                              │ │
│  │  • NASA/GDDP-CMIP6 (temperature projections)          │ │
│  │  • UCSB-CHG/CHIRPS/DAILY (precipitation)              │ │
│  │  • MODIS/Landsat (urban heat, land cover)             │ │
│  │                                                        │ │
│  │  Compute Engine                                       │ │
│  │  • Runs reduceRegions on image collections            │ │
│  │  • Returns statistics (mean, min, max) per geometry   │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

                         │
                         │ Returns: Tile URL + Metadata
                         │ {
                         │   "success": true,
                         │   "tile_url": "https://earthengine.googleapis.com/
                         │                v1/projects/.../maps/abc123/tiles/
                         │                {z}/{x}/{y}",
                         │   "metadata": {
                         │     "source": "NASA NEX-GDDP-CMIP6",
                         │     "scenario": "rcp85",
                         │     "year": 2075,
                         │     "averageTemperature": 18.3
                         │   }
                         │ }
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Rendering)                      │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Map Rendering (Mapbox GL + DeckGL Overlay)            │ │
│  │  • Mapbox GL base map (light/dark theme toggle)        │ │
│  │  • Raster tiles loaded for each climate layer          │ │
│  │  • Tile requests: /tiles/{z}/{x}/{y}                   │ │
│  │  • GPU textures composite with opacity blending        │ │
│  │  • Layer order (bottom to top):                        │ │
│  │    1. Topographic relief                               │ │
│  │    2. Sea level rise                                   │ │
│  │    3. Precipitation/drought                            │ │
│  │    4. Temperature projection                           │ │
│  │    5. Urban heat island                                │ │
│  │  • Population megaregions: vector circles + labels     │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. **Raster Tiles for Performance**
The climate layers use pre-rendered raster tiles from Earth Engine's visualization API:
- **Smooth rendering** - tiles are just images loaded like any web map
- **Browser caching** - tiles cached automatically, instant on revisit
- **Server-side computation** - Earth Engine handles all the heavy processing
- **Automatic scaling** - different resolutions per zoom level (256×256 pixels per tile)

The only vector layer is population circles, rendered client-side with dynamic growth-based colors.

### 2. **Server-Side Rendering, Client-Side Interaction**
**Why the split matters:**

The backend generates tile URLs once per scenario/year combination. Earth Engine does the heavy computation (filtering millions of satellite images, calculating means, applying color ramps). The result is a URL template that works for any viewport.

The frontend just loads image tiles. No data processing, no calculations, just GPU texture rendering. This means:
- **Zero client-side data processing** for climate layers
- **Instant layer toggling** via opacity (no re-fetch needed)
- **Works on any device** - even phones can render these tiles smoothly

### 3. **Earth Engine Tile Streaming**
Instead of downloading full datasets, the app streams 256×256 pixel tiles on-demand:
- Zoom level 4: Each tile covers ~2500 km²
- Zoom level 10: Each tile covers ~10 km²
- Only loads tiles in viewport (typically 12-20 tiles visible)
- Earth Engine's CDN handles caching and distribution

This means the entire app data payload is just **~5 KB of JSON** (tile URLs), not gigabytes of climate data.

## What I Learned

Building this system taught me that climate data isn't just numbers—it's about making the abstract tangible. Seeing your own neighborhood under 6ft of sea level rise, or watching temperature anomalies creep across the map as you slide from 2025 → 2100, makes climate change visceral in a way charts never could.

The answer to my original question? There's no simple "livable vs. not" binary. It's a spectrum of trade-offs: heat vs. water scarcity, sea level vs. storm intensity, agricultural viability vs. wildfire risk. The tool doesn't give answers—it helps you ask better questions.

## Tech Stack
- **Backend:** Python, Flask, Google Earth Engine Python API
- **Frontend:** React, TypeScript, Mapbox GL JS, DeckGL
- **Data Sources:** NASA NEX-GDDP-CMIP6, NOAA SLR, CHIRPS, Landsat
- **Architecture:** RESTful API, raster tile streaming, Earth Engine compute

## Try It Yourself
[Link to your deployment]

What regions are you curious about? Drop a comment with your location and I'll share what the projections show.

---

#ClimateChange #DataVisualization #WebDev #GIS #Python #React #EarthEngine #OpenSource
