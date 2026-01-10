# Climate Suite Architecture & Technical Stack

## System Architecture Diagram

```mermaid
graph TB
    subgraph "Frontend - Vercel"
        A[React 18 + TypeScript<br/>Vite Build System]
        A1[Deck.gl + Mapbox GL<br/>Geospatial Visualization]
        A2[Climate Context<br/>State Management]
        A3[Reliability Service<br/>Circuit Breaker Pattern]
        A --> A1
        A --> A2
        A --> A3
    end

    subgraph "Backend Gateway - Railway/Render"
        B[Node.js + Express<br/>Port 3001]
        B1[Rate Limiting<br/>In-Memory Cache]
        B2[CORS Proxy<br/>File Upload Handler]
        B3[PostGIS Database<br/>PostgreSQL 15]
        B --> B1
        B --> B2
        B --> B3
    end

    subgraph "Python Climate Service - Render"
        C[Python Flask<br/>Gunicorn WSGI<br/>Port 5001]
        C1[Google Earth Engine API<br/>NASA Climate Data]
        C2[H3 Hexagonal Indexing<br/>GeoPandas Processing]
        C3[Rasterio + NumPy<br/>Scientific Computing]
        C --> C1
        C --> C2
        C --> C3
    end

    subgraph "External Data Sources"
        D1[Google Earth Engine<br/>NEX-GDDP-CMIP6]
        D2[NOAA APIs<br/>Sea Level Rise]
        D3[USGS Services<br/>Aquifer Data]
        D4[Yale YCEO<br/>Urban Heat Island]
    end

    A3 -->|HTTP/Axios| B1
    B2 -->|Proxy Requests| C
    C1 --> D1
    C --> D2
    C --> D3
    C1 --> D4

    style A fill:#61dafb,stroke:#333,stroke-width:2px
    style B fill:#68a063,stroke:#333,stroke-width:2px
    style C fill:#3776ab,stroke:#333,stroke-width:2px
    style D1 fill:#fbbc04,stroke:#333,stroke-width:1px
    style D2 fill:#fbbc04,stroke:#333,stroke-width:1px
    style D3 fill:#fbbc04,stroke:#333,stroke-width:1px
    style D4 fill:#fbbc04,stroke:#333,stroke-width:1px
```

## Data Flow Architecture

```mermaid
sequenceDiagram
    participant User
    participant React as React App<br/>(Vite/Vercel)
    participant Express as Express Gateway<br/>(Node.js/Railway)
    participant Cache as In-Memory Cache<br/>(node-cache)
    participant Flask as Python Service<br/>(Flask/Render)
    participant EE as Google Earth Engine<br/>(NASA Data)

    User->>React: Select Climate Layer<br/>(Temperature/Sea Level)
    React->>Express: API Request<br/>/api/climate-data
    Express->>Cache: Check Cache

    alt Cache Hit
        Cache-->>Express: Return Cached Data
        Express-->>React: Climate Data
    else Cache Miss
        Express->>Flask: Proxy to Python Service
        Flask->>EE: Query Earth Engine<br/>(H3 Hexagonal Grid)
        EE-->>Flask: Tile URLs + Data
        Flask->>Flask: Process with NumPy<br/>GeoPandas/Rasterio
        Flask-->>Express: Processed Climate Data
        Express->>Cache: Store in Cache<br/>(TTL: 1hr - 7 days)
        Express-->>React: Climate Data
    end

    React->>React: Render with Deck.gl<br/>(Hexagonal Layers)
    React-->>User: Interactive Map
```

## Technology Stack Breakdown

### Frontend Layer
```mermaid
mindmap
  root((Frontend<br/>React + Vite))
    Visualization
      Deck.gl 9.2.2
        GeoJsonLayer
        HeatmapLayer
        BitmapLayer
      Mapbox GL 3.17.0
      Leaflet 1.9.4
      Recharts 2.15.4
    UI Components
      Radix UI
      Shadcn/ui
      Tailwind CSS 4.1
      Material-UI
    State Management
      React Context
      React Hook Form
      Zod Validation
    Utilities
      Turf.js 6.5.0
      Axios 1.6.0
      React Router 7.11
```

