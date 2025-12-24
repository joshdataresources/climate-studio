# Climate API Troubleshooting Guide

## Current Status

✅ **Python Climate Service**: Running on port 5001
- Health check: `http://localhost:5001/health`
- Status: Healthy and responding

✅ **Backend Server**: Running on port 3001 (Docker)
- Health check: `http://localhost:3001/health`
- Status: ✅ Running and connected to Python service
- Configuration: `CLIMATE_SERVICE_URL=http://host.docker.internal:5001`

✅ **All API Endpoints**: Working correctly

## Services Configuration

### Python Climate Service
- **Port**: 5001
- **Location**: `qgis-processing/climate_server.py`
- **Start Command**: 
  ```bash
  cd qgis-processing
  PORT=5001 python3 climate_server.py
  ```
- **Status**: ✅ Running

### Backend Server
- **Port**: 3001
- **Location**: `backend/server.js`
- **Environment Variable**: `CLIMATE_SERVICE_URL=http://localhost:5001`
- **Status**: ⚠️ Needs restart

## API Endpoints

### Working Endpoints (Direct to Python Service)
- ✅ `GET http://localhost:5001/health`
- ✅ `GET http://localhost:5001/api/climate/temperature-projection/tiles`
- ✅ `GET http://localhost:5001/api/climate/urban-heat-island/tiles`
- ✅ `GET http://localhost:5001/api/climate/topographic-relief/tiles`
- ✅ `GET http://localhost:5001/api/climate/precipitation-drought/tiles`

### Backend Proxy Endpoints (Need Restart)
- ⚠️ `GET http://localhost:3001/api/climate/temperature-projection/tiles`
- ⚠️ `GET http://localhost:3001/api/climate/precipitation-drought/tiles`
- ✅ `GET http://localhost:3001/api/climate/urban-heat-island/tiles`
- ✅ `GET http://localhost:3001/api/climate/topographic-relief/tiles`

## Fixes Applied

1. ✅ Started Python climate service on port 5001 (port 5000 was in use)
2. ✅ Updated `backend/.env` with `CLIMATE_SERVICE_URL=http://localhost:5001`
3. ✅ Added missing `/tiles` endpoints to backend:
   - `/api/climate/temperature-projection/tiles`
   - `/api/climate/precipitation-drought/tiles`

## Next Steps

### 1. Restart Backend Server
The backend needs to be restarted to pick up the new `CLIMATE_SERVICE_URL` environment variable.

**If running with npm:**
```bash
cd backend
# Stop the current process (Ctrl+C)
npm start
# or
npm run dev
```

**If running with node directly:**
```bash
cd backend
# Stop the current process (Ctrl+C)
node server.js
```

### 2. Verify Connection
After restarting, test the connection:
```bash
curl "http://localhost:3001/api/climate/temperature-projection/tiles?north=41&south=40&east=-73&west=-74&year=2050&scenario=rcp45&mode=anomaly"
```

Should return a JSON response with `tile_url` and `success: true`.

### 3. Test All Climate Layers
Test each layer endpoint:
```bash
# Temperature Projection
curl "http://localhost:3001/api/climate/temperature-projection/tiles?north=41&south=40&east=-73&west=-74&year=2050&scenario=rcp45&mode=anomaly"

# Precipitation & Drought
curl "http://localhost:3001/api/climate/precipitation-drought/tiles?north=41&south=40&east=-73&west=-74&year=2050&scenario=rcp45&metric=drought_index"

# Urban Heat Island
curl "http://localhost:3001/api/climate/urban-heat-island/tiles?north=41&south=40&east=-73&west=-74"

# Topographic Relief
curl "http://localhost:3001/api/climate/topographic-relief/tiles?north=41&south=40&east=-73&west=-74"
```

## Troubleshooting

### Backend can't connect to Python service
1. Check Python service is running: `curl http://localhost:5001/health`
2. Check `.env` file has correct URL: `cat backend/.env | grep CLIMATE_SERVICE_URL`
3. Restart backend server

### Port conflicts
- Python service: Use `PORT=5001` (or any available port)
- Backend: Uses port 3001 by default
- Update `.env` if Python service uses different port

### Missing endpoints
All required endpoints have been added to `backend/server.js`:
- `/api/climate/temperature-projection/tiles` ✅
- `/api/climate/precipitation-drought/tiles` ✅
- `/api/climate/urban-heat-island/tiles` ✅
- `/api/climate/topographic-relief/tiles` ✅

## Environment Variables

### Backend `.env` file
```bash
CLIMATE_SERVICE_URL=http://localhost:5001
NOAA_CDO_TOKEN=...
NASA_API_KEY=...
```

### Python Service
Uses environment variables or defaults:
- `PORT=5001` (default: 5000)
- `EARTHENGINE_PROJECT=josh-geo-the-second` (default)

## Quick Start Commands

```bash
# Terminal 1: Start Python Climate Service
cd qgis-processing
PORT=5001 python3 climate_server.py

# Terminal 2: Start Backend Server
cd backend
npm start
# or
node server.js

# Terminal 3: Start Frontend
cd apps/climate-studio
npm run dev
```

## Verification Checklist

- [ ] Python service running on port 5001
- [ ] Backend `.env` has `CLIMATE_SERVICE_URL=http://localhost:5001`
- [ ] Backend server restarted after `.env` change
- [ ] All `/tiles` endpoints return successful responses
- [ ] Frontend can load climate layers without errors

