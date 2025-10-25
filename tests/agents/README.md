# Climate Layer Test Agents

Automated test agents for validating climate layer functionality in Climate Studio.

## Overview

This directory contains specialized test agents that validate the functionality, data quality, and performance of climate visualization layers.

## Test Agents

### 1. Future Temperature Anomaly Layer Test Agent

**File:** `test-future-anomaly-layer.js`

Tests the NASA NEX-GDDP-CMIP6 temperature projection layer to ensure:
- Real NASA data is loaded correctly (not simulated)
- Errors are thrown instead of falling back to simulated data
- Hexagons are rendered without gaps
- Data quality and coverage is sufficient
- All emission scenarios work correctly
- Performance is acceptable

**Tests Performed:**
1. Health Check - Climate service accessibility
2. Data Source Validation - Real vs simulated data
3. Error Handling - Proper error throwing
4. Hexagon Coverage - Complete data coverage
5. Hexagon Geometry - Valid polygon structures
6. Different Scenarios - RCP 2.6, 4.5, 8.5
7. Different Years - Projections 2030-2100
8. Performance - Response times and caching

### 2. Precipitation and Drought Layer Test Agent

**File:** `test-precipitation-drought-layer.js`

Tests precipitation and drought data endpoints to ensure:
- Station-based precipitation data is accessible
- Data quality is sufficient
- Identifies missing spatial layer implementation

**Tests Performed:**
1. Backend Health Check
2. Station Precipitation Endpoint
3. Spatial Layer Existence Check
4. NOAA Data Availability
5. Precipitation Data Quality Analysis

## Installation

```bash
# Navigate to project root
cd /home/user/climate-studio

# Install dependencies (if not already installed)
npm install axios
```

## Usage

### Running Individual Test Agents

```bash
# Test Future Anomaly Layer
node tests/agents/test-future-anomaly-layer.js

# Test Precipitation/Drought Layer
node tests/agents/test-precipitation-drought-layer.js
```

### With Custom Configuration

```bash
# Set custom backend URL
BACKEND_URL=http://localhost:3001 \
node tests/agents/test-future-anomaly-layer.js

# Set custom climate service URL
CLIMATE_SERVICE_URL=http://localhost:5000 \
node tests/agents/test-future-anomaly-layer.js

# With NOAA API token (for precipitation tests)
NOAA_CDO_TOKEN=your_token_here \
node tests/agents/test-precipitation-drought-layer.js

# All together
BACKEND_URL=http://localhost:3001 \
CLIMATE_SERVICE_URL=http://localhost:5000 \
NOAA_CDO_TOKEN=your_token_here \
node tests/agents/test-precipitation-drought-layer.js
```

### Running All Tests

```bash
# Run both test agents
npm run test:climate-layers
```

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `BACKEND_URL` | Backend server URL | `http://localhost:3001` | No |
| `CLIMATE_SERVICE_URL` | Python climate service URL | `http://localhost:5000` | No |
| `NOAA_CDO_TOKEN` | NOAA Climate Data Online API token | None | No (but recommended) |

### Getting NOAA CDO Token

1. Visit https://www.ncdc.noaa.gov/cdo-web/token
2. Enter your email address
3. Check your email for the token
4. Set the token in your environment:
   ```bash
   export NOAA_CDO_TOKEN=your_token_here
   ```

## Output Format

### Test Statuses

- ✅ **Pass** - Test succeeded, no issues
- ❌ **Fail** - Test failed, requires attention
- ⚠️ **Warning** - Test passed with minor issues
- 💡 **Recommendation** - Suggestion for improvement
- ⏭️ **Skip** - Test skipped (missing dependencies)
- 🔥 **Error** - Test crashed unexpectedly

### Example Output

```
================================================================================
Future Temperature Anomaly Layer - Test Report
================================================================================

📊 Summary:
   ✅ Passed: 6
   ❌ Failed: 0
   ⚠️  Warnings: 1
   💡 Recommendations: 2

--------------------------------------------------------------------------------

📝 Detailed Results:

1. ✅ healthCheck: Climate service is accessible and healthy
   Data: {
     "source": "NASA NEX-GDDP-CMIP6 via Earth Engine",
     "model": "ACCESS-CM2",
     "scenario": "ssp245",
     "featureCount": 127,
     "responseTime": "12.34s"
   }

2. ✅ dataSourceValidation: Successfully loaded real NASA data
...
```