### Backend Services
```mermaid
mindmap
  root((Backend<br/>Services))
    Node.js Express
      Rate Limiting
      CORS Handling
      File Upload
        Multer
        Shapefile Parser
      Caching
        node-cache
      Security
        Helmet
        Compression
    Python Flask
      Earth Engine API
      Scientific Computing
        NumPy
        GeoPandas
        Shapely
        Rasterio
      Geospatial
        H3 Indexing
        Turf Processing
      Server
        Gunicorn WSGI
    PostgreSQL
      PostGIS Extension
      Spatial Indexing
```

## Key Architectural Decisions

```mermaid
graph LR
    A[Why Python<br/>for Climate Data?] --> B[Earth Engine<br/>Python API]
    A --> C[NumPy/GeoPandas<br/>Scientific Stack]
    A --> D[Rasterio<br/>Raster Processing]

    E[Why Google<br/>Earth Engine?] --> F[Pre-processed<br/>NASA Data]
    E --> G[Cloud Computing<br/>No Downloads]
    E --> H[Tile Generation<br/>Direct Integration]

    I[Why Hexagonal<br/>Grids H3?] --> J[Uniform<br/>Distribution]
    I --> K[Better Visual<br/>Aesthetics]
    I --> L[Hierarchical<br/>Multi-resolution]

    M[Why Three-Tier<br/>Architecture?] --> N[Service<br/>Isolation]
    M --> O[Independent<br/>Scaling]
    M --> P[Technology<br/>Specialization]

    style A fill:#e1f5ff
    style E fill:#e1f5ff
    style I fill:#e1f5ff
    style M fill:#e1f5ff
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "Vercel CDN"
        V[Static Assets<br/>React SPA]
    end

    subgraph "Railway/Render"
        R1[Node.js Container<br/>Express Server<br/>Port 3001]
    end

    subgraph "Render"
        R2[Python Container<br/>QGIS Base Image<br/>Flask + Gunicorn<br/>Port 5001]
    end

    subgraph "Cloud Database"
        DB[(PostgreSQL 15<br/>PostGIS 3.4)]
    end

    Internet[Internet Users] --> V
    V --> R1
    R1 --> R2
    R1 --> DB
    R2 --> GEE[Google Earth Engine]
    R2 --> NOAA[NOAA APIs]
    R2 --> USGS[USGS Services]

    style V fill:#000000,color:#ffffff
    style R1 fill:#7733ff
    style R2 fill:#0051a6
    style DB fill:#336791,color:#ffffff
    style GEE fill:#fbbc04
    style NOAA fill:#003087,color:#ffffff
    style USGS fill:#004d00,color:#ffffff
```

## Performance & Reliability Features

```mermaid
graph TB
    subgraph "Reliability Layer"
        A[Circuit Breaker<br/>Pattern]
        B[Exponential<br/>Backoff Retry]
        C[Health<br/>Monitoring]
    end

    subgraph "Caching Strategy"
        D[In-Memory Cache<br/>node-cache]
        E[LocalStorage<br/>User Preferences]
        F[Earth Engine<br/>Tile URLs]
    end

    subgraph "Performance Optimizations"
        G[Memoized<br/>Components]
        H[Throttled<br/>Viewport Updates]
        I[Debounced<br/>Bounds Changes]
        J[H3 Grid<br/>Aggregation]
    end

    style A fill:#ff6b6b
    style B fill:#ff6b6b
    style C fill:#ff6b6b
    style D fill:#51cf66
    style E fill:#51cf66
    style F fill:#51cf66
    style G fill:#339af0
    style H fill:#339af0
    style I fill:#339af0
    style J fill:#339af0
```

