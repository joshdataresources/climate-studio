# Climate Tile Layers Runbook

How **Future Temperature Anomaly** and **Precipitation & Drought** layers load, break, and get fixed — locally and in production.

---

## Architecture Overview

```
Browser (Vite / GitHub Pages / Vercel)
  │
  │  GET /api/climate/temperature-projection/tiles?year=2030&scenario=rcp45&mode=anomaly
  ▼
Express Backend (port 3001)
  │
  │  Proxies to CLIMATE_SERVICE_URL
  ▼
Python Flask Climate Service (port 5000 internal / 8081 external)
  │
  │  Authenticates with service account, queries dataset
  ▼
Google Earth Engine API
  │
  │  Returns tile_fetcher (session-based URL generator)
  ▼
Express Backend
  │
  │  Returns proxy tile URL template:
  │  /api/climate/temperature-projection/proxy-tile/{year}/{scenario}/{mode}/{z}/{x}/{y}
  ▼
Browser
  │  DeckGL TileLayer requests individual 256x256 PNG tiles as user pans/zooms
  │  GET /api/climate/temperature-projection/proxy-tile/2030/rcp45/anomaly/5/9/12
  ▼
Express Backend ──► Python Flask ──► Earth Engine tile_fetcher.fetch_tile(x, y, z)
  │
  │  Returns PNG image with Cache-Control: public, max-age=3600
  ▼
Browser renders BitmapLayer on map
```

### Three services must be running for tile layers to work:

| Service | Port (local) | Port (Docker) | What it does |
|---------|-------------|---------------|-------------|
| **Vite Frontend** | 8080 | 8080 | Renders map, fetches tile URLs, renders tiles |
| **Express Backend** | 3001 | 3001 | Proxies all `/api/climate/*` requests to Python service |
| **Python Flask** | 5001 (or any free port) | 5000 (mapped to host 8081) | Talks to Earth Engine, generates tile fetchers, serves PNG tiles |

---

## Environment Variables

### Frontend (`apps/climate-studio/.env`)

```bash
VITE_BACKEND_URL=http://localhost:8081          # Direct to Python service (used by some older endpoints)
VITE_NODE_BACKEND_URL=http://localhost:3001     # Express backend (used by tile layers)
```

> **Production**: Set these as GitHub Secrets (`VITE_NODE_BACKEND_URL`, `VITE_BACKEND_URL`) or Vercel env vars. They are baked into the JS bundle at build time.

### Express Backend (`backend/.env`)

```bash
CLIMATE_SERVICE_URL=http://localhost:8081       # Where the Python climate service lives
NOAA_CDO_TOKEN=<your-token>
NASA_API_KEY=<your-key>
```

> **Docker**: Use `CLIMATE_SERVICE_URL=http://urban-studio-qgis:5000` (Docker hostname)
> **Local without Docker**: Use `CLIMATE_SERVICE_URL=http://localhost:8081` (or whatever port Flask runs on)
> **Production**: Set to your deployed Python service URL (e.g., `https://your-climate-service.onrender.com`)

### Python Climate Service (`qgis-processing/.env`)

```bash
GOOGLE_APPLICATION_CREDENTIALS=ee-service-account-key.json    # Relative path for local dev
EE_SERVICE_ACCOUNT=xxxxx@xxxxx.iam.gserviceaccount.com
EARTHENGINE_PROJECT=your-ee-project-id
```

> **Production (Render/Cloud)**: Set `GOOGLE_APPLICATION_CREDENTIALS_JSON` to the **full JSON content** of the service account key. The server writes it to a temp file on startup.

---

## How Each Layer Works

### Future Temperature Anomaly (`temperature_projection`)

| Property | Value |
|----------|-------|
| Dataset | `NASA/GDDP-CMIP6` (NASA NEX-GDDP-CMIP6) |
| Model | ACCESS-CM2 |
| Resolution | ~25km native, resampled to 5km for display |
| Layer ID | `temperature_projection` |
| Endpoint | `/api/climate/temperature-projection/tiles` |
| Proxy tiles | `/api/climate/temperature-projection/proxy-tile/:year/:scenario/:mode/:z/:x/:y` |
| Query params | `year` (2025-2100), `scenario` (rcp26/rcp45/rcp85), `mode` (anomaly/actual) |
| Controls | Temperature Mode toggle, Projection Opacity slider |

**Scenario mapping**: `rcp26` → `ssp126`, `rcp45` → `ssp245`, `rcp85` → `ssp585`

**Anomaly calculation**: `tasmax_celsius - 14.5°C` (baseline = 1986-2005 average)

### Precipitation & Drought (`precipitation_drought`)

