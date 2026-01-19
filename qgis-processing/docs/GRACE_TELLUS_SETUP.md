# GRACE Tellus API Integration Guide

## Overview
GRACE (Gravity Recovery and Climate Experiment) Tellus provides groundwater and water storage data through NASA's Earthdata system.

## Your Current Setup
✅ You already have GRACE integration via Google Earth Engine in `grace_groundwater.py`
✅ You have a GRACE Tellus API key (Earthdata credentials)

## Data Access Options

### Option 1: Google Earth Engine (Current - Free)
- **Dataset**: `NASA/GRACE/MASS_GRIDS_V04/MASCON_CRI`
- **Coverage**: 2002-2024 (GRACE + GRACE-FO)
- **Resolution**: 0.5° (~55km at equator)
- **Advantages**: Easy to query, no download needed, integrated with your existing setup

### Option 2: Direct PO.DAAC Access (With Your API Key)
- **Datasets**:
  - JPL RL06: `TELLUS_GRAC_L3_JPL_RL06_LND_v04`
  - GFZ RL06: `TELLUS_GRAC_L3_GFZ_RL06_LND_v04`
- **Coverage**: 2002-present (monthly updates)
- **Resolution**: 1° and 3° grids, mascon solutions
- **Advantages**: Latest data, higher accuracy, official NASA source

## Setup Your GRACE Tellus API Key

### 1. Environment Variables
Add to your `.env` file:
```bash
# GRACE Tellus / NASA Earthdata Credentials
EARTHDATA_USERNAME=your_username
EARTHDATA_PASSWORD=your_password
```

### 2. Install PO.DAAC Data Subscriber
```bash
pip install podaac-data-subscriber
```

### 3. Configure Earthdata Login
```bash
# One-time setup
podaac-data-subscriber -c TELLUS_GRAC_L3_JPL_RL06_LND_v04 --setup-earthdata
```

## Available GRACE Datasets

### Land Water Mass Grids
1. **JPL RL06** (Recommended)
   - Collection: `TELLUS_GRAC_L3_JPL_RL06_LND_v04`
   - Format: NetCDF
   - Variables: `lwe_thickness` (cm), uncertainty

2. **GFZ RL06** (Alternative)
   - Collection: `TELLUS_GRAC_L3_GFZ_RL06_LND_v04`
   - Similar to JPL, different processing center

3. **MASCON Solutions** (Highest resolution)
   - Available through Earth Engine (current implementation)

## Download Example

```bash
# Download latest month of groundwater data
podaac-data-downloader \
  -c TELLUS_GRAC_L3_JPL_RL06_LND_v04 \
  -d ./data/grace \
  --start-date 2024-01-01T00:00:00Z \
  --end-date 2024-12-31T23:59:59Z
```

## Using GRACE Data

### Current Implementation (Earth Engine)
```python
from services.grace_groundwater import GRACEGroundwaterService

service = GRACEGroundwaterService(ee_project='josh-geo-the-second')
data = service.get_groundwater_depletion(
    aquifer_id='high_plains',
    resolution=6
)
```

### API Endpoints
```
GET /api/climate/groundwater?aquifer=high_plains
```

## Data Interpretation

- **Positive values**: Water gain (wet conditions, recharge)
- **Negative values**: Water loss (drought, depletion)
- **Units**: Liquid Water Equivalent thickness in centimeters (cm)

### Example Values
- `-10 cm`: Moderate groundwater depletion
- `-20 cm`: Severe depletion (e.g., California Central Valley 2012-2015)
- `+5 cm`: Wet period, aquifer recharge

## Aquifers Monitored

1. **High Plains Aquifer** (Ogallala)
   - Covers: Great Plains (SD, NE, KS, OK, TX)
   - Status: Severe long-term depletion

2. **Central Valley Aquifer** (California)
   - Covers: California Central Valley
   - Status: Critical depletion during droughts

3. **Mississippi Embayment**
   - Covers: MS River valley
   - Status: Moderate depletion

## Next Steps

1. **Add API key to `.env`** with your Earthdata credentials
2. **Keep using Earth Engine** (it's easier and already working)
3. **Or switch to direct PO.DAAC** for latest data and higher accuracy

## Resources

- GRACE Tellus: https://grace.jpl.nasa.gov/
- PO.DAAC: https://podaac.jpl.nasa.gov/
- Earthdata Login: https://urs.earthdata.nasa.gov/
- Documentation: https://grace.jpl.nasa.gov/data/get-data/

## Questions?

Your current Earth Engine implementation is excellent for most use cases. Only switch to direct PO.DAAC if you need:
- Monthly updates within days of release
- Specific research-grade processing (JPL vs GFZ)
- Historical reanalysis with different processing versions
