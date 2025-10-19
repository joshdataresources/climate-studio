# Google Earth Engine Setup for Real Landsat Data

The Urban Heat Island layer can use real Landsat 8/9 Land Surface Temperature (LST) data from Google Earth Engine instead of simulated data.

## Current Status

✅ **Simulated data is working** - The layer displays realistic urban heat patterns using simulation
⚠️ **Real Landsat data requires setup** - Follow the steps below to enable real satellite data

## Setup Steps

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **"Create Project"** or select an existing project
3. Note your **Project ID** (e.g., `my-earth-engine-project`)

### 2. Enable Earth Engine API

1. Go to [Earth Engine Registration](https://signup.earthengine.google.com/)
2. Select your Google Cloud project
3. Register for Earth Engine access (may take a few hours for approval)
4. Alternatively, enable the Earth Engine API in your project:
   - Go to [Earth Engine API](https://console.cloud.google.com/apis/library/earthengine.googleapis.com)
   - Click **"Enable"**

### 3. Authenticate Earth Engine

The credentials are already set up on your machine:

```bash
# Already done, but if you need to refresh:
earthengine authenticate --force
```

### 4. Start the Server with Your Project ID

Stop the current server (Ctrl+C on the running process) and restart with your project ID:

```bash
cd /Users/joshuabutler/Documents/github-project/sustainable-urban-studio/qgis-processing

# Option 1: Using the start script
PORT=3002 ./start_climate_server.sh your-project-id

# Option 2: Using environment variable
PORT=3002 EARTHENGINE_PROJECT=your-project-id python3 climate_server.py
```

Replace `your-project-id` with your actual Google Cloud project ID.

## What Real Data Provides

When using real Landsat data instead of simulation:

### Real Data Features:
- ✅ Actual satellite measurements from Landsat 8/9
- ✅ Surface temperature in Celsius from thermal infrared
- ✅ True urban heat island intensity (urban temp - rural temp)
- ✅ NDVI-based classification (urban vs rural areas)
- ✅ Cloud-filtered imagery (< 20% cloud cover)
- ✅ Most recent available imagery (within 30 days)
- ✅ Scene metadata (acquisition date, cloud cover, scene ID)

### Simulated Data (Current):
- ⚠️ Realistic patterns based on distance from urban core
- ⚠️ Mathematical model with spatial noise
- ⚠️ Useful for development and demonstration
- ⚠️ Not actual measurements

## Troubleshooting

### "no project found" Error

If you see:
```
WARNING: Could not initialize Earth Engine: ee.Initialize: no project found
```

**Solution**: Provide your project ID when starting the server (see Step 4 above)

### "PERMISSION_DENIED" Error

If you see:
```
Encountered 403 Forbidden with reason "PERMISSION_DENIED"
```

**Solution**:
1. Make sure your project is registered for Earth Engine (Step 2)
2. Check that Earth Engine API is enabled in your project
3. Wait a few hours if you just registered (approval process)

### No Images Found

If the server starts but no images are found:

**Solution**:
- Try a different location (some areas have sparse coverage)
- Try a different date (cloud cover may be too high)
- The system automatically falls back to simulated data

## Verification

When Earth Engine is working, you'll see:

```
INFO:landsat_lst:Google Earth Engine initialized successfully
INFO:landsat_lst:Retrieved 500 LST samples
INFO:landsat_lst:Urban: 32.5°C, Rural: 28.3°C
```

Instead of:
```
WARNING:landsat_lst:Urban Heat Island will use simulated data
INFO:urban_heat_island:Generating simulated urban heat island data
```

## Data Specifications

### Landsat Data Source
- **Datasets**: LANDSAT/LC08/C02/T1_L2 (Landsat 8) and LANDSAT/LC09/C02/T1_L2 (Landsat 9)
- **Resolution**: 100m thermal (30m native, resampled for performance)
- **Temporal**: Most recent cloud-free image within 30 days
- **Cloud Filter**: < 20% cloud cover
- **Band Used**: ST_B10 (Surface Temperature)

### Urban/Rural Classification
- **Urban**: NDVI < 0.2 (built-up areas, impervious surfaces)
- **Rural**: NDVI > 0.4 (vegetation, parks, forests)
- **NDVI Bands**: SR_B5 (NIR) and SR_B4 (Red)

### Heat Island Calculation
```
UHI Intensity (°C) = Urban Temperature - Rural Temperature
```

Typical values:
- **0-1°C**: Minimal heat island effect
- **1-3°C**: Moderate heat island effect
- **3-5°C**: Strong heat island effect
- **5+°C**: Extreme heat island effect

## Cost

Earth Engine is free for:
- ✅ Research and education
- ✅ Non-commercial projects
- ✅ Reasonable usage (< 1000 requests/day)

For commercial use, check [Earth Engine pricing](https://earthengine.google.com/pricing/).

## Questions?

If you encounter issues:
1. Check the server logs for specific error messages
2. Verify your project ID is correct
3. Ensure Earth Engine API is enabled
4. Check that your Google account has access to the project