| Property | Value |
|----------|-------|
| Dataset | `UCSB-CHG/CHIRPS/DAILY` (CHIRPS precipitation) |
| Resolution | ~5km native, resampled to 2.5km for display |
| Layer ID | `precipitation_drought` |
| Endpoint | `/api/climate/precipitation-drought/tiles` |
| Proxy tiles | `/api/climate/precipitation-drought/proxy-tile/:year/:scenario/:metric/:z/:x/:y` |
| Query params | `year`, `scenario` (rcp26/rcp45/rcp85), `metric` (precipitation/drought_index/soil_moisture) |
| Controls | Drought Metric dropdown, Drought Opacity slider |

> **Note**: Currently uses CHIRPS historical data (2020-2023) as a placeholder. TODO: Replace with NOAA LOCA2 CMIP6 projections for future climate scenarios.

---

## Data Flow Step-by-Step

### Step 1: Frontend requests tile URL

**File**: `apps/climate-studio/src/hooks/useClimateLayerData.ts`

```
BACKEND_BASE_URL = import.meta.env.VITE_NODE_BACKEND_URL || 'http://localhost:3001'
```

When the layer is toggled on, `useClimateLayerData` calls:
```
GET {BACKEND_BASE_URL}/api/climate/temperature-projection/tiles?north=...&south=...&year=2030&scenario=rcp45&mode=anomaly
```

The hook caches the response for **10 minutes**. Cache is keyed by `year + scenario + mode`.

### Step 2: Express proxies to Python

**File**: `backend/server.js`

```
GET {CLIMATE_SERVICE_URL}/api/climate/temperature-projection/tiles?...
```

The Express backend adds no logic — it's a pure proxy with a 60-second timeout.

### Step 3: Python gets Earth Engine tile fetcher

**File**: `qgis-processing/climate_server.py` + `qgis-processing/services/nasa_ee_climate.py`

1. Authenticates with Earth Engine (service account credentials)
2. Queries dataset, filters by model/scenario/year
3. Computes anomaly (subtract baseline)
4. Resamples with bilinear interpolation
5. Calls `image.getMapId(vis_params)` → returns `tile_fetcher`
6. Caches `tile_fetcher` in memory dict: `_ee_tile_fetcher_cache["temp:2030:rcp45:anomaly"]`
7. Returns proxy URL template (NOT the raw Earth Engine URL):

```json
{
  "success": true,
  "tile_url": "/api/climate/temperature-projection/proxy-tile/2030/rcp45/anomaly/{z}/{x}/{y}",
  "metadata": { "source": "NASA NEX-GDDP-CMIP6 via Earth Engine", "isRealData": true }
}
```

### Step 4: Frontend resolves and renders tiles

**File**: `apps/climate-studio/src/components/DeckGLMap.tsx`

1. Gets `data.tile_url` from layer state
2. Prepends `BACKEND_BASE_URL` if URL is relative (starts with `/`)
3. Creates a DeckGL `TileLayer` with that URL template
4. As user pans/zooms, DeckGL requests individual tiles: `GET .../proxy-tile/2030/rcp45/anomaly/5/9/12`

### Step 5: Individual tile proxy

Each tile request flows:
```
Browser → Express (arraybuffer proxy, 15s timeout) → Flask → tile_fetcher.fetch_tile(x, y, z) → PNG
```

Response headers: `Content-Type: image/png`, `Cache-Control: public, max-age=3600`

---

## Common Breakages and Fixes

### 1. "Failed to fetch" / `net::ERR_FAILED` on all climate layers

**Symptom**: Console shows `🔴 Circuit breaker opened after 5 failures`, all requests to `localhost:3001` fail.

**Cause**: Express backend is not running on port 3001.

**Diagnosis**:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health
# If not 200, the backend is down
lsof -i :3001 -P | grep LISTEN
# Check what (if anything) is on port 3001
```

**Fix**:
```bash
# Kill whatever's on 3001 (often a stray Next.js or Docker process)
lsof -i :3001 -P -t | xargs kill
# Start the Express backend
cd backend && node server.js
```

### 2. Backend returns 500 / `getaddrinfo ENOTFOUND urban-studio-qgis`

**Symptom**: Backend is reachable (200 on `/health`) but tile endpoints return 500.

**Cause**: `CLIMATE_SERVICE_URL` in `backend/.env` is set to Docker hostname (`http://urban-studio-qgis:5000`) but you're running the backend outside Docker.

**Diagnosis**:
```bash
# Check what CLIMATE_SERVICE_URL is set to
grep CLIMATE_SERVICE_URL backend/.env
# Test if it's reachable
curl -s -o /dev/null -w "%{http_code}" $(grep CLIMATE_SERVICE_URL backend/.env | cut -d= -f2)/health
```