### Exit Codes

- `0` - All tests passed
- `1` - One or more tests failed

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Climate Layer Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test-climate-layers:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Set up Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'

    - name: Install dependencies
      run: npm install

    - name: Start services
      run: |
        docker-compose up -d backend climate-service
        sleep 10

    - name: Test Future Anomaly Layer
      env:
        BACKEND_URL: http://localhost:3001
        CLIMATE_SERVICE_URL: http://localhost:5000
      run: node tests/agents/test-future-anomaly-layer.js

    - name: Test Precipitation Layer
      env:
        BACKEND_URL: http://localhost:3001
        NOAA_CDO_TOKEN: ${{ secrets.NOAA_CDO_TOKEN }}
      run: node tests/agents/test-precipitation-drought-layer.js
```

## Troubleshooting

### "Cannot connect to climate service"

**Problem:** The climate service is not running or not accessible.

**Solutions:**
1. Start the climate service:
   ```bash
   cd qgis-processing
   python climate_server.py
   ```
2. Check if running on correct port (default 5000)
3. Verify `CLIMATE_SERVICE_URL` environment variable

### "Earth Engine not initialized"

**Problem:** Google Earth Engine credentials are not configured.

**Solutions:**
1. Authenticate with Earth Engine:
   ```bash
   earthengine authenticate
   ```
2. Set Earth Engine project:
   ```bash
   export EARTHENGINE_PROJECT=your-project-id
   ```
3. Check Earth Engine quota/limits

### "NOAA_CDO_TOKEN is not configured"

**Problem:** NOAA API token is missing.

**Solutions:**
1. Get a token from https://www.ncdc.noaa.gov/cdo-web/token
2. Set environment variable:
   ```bash
   export NOAA_CDO_TOKEN=your_token_here
   ```

### Tests timing out

**Problem:** Requests are taking too long.

**Solutions:**
1. Increase timeout in test agent constructor:
   ```javascript
   const agent = new FutureAnomalyLayerTestAgent({
     timeout: 120000 // 2 minutes
   });
   ```
2. Check network connectivity
3. Verify Earth Engine is responding
4. Use smaller test bounds/resolution

## Extending the Test Agents

### Adding New Tests

1. Open the test agent file
2. Add a new test method:
   ```javascript
   async testNewFeature() {
     this.log('Test N: New Feature Test', 'test');

     try {
       // Your test code here

       this.addResult({
         test: 'newFeature',
         status: 'pass',
         message: 'Feature works correctly',
         data: { /* test data */ }
       });
     } catch (error) {
       this.addResult({
         test: 'newFeature',
         status: 'fail',
         message: 'Feature test failed',
         error: error.message
       });
     }
   }
   ```

3. Add to test list in `runAllTests()`:
   ```javascript
   const tests = [
     // ... existing tests ...
     this.testNewFeature.bind(this)
   ];
   ```

### Creating New Test Agents

1. Create new file in `tests/agents/`:
   ```javascript
   // test-new-layer.js
   const axios = require('axios');

   class NewLayerTestAgent {
     constructor(config = {}) {
       this.backendUrl = config.backendUrl || 'http://localhost:3001';
       this.testResults = [];
       this.verbose = config.verbose !== false;
     }

     // Add your test methods...
   }

   module.exports = NewLayerTestAgent;
   ```

2. Follow the pattern from existing agents
3. Export the class for use in CI/CD

## Best Practices

1. **Run tests before deployment**
   - Catch issues early
   - Validate data quality
   - Check performance

2. **Monitor test results over time**
   - Track response times
   - Identify degradation
   - Set up alerts

3. **Keep tests fast**
   - Use smaller bounds for quick tests
   - Lower resolution for performance tests
   - Cache test data when possible

4. **Test edge cases**
   - Invalid parameters
   - Missing data
   - Network failures
   - Timeout scenarios

5. **Document failures**
   - Include reproduction steps
   - Capture error messages
   - Note environment details

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review test output for error details
3. Check main documentation: `/home/user/climate-studio/LAYER_TESTING_REPORT.md`
4. Open an issue on GitHub

---

**Last Updated:** October 25, 2025
**Version:** 1.0