## Climate Data Layers

| Layer | Data Source | Technology | Processing |
|-------|-------------|------------|------------|
| Temperature Projection | NASA NEX-GDDP-CMIP6 | Google Earth Engine | H3 Hexagonal Grid |
| Sea Level Rise | NOAA SLR Viewer | REST API | Hexagonal Depth Values |
| Urban Heat Island | Yale YCEO UHI | Earth Engine | Raster Tiles |
| Topographic Relief | USGS SRTM 90m | Earth Engine | Hillshade Rendering |
| Precipitation/Drought | NASA Climate Data | Earth Engine | H3 Grid + Metrics |
| Water Access/Aquifers | USGS Principal Aquifers | ArcGIS REST | GeoJSON Polygons |
| Urban Expansion | Multi-year Satellite | Earth Engine | Change Detection |

## Technical Challenges Solved

```mermaid
graph LR
    A[Challenge:<br/>Slow Earth Engine] --> A1[Solution:<br/>Circuit Breaker +<br/>Increased Timeouts]

    B[Challenge:<br/>Large Geospatial<br/>Data] --> B1[Solution:<br/>H3 Aggregation +<br/>Tile Streaming]

    C[Challenge:<br/>CORS Restrictions] --> C1[Solution:<br/>Node.js Proxy +<br/>Rate Limiting]

    D[Challenge:<br/>Multi-Service<br/>Coordination] --> D1[Solution:<br/>Gateway Pattern +<br/>Health Checks]

    E[Challenge:<br/>Rendering<br/>Performance] --> E1[Solution:<br/>Memoization +<br/>Throttling]

    style A fill:#ffcccc
    style B fill:#ffcccc
    style C fill:#ffcccc
    style D fill:#ffcccc
    style E fill:#ffcccc
    style A1 fill:#ccffcc
    style B1 fill:#ccffcc
    style C1 fill:#ccffcc
    style D1 fill:#ccffcc
    style E1 fill:#ccffcc
```

---

## Why These Technology Choices?

### Python for Climate Processing
- **Earth Engine Integration**: Official Python API with mature support
- **Scientific Computing**: NumPy, GeoPandas, Shapely ecosystem
- **Raster Processing**: Rasterio for TIFF/NetCDF climate data
- **Parallel Processing**: Dask for handling large datasets
- **QGIS Integration**: Python API for advanced GIS operations

### Google Earth Engine
- **Pre-processed Data**: NASA datasets ready without downloads
- **Cloud Computing**: Server-side processing at scale
- **Direct Integration**: Tile URLs for seamless map rendering
- **400+ Datasets**: Single API for multiple climate sources

### Three-Tier Architecture
- **Service Isolation**: Independent deployment and scaling
- **Technology Specialization**: Right tool for each job
- **Fault Tolerance**: Services fail independently
- **Caching Layer**: Node.js gateway reduces Python service load

### Render for Python Service
- **QGIS Base Image**: Pre-configured geospatial environment
- **Gunicorn WSGI**: Production-ready Python server
- **Long-Running Requests**: Handles Earth Engine timeouts
- **Environment Management**: Isolated Python dependencies

### Vercel for Frontend
- **Zero Config**: Built-in SPA routing and CORS
- **Monorepo Support**: Native npm workspaces
- **Build Cache**: Fast deployments
- **CDN Distribution**: Global edge network

---

## Quick Stats

- **Languages**: TypeScript, Python, JavaScript
- **Lines of Code**: ~50,000+
- **Services**: 3 (Frontend, Gateway, Climate Processing)
- **Climate Layers**: 7 (with multiple scenarios)
- **Data Sources**: 5 (Earth Engine, NOAA, USGS, Yale, Landsat)
- **Dependencies**: 150+ npm packages, 30+ Python packages
- **Deployment Targets**: 3 (Vercel, Railway/Render, Render)