**Fix** — update `backend/.env`:
```bash
# If Python service is in Docker (exposed on 8081):
CLIMATE_SERVICE_URL=http://localhost:8081

# If running Python service directly:
CLIMATE_SERVICE_URL=http://localhost:5001

# If in Docker network:
CLIMATE_SERVICE_URL=http://urban-studio-qgis:5000
```

Then restart the Express backend.

### 3. Earth Engine authentication failure

**Symptom**: Python service starts but tile endpoints return errors mentioning EE initialization.

**Cause**: Missing or expired Earth Engine credentials.

**Diagnosis**:
```bash
# Check if credentials file exists
ls -la qgis-processing/ee-service-account-key.json
# Check env vars
grep GOOGLE_APPLICATION_CREDENTIALS qgis-processing/.env
grep EE_SERVICE_ACCOUNT qgis-processing/.env
```

**Fix**:
- Ensure `qgis-processing/.env` has correct `GOOGLE_APPLICATION_CREDENTIALS` path
- Ensure the JSON key file exists and the service account has Earth Engine access
- For production: set `GOOGLE_APPLICATION_CREDENTIALS_JSON` env var with the full JSON content

### 4. Port 5000 conflict on macOS (AirPlay)

**Symptom**: Python Flask service can't bind to port 5000.

**Cause**: macOS Sonoma+ uses port 5000 for AirPlay Receiver (ControlCenter process).

**Fix**: Either disable AirPlay Receiver in System Settings, or run Flask on a different port:
```bash
PORT=5001 python climate_server.py
# Then update backend/.env: CLIMATE_SERVICE_URL=http://localhost:5001
```

### 5. Docker port conflicts with Vite dev server

**Symptom**: `docker ps` shows containers on ports 8080, 8081, 3001 — same ports the local dev server needs.

**Cause**: Docker containers and local dev servers compete for the same ports.

**Fix** — choose one:
```bash
# Option A: Stop Docker, run everything locally
docker compose down

# Option B: Keep Docker, use Docker's ports directly
# Frontend already on 8080 via Docker
# Backend already on 3001 via Docker (if port is published)
# Climate service on 8081 via Docker

# Option C: Run Vite on a different port
npx vite --port 8083
```

### 6. Stale tile fetcher after Python service restart

**Symptom**: Tile URL endpoint returns a proxy URL, but individual tile requests return errors.

**Cause**: The `_ee_tile_fetcher_cache` is in-memory. After a Python service restart, cached tile fetchers are gone but the frontend still has old proxy URLs.

**Fix**: The Python service handles this — if a tile request hits a cache miss, it re-creates the tile fetcher. If it still fails:
```bash
# Force frontend to re-fetch tile URLs by hard-refreshing the page
# (Cmd+Shift+R / Ctrl+Shift+R)
```

### 7. Tiles load in Docker but not in local dev

**Symptom**: `docker compose up` works. Running `node server.js` locally doesn't.

**Checklist**:
```bash
# 1. Is the Express backend running?
curl http://localhost:3001/health

# 2. Is CLIMATE_SERVICE_URL pointing to the right place?
grep CLIMATE_SERVICE_URL backend/.env
# Should be http://localhost:8081 if Python is in Docker
# Should be http://localhost:5001 if Python is local

# 3. Is the Python service reachable?
curl http://localhost:8081/health    # Docker
curl http://localhost:5001/health    # Local

# 4. Is VITE_NODE_BACKEND_URL correct in the frontend?
grep VITE_NODE_BACKEND_URL apps/climate-studio/.env
# Should be http://localhost:3001
```

### 8. Layers work locally but not on GitHub Pages / Vercel

**Symptom**: Deployed site shows "Service temporarily unavailable" for climate layers.

**Cause**: The frontend is making requests to `localhost:3001` because the env vars weren't set at build time.

**Fix**:
1. Set GitHub Secrets (for GitHub Pages):
   - `VITE_NODE_BACKEND_URL` = your deployed Express backend URL
   - `VITE_BACKEND_URL` = your deployed Python service URL

2. These are used in `.github/workflows/deploy.yml`:
   ```yaml
   - name: Build
     env:
       VITE_NODE_BACKEND_URL: ${{ secrets.VITE_NODE_BACKEND_URL }}
       VITE_BACKEND_URL: ${{ secrets.VITE_BACKEND_URL }}
     run: npm run build:studio
   ```

3. For Vercel: Set the same env vars in Vercel Project Settings → Environment Variables.

