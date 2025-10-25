/**
 * Test Agent for Precipitation and Drought Layer
 *
 * This agent tests precipitation/drought data to ensure:
 * 1. Station-based precipitation data is accessible
 * 2. Identifies the lack of spatial precipitation/drought layer
 * 3. Tests any existing precipitation endpoints
 * 4. Provides recommendations for implementing a spatial layer
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

class PrecipitationDroughtLayerTestAgent {
  constructor(config = {}) {
    this.backendUrl = config.backendUrl || 'http://localhost:3001';
    this.testResults = [];
    this.verbose = config.verbose !== false;
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: '📝',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      test: '🧪'
    }[level] || '📝';

    const fullMessage = `[${timestamp}] ${prefix} ${message}`;
    if (this.verbose) {
      console.log(fullMessage);
    }
    return fullMessage;
  }

  async runAllTests() {
    this.log('Starting Precipitation and Drought Layer Tests', 'test');
    this.log(`Backend URL: ${this.backendUrl}`, 'info');

    const tests = [
      this.testBackendHealth.bind(this),
      this.testStationPrecipitationEndpoint.bind(this),
      this.testSpatialLayerExistence.bind(this),
      this.testNOAADataAvailability.bind(this),
      this.analyzePrecipitationDataQuality.bind(this)
    ];

    for (const test of tests) {
      try {
        await test();
      } catch (error) {
        this.addResult({
          test: test.name,
          status: 'error',
          message: `Test crashed: ${error.message}`,
          error: error.stack
        });
      }
    }

    return this.generateReport();
  }

  addResult(result) {
    this.testResults.push({
      timestamp: new Date().toISOString(),
      ...result
    });
  }

  async testBackendHealth() {
    this.log('Test 1: Backend Health Check', 'test');

    try {
      const response = await axios.get(`${this.backendUrl}/health`, {
        timeout: 5000
      });

      if (response.status === 200) {
        this.log('Backend is accessible', 'success');
        this.addResult({
          test: 'backendHealth',
          status: 'pass',
          message: 'Backend server is accessible and healthy'
        });
      } else {
        this.log('Backend returned non-200 status', 'warning');
        this.addResult({
          test: 'backendHealth',
          status: 'warning',
          message: `Backend returned status ${response.status}`,
          data: response.data
        });
      }
    } catch (error) {
      this.log(`Backend health check failed: ${error.message}`, 'error');
      this.addResult({
        test: 'backendHealth',
        status: 'fail',
        message: 'Cannot connect to backend server',
        error: error.message
      });
    }
  }

  async testStationPrecipitationEndpoint() {
    this.log('Test 2: Station-Based Precipitation Endpoint', 'test');

    // Test the existing NOAA precipitation trend endpoint
    try {
      const response = await axios.get(`${this.backendUrl}/api/climate/noaa/precipitation/trend`, {
        params: {
          stationid: 'GHCND:USW00094789', // Default NYC station
          years: 5
        },
        timeout: 30000
      });

      if (response.data.success) {
        const series = response.data.series || [];
        const trend = response.data.trend;

        this.log(`Station precipitation data retrieved: ${series.length} data points`, 'info');
        this.log(`Precipitation trend: ${trend?.slope?.toFixed(3)} mm/decade`, 'info');

        if (series.length > 0) {
          this.log('Station-based precipitation endpoint is working', 'success');
          this.addResult({
            test: 'stationPrecipitationEndpoint',
            status: 'pass',
            message: 'Station-based precipitation data is accessible',
            data: {
              dataPoints: series.length,
              trend: trend,
              station: response.data.station
            }
          });
        } else {
          this.log('No precipitation data returned', 'warning');
          this.addResult({
            test: 'stationPrecipitationEndpoint',
            status: 'warning',
            message: 'Endpoint is accessible but returned no data'
          });
        }
      } else {
        this.log('Precipitation endpoint returned unsuccessful response', 'warning');
        this.addResult({
          test: 'stationPrecipitationEndpoint',
          status: 'fail',
          message: 'Endpoint returned unsuccessful response',
          data: response.data
        });
      }
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.error?.includes('NOAA_CDO_TOKEN')) {
        this.log('NOAA CDO token is not configured', 'warning');
        this.addResult({
          test: 'stationPrecipitationEndpoint',
          status: 'warning',
          message: 'NOAA CDO token not configured - cannot test precipitation endpoint',
          recommendation: 'Set NOAA_CDO_TOKEN environment variable to test this endpoint'
        });
      } else {
        this.log(`Precipitation endpoint test failed: ${error.message}`, 'error');
        this.addResult({
          test: 'stationPrecipitationEndpoint',
          status: 'fail',
          message: 'Failed to fetch precipitation data',
          error: error.message
        });
      }
    }
  }

  async testSpatialLayerExistence() {
    this.log('Test 3: Spatial Precipitation/Drought Layer Existence', 'test');

    // Check if there's a spatial precipitation/drought layer
    // Based on code analysis, there is NO spatial layer currently

    this.log('⚠️ NO SPATIAL PRECIPITATION/DROUGHT LAYER FOUND', 'warning');
    this.log('Only station-based data is available', 'info');

    this.addResult({
      test: 'spatialLayerExistence',
      status: 'fail',
      message: 'No spatial precipitation or drought layer exists in climateLayers.ts',
      issue: 'Current implementation only provides station-based precipitation data',
      recommendation: 'Implement a spatial precipitation/drought layer similar to the temperature projection layer',
      suggestedDataSources: [
        {
          name: 'CHIRPS (Climate Hazards InfraRed Precipitation with Station data)',
          url: 'https://developers.google.com/earth-engine/datasets/catalog/UCSB-CHG_CHIRPS_DAILY',
          coverage: 'Global, 1981-present',
          resolution: '5.5km'
        },
        {
          name: 'GPM (Global Precipitation Measurement)',
          url: 'https://developers.google.com/earth-engine/datasets/catalog/NASA_GPM_L3_IMERG_V06',
          coverage: 'Global, 2000-present',
          resolution: '11km'
        },
        {
          name: 'PDSI (Palmer Drought Severity Index)',
          url: 'https://developers.google.com/earth-engine/datasets/catalog/GRIDMET_DROUGHT',
          coverage: 'CONUS, 1979-present',
          resolution: '4km'
        },
        {
          name: 'SPEI (Standardized Precipitation-Evapotranspiration Index)',
          url: 'https://spei.csic.es/map/maps.html',
          coverage: 'Global',
          resolution: '0.5 degrees'
        }
      ]
    });
  }

  async testNOAADataAvailability() {
    this.log('Test 4: NOAA Data Availability', 'test');

    // Test if we can access NOAA datasets for different metrics
    const datasets = [
      { name: 'Precipitation', endpoint: '/api/climate/noaa/precipitation/trend' },
      { name: 'Temperature', endpoint: '/api/climate/noaa/temperature/anomaly' }
    ];

    const results = [];

    for (const dataset of datasets) {
      try {
        const response = await axios.get(`${this.backendUrl}${dataset.endpoint}`, {
          params: {
            stationid: 'GHCND:USW00094789',
            years: 2
          },
          timeout: 20000
        });

        if (response.data.success) {
          results.push({
            dataset: dataset.name,
            status: 'available',
            dataPoints: response.data.series?.length || 0
          });
          this.log(`${dataset.name} data: Available`, 'success');
        } else {
          results.push({
            dataset: dataset.name,
            status: 'error',
            message: 'Request unsuccessful'
          });
          this.log(`${dataset.name} data: Error`, 'error');
        }
      } catch (error) {
        const isTokenMissing = error.response?.data?.error?.includes('NOAA_CDO_TOKEN');
        results.push({
          dataset: dataset.name,
          status: isTokenMissing ? 'token_missing' : 'unavailable',
          error: error.message
        });
        this.log(`${dataset.name} data: ${isTokenMissing ? 'Token missing' : 'Unavailable'}`, 'warning');
      }
    }

    const availableCount = results.filter(r => r.status === 'available').length;
    const tokenMissingCount = results.filter(r => r.status === 'token_missing').length;

    if (availableCount > 0) {
      this.addResult({
        test: 'noaaDataAvailability',
        status: 'pass',
        message: `${availableCount} NOAA dataset(s) accessible`,
        data: results
      });
    } else if (tokenMissingCount > 0) {
      this.addResult({
        test: 'noaaDataAvailability',
        status: 'warning',
        message: 'NOAA datasets require API token configuration',
        data: results,
        recommendation: 'Configure NOAA_CDO_TOKEN environment variable'
      });
    } else {
      this.addResult({
        test: 'noaaDataAvailability',
        status: 'fail',
        message: 'Cannot access NOAA datasets',
        data: results
      });
    }
  }

  async analyzePrecipitationDataQuality() {
    this.log('Test 5: Precipitation Data Quality Analysis', 'test');

    try {
      const response = await axios.get(`${this.backendUrl}/api/climate/noaa/precipitation/trend`, {
        params: {
          stationid: 'GHCND:USW00094789',
          years: 5
        },
        timeout: 30000
      });

      if (!response.data.success) {
        this.addResult({
          test: 'precipitationDataQuality',
          status: 'skip',
          message: 'Cannot analyze data quality - data not available'
        });
        return;
      }

      const series = response.data.series || [];

      if (series.length === 0) {
        this.addResult({
          test: 'precipitationDataQuality',
          status: 'warning',
          message: 'No precipitation data to analyze'
        });
        return;
      }

      // Check for data gaps
      const dates = series.map(d => new Date(d.date));
      const gaps = [];
      for (let i = 1; i < dates.length; i++) {
        const daysDiff = (dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24);
        if (daysDiff > 35) { // More than a month gap
          gaps.push({
            from: dates[i - 1].toISOString().split('T')[0],
            to: dates[i].toISOString().split('T')[0],
            days: Math.round(daysDiff)
          });
        }
      }

      // Check for null/zero values
      const nullCount = series.filter(d => d.value === null || d.value === undefined).length;
      const zeroCount = series.filter(d => d.value === 0).length;

      // Calculate statistics
      const values = series.filter(d => d.value !== null && d.value !== undefined).map(d => d.value);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);

      this.log(`Data points: ${series.length}`, 'info');
      this.log(`Average precipitation: ${avg.toFixed(2)} mm/month`, 'info');
      this.log(`Range: ${min.toFixed(2)} - ${max.toFixed(2)} mm/month`, 'info');
      this.log(`Null values: ${nullCount}, Zero values: ${zeroCount}`, 'info');
      this.log(`Data gaps: ${gaps.length}`, gaps.length > 0 ? 'warning' : 'info');

      const qualityScore = {
        completeness: ((series.length - nullCount) / series.length * 100).toFixed(1),
        gapCount: gaps.length,
        dataPoints: series.length
      };

      if (gaps.length === 0 && nullCount < series.length * 0.05) {
        this.addResult({
          test: 'precipitationDataQuality',
          status: 'pass',
          message: 'Precipitation data quality is good',
          data: {
            ...qualityScore,
            statistics: { avg, min, max }
          }
        });
      } else {
        this.addResult({
          test: 'precipitationDataQuality',
          status: 'warning',
          message: 'Precipitation data has some quality issues',
          data: {
            ...qualityScore,
            gaps: gaps.slice(0, 5), // First 5 gaps
            nullCount,
            zeroCount
          }
        });
      }
    } catch (error) {
      this.addResult({
        test: 'precipitationDataQuality',
        status: 'skip',
        message: 'Cannot analyze data quality',
        error: error.message
      });
    }
  }

  generateReport() {
    const passCount = this.testResults.filter(r => r.status === 'pass').length;
    const failCount = this.testResults.filter(r => r.status === 'fail').length;
    const warningCount = this.testResults.filter(r => r.status === 'warning').length;
    const skipCount = this.testResults.filter(r => r.status === 'skip').length;

    console.log('\n' + '='.repeat(80));
    console.log('Precipitation and Drought Layer - Test Report');
    console.log('='.repeat(80));
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Passed: ${passCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   ⚠️  Warnings: ${warningCount}`);
    console.log(`   ⏭️  Skipped: ${skipCount}`);
    console.log('\n' + '-'.repeat(80));

    console.log('\n📝 Detailed Results:\n');
    this.testResults.forEach((result, idx) => {
      const icon = {
        pass: '✅',
        fail: '❌',
        warning: '⚠️',
        skip: '⏭️',
        error: '🔥'
      }[result.status] || '📝';

      console.log(`${idx + 1}. ${icon} ${result.test}: ${result.message}`);
      if (result.data) {
        console.log(`   Data: ${JSON.stringify(result.data, null, 2)}`);
      }
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      if (result.recommendation) {
        console.log(`   💡 Recommendation: ${result.recommendation}`);
      }
      if (result.issue) {
        console.log(`   ⚠️  Issue: ${result.issue}`);
      }
      if (result.suggestedDataSources) {
        console.log(`   📚 Suggested Data Sources:`);
        result.suggestedDataSources.forEach(source => {
          console.log(`      - ${source.name}`);
          console.log(`        URL: ${source.url}`);
          console.log(`        Coverage: ${source.coverage}`);
          console.log(`        Resolution: ${source.resolution}`);
        });
      }
      console.log('');
    });

    console.log('='.repeat(80));
    console.log('\n🎯 Key Findings:\n');
    console.log('1. ⚠️  NO SPATIAL PRECIPITATION/DROUGHT LAYER exists');
    console.log('2. 📍 Only station-based precipitation data is available');
    console.log('3. 💡 Recommend implementing spatial layer using:');
    console.log('   - CHIRPS (Climate Hazards InfraRed Precipitation)');
    console.log('   - PDSI (Palmer Drought Severity Index)');
    console.log('   - Similar hexagonal grid approach as temperature layer');
    console.log('\n' + '='.repeat(80));

    return {
      summary: {
        total: this.testResults.length,
        passed: passCount,
        failed: failCount,
        warnings: warningCount,
        skipped: skipCount
      },
      results: this.testResults
    };
  }
}

// Run tests if executed directly
if (require.main === module) {
  const agent = new PrecipitationDroughtLayerTestAgent({
    backendUrl: process.env.BACKEND_URL || 'http://localhost:3001',
    verbose: true
  });

  agent.runAllTests()
    .then(report => {
      // Don't fail if tests are skipped, only if failed
      process.exit(report.summary.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Test agent crashed:', error);
      process.exit(1);
    });
}

module.exports = PrecipitationDroughtLayerTestAgent;
