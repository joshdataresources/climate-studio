# Earth Engine Setup and Troubleshooting

This document explains how to set up and troubleshoot Google Earth Engine for the climate suite application.

## Overview

The climate suite uses Google Earth Engine to access NASA climate data, precipitation data, urban heat island data, and other geospatial datasets. Earth Engine requires proper authentication and configuration.

## Required Setup

### 1. Google Cloud Project

1. Create a Google Cloud Project (or use an existing one)
2. Enable the Earth Engine API:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to "APIs & Services" > "Library"
   - Search for "Earth Engine API"
   - Click "Enable"

### 2. Earth Engine Authentication

#### Option A: Service Account (Recommended for Production)

1. Create a service account:
   ```bash
   # In Google Cloud Console
   # IAM & Admin > Service Accounts > Create Service Account
   ```

2. Grant Earth Engine access:
   - Add the service account email to your Earth Engine project
   - Grant "Can View" or "Can Edit" permissions

3. Download the service account key:
   - Create a JSON key for the service account
   - Save it securely (e.g., `~/.config/earthengine/credentials.json`)

4. Set environment variable:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
   ```

#### Option B: User Authentication (Development)

1. Install Earth Engine Python API:
   ```bash
   pip install earthengine-api
   ```

2. Authenticate:
   ```bash
   earthengine authenticate
   ```
   This will open a browser for OAuth authentication.

### 3. Environment Configuration

Set the Earth Engine project ID:

```bash
export EARTHENGINE_PROJECT="your-project-id"
```

Or add to `.env` file:
```
EARTHENGINE_PROJECT=your-project-id
```

### 4. Verify Installation

Test Earth Engine initialization:

```python
import ee
ee.Initialize(project='your-project-id')
print(ee.Image('USGS/SRTMGL1_003').getInfo())
```

## Troubleshooting

### Problem: "Earth Engine not initialized"

**Symptoms:**
- Climate layers fail to load
- Error messages mention "Earth Engine not initialized"
- Status endpoint shows `earthEngineReady: false`

**Solutions:**

1. **Check Authentication:**
   ```bash
   # Verify credentials exist
   ls ~/.config/earthengine/
   
   # Re-authenticate if needed
   earthengine authenticate
   ```

2. **Check Project ID:**
   ```bash
   # Verify environment variable is set
   echo $EARTHENGINE_PROJECT
   
   # Or check .env file
   cat .env | grep EARTHENGINE
   ```

3. **Check Service Account (if using):**
   ```bash
   # Verify service account key exists
   echo $GOOGLE_APPLICATION_CREDENTIALS
   ls $GOOGLE_APPLICATION_CREDENTIALS
   ```

4. **Check API Access:**
   - Verify Earth Engine API is enabled in Google Cloud Console
   - Check that your account/service account has Earth Engine access
   - Visit [Earth Engine Code Editor](https://code.earthengine.google.com/) to verify access

5. **Check Server Logs:**
   ```bash
   # Look for initialization errors
   tail -f qgis-processing/server.log | grep -i "earth\|ee\|initialize"
   ```

### Problem: "Earth Engine quota exceeded"

**Symptoms:**
- Requests fail with quota errors
- Some layers work but others don't
- Errors mention "quota" or "rate limit"

**Solutions:**

1. **Check Quota Limits:**
   - Visit [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to "APIs & Services" > "Quotas"
   - Check Earth Engine API quotas

2. **Reduce Request Frequency:**
   - The reliability system automatically retries with backoff
   - Circuit breakers prevent overwhelming the service
   - Consider caching tile URLs (they expire after ~1 day)

3. **Request Quota Increase:**
   - If needed, request a quota increase in Google Cloud Console
   - For high-volume usage, consider using Earth Engine High Volume API

### Problem: "Authentication failed"

**Symptoms:**
- Initialization fails immediately
- Error: "Please authenticate using earthengine authenticate"

**Solutions:**

1. **Re-authenticate:**
   ```bash
   earthengine authenticate
   ```

2. **Check Credentials:**
   ```bash
   # Remove old credentials and re-authenticate
   rm -rf ~/.config/earthengine/
   earthengine authenticate
   ```

3. **Service Account Issues:**
   - Verify service account key is valid
   - Check that service account has Earth Engine access
   - Ensure `GOOGLE_APPLICATION_CREDENTIALS` points to correct file

### Problem: "Project not found"

**Symptoms:**
- Error: "Project 'xxx' not found"
- Initialization fails with project-related error

**Solutions:**

1. **Verify Project ID:**
   ```bash
   # Check environment variable
   echo $EARTHENGINE_PROJECT
   
   # Verify project exists in Google Cloud Console
   ```

2. **Check Project Access:**
   - Ensure your account has access to the project
   - Verify project ID is correct (not project name)

3. **Use Default Project:**
   - If project ID is optional, try without it:
   ```python
   ee.Initialize()  # Uses default project
   ```

### Problem: Layers load slowly or timeout

**Symptoms:**
- Layers take a long time to load
- Requests timeout
- Some layers work but others are slow

**Solutions:**

1. **This is Normal:**
   - Earth Engine processing can take 10-60 seconds
   - The reliability system waits up to 60 seconds
   - Large bounding boxes take longer

2. **Optimize Requests:**
   - Use tile URLs instead of hexagon data when possible
   - Reduce bounding box size (zoom in)
   - Use lower resolution for faster processing

3. **Check Network:**
   - Earth Engine requires internet connection
   - Check firewall/proxy settings
   - Verify Earth Engine API endpoints are accessible

## Automatic Recovery

The reliability system automatically handles Earth Engine issues:

1. **Automatic Retries:**
   - Up to 5 retries for Earth Engine errors
   - Exponential backoff (2s, 4s, 8s, 16s, 32s)
   - Longer delays for Earth Engine (can be slow)

2. **Circuit Breaker:**
   - Opens after 5 failures
   - Prevents overwhelming failing service
   - Automatically attempts recovery after 60 seconds

3. **Graceful Degradation:**
   - Falls back to cached data when available
   - Preserves previous layer data on errors
   - Shows helpful error messages

4. **Health Monitoring:**
   - Continuously monitors Earth Engine status
   - Shows detailed service status in UI
   - Automatic retry scheduling

## Testing Earth Engine

### Test from Python:

```python
import ee