4. **Both backends must be deployed and accessible from the internet.** The frontend is static (GitHub Pages / Vercel), so it calls the backends from the user's browser — the backend URLs must be publicly reachable.

### 9. CORS errors in production

**Symptom**: Browser console shows `Access-Control-Allow-Origin` errors.

**Cause**: The Express backend or Python service isn't allowing requests from your deployed frontend domain.

**Fix**: Both servers use `cors()` middleware. For production, configure allowed origins:
```javascript
// backend/server.js
app.use(cors({
  origin: ['https://your-frontend.vercel.app', 'https://your-org.github.io']
}));
```

```python
# qgis-processing/climate_server.py
CORS(app, origins=['https://your-frontend.vercel.app'])
```

---

## Quick Start Commands

### Local with Docker (recommended)

```bash
docker compose up -d
# Frontend: http://localhost:8080
# Backend: http://localhost:3001 (Docker network)
# Climate: http://localhost:8081 (Docker → 5000)
```

### Local without Docker

```bash
# Terminal 1: Python climate service
cd qgis-processing
PORT=5001 python climate_server.py

# Terminal 2: Express backend
# Make sure backend/.env has: CLIMATE_SERVICE_URL=http://localhost:5001
cd backend
node server.js

# Terminal 3: Vite frontend
npm run dev:studio
```

### Hybrid (Python in Docker, rest local)

```bash
# Docker is already running the Python service on port 8081
# Make sure backend/.env has: CLIMATE_SERVICE_URL=http://localhost:8081

# Terminal 1: Express backend
cd backend && node server.js

# Terminal 2: Vite frontend
npm run dev:studio
```

---

## Health Check Endpoints

| Service | Endpoint | Expected |
|---------|----------|----------|
| Express Backend | `GET http://localhost:3001/health` | `200 { status: "healthy" }` |
| Python Climate | `GET http://localhost:8081/health` | `200` |

The frontend reliability service (`climateLayerReliability.ts`) periodically pings `/health` on the Express backend. If it fails, the circuit breaker opens and all climate layer requests are blocked until health recovers.

---

## Deployment Checklist

- [ ] Python climate service deployed with `GOOGLE_APPLICATION_CREDENTIALS_JSON` env var set
- [ ] Python service has `EE_SERVICE_ACCOUNT` and `EARTHENGINE_PROJECT` env vars
- [ ] Express backend deployed with `CLIMATE_SERVICE_URL` pointing to Python service URL
- [ ] Express backend has `NOAA_CDO_TOKEN` and `NASA_API_KEY` env vars
- [ ] Express backend CORS allows your frontend domain
- [ ] Python service CORS allows your frontend domain
- [ ] Frontend build uses `VITE_NODE_BACKEND_URL` pointing to Express backend URL
- [ ] Frontend build uses `VITE_BACKEND_URL` pointing to Python service URL
- [ ] GitHub Secrets or Vercel env vars set for both URLs
- [ ] Test: `curl {EXPRESS_URL}/health` returns 200
- [ ] Test: `curl {PYTHON_URL}/health` returns 200
- [ ] Test: `curl "{EXPRESS_URL}/api/climate/temperature-projection/tiles?year=2030&scenario=rcp45&mode=anomaly"` returns JSON with `tile_url`

---

## File Reference

| File | Role |
|------|------|
| `apps/climate-studio/.env` | Frontend env vars (`VITE_NODE_BACKEND_URL`) |
| `apps/climate-studio/src/hooks/useClimateLayerData.ts` | Fetches tile URLs, caches them, manages layer state |
| `apps/climate-studio/src/services/climateLayerReliability.ts` | Circuit breaker, retries, health checks |
| `apps/climate-studio/src/components/DeckGLMap.tsx` | Renders tile layers (TileLayer → BitmapLayer) |
| `packages/climate-core/src/config/climateLayers.ts` | Layer definitions (endpoints, query params, controls) |
| `backend/.env` | Backend env vars (`CLIMATE_SERVICE_URL`) |
| `backend/server.js` | Express proxy (tiles endpoint + proxy-tile endpoint) |
| `qgis-processing/.env` | Earth Engine credentials |
| `qgis-processing/climate_server.py` | Flask API, tile caching, proxy tile handler |
| `qgis-processing/services/nasa_ee_climate.py` | CMIP6 temperature projection via Earth Engine |
| `qgis-processing/services/precipitation_drought.py` | CHIRPS precipitation/drought via Earth Engine |
| `docker-compose.yml` | Docker service definitions and networking |
| `.github/workflows/deploy.yml` | GitHub Pages deployment (uses secrets for env vars) |
| `apps/climate-studio/vercel.json` | Vercel build config and SPA rewrites |