# Initialize
ee.Initialize(project='your-project-id')

# Test simple operation
image = ee.Image('USGS/SRTMGL1_003')
print(image.getInfo())

# Test climate data
dataset = ee.ImageCollection('NASA/GDDP-CMIP6')
print(dataset.size().getInfo())
```

### Test from Server:

```bash
# Check status endpoint
curl http://localhost:5000/api/climate/status

# Should return:
# {
#   "earthEngine": {
#     "ready": true,
#     "services": {
#       "nasa_climate": true,
#       "urban_heat": true,
#       ...
#     }
#   }
# }
```

## Best Practices

1. **Use Service Accounts for Production:**
   - More secure than user authentication
   - Better for automated systems
   - Easier to manage permissions

2. **Set Project ID Explicitly:**
   - Always set `EARTHENGINE_PROJECT` environment variable
   - Prevents using wrong project
   - Makes debugging easier

3. **Monitor Quota Usage:**
   - Check quota usage regularly
   - Request increases before hitting limits
   - Use caching to reduce requests

4. **Handle Errors Gracefully:**
   - The reliability system does this automatically
   - Show helpful error messages to users
   - Provide fallback data when possible

5. **Test After Changes:**
   - Test Earth Engine after any configuration changes
   - Verify all services initialize correctly
   - Check status endpoint regularly

## Additional Resources

- [Earth Engine Documentation](https://developers.google.com/earth-engine)
- [Earth Engine Python API](https://github.com/google/earthengine-api)
- [Earth Engine Code Editor](https://code.earthengine.google.com/)
- [Google Cloud Console](https://console.cloud.google.com/)



