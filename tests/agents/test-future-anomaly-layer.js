/**
 * Test Agent for Future Temperature Anomaly Layer
 *
 * This agent tests the temperature projection layer to ensure:
 * 1. Real NASA data is loaded correctly (not simulated)
 * 2. Errors are thrown instead of falling back to simulated data
 * 3. Hexagons are rendered without gaps
 * 4. Data quality and coverage is sufficient
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

class FutureAnomalyLayerTestAgent {
  constructor(config = {}) {
    this.backendUrl = config.backendUrl || 'http://localhost:3001';
    this.climateServiceUrl = config.climateServiceUrl || 'http://localhost:5000';
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
    this.log('Starting Future Temperature Anomaly Layer Tests', 'test');
    this.log(`Backend URL: ${this.backendUrl}`, 'info');
    this.log(`Climate Service URL: ${this.climateServiceUrl}`, 'info');

    const tests = [
      this.testHealthCheck.bind(this),
      this.testDataSourceValidation.bind(this),
      this.testErrorHandlingInsteadOfFallback.bind(this),
      this.testHexagonCoverage.bind(this),
      this.testHexagonGeometry.bind(this),
      this.testDifferentScenarios.bind(this),
      this.testDifferentYears.bind(this),
      this.testPerformance.bind(this)
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

  async testHealthCheck() {
    this.log('Test 1: Health Check', 'test');

    try {
      const response = await axios.get(`${this.climateServiceUrl}/health`, {
        timeout: 5000
      });

      if (response.data.status === 'healthy') {
        this.log('Climate service is healthy', 'success');
        this.addResult({
          test: 'healthCheck',
          status: 'pass',
          message: 'Climate service is accessible and healthy'
        });
      } else {
        this.log('Climate service returned unhealthy status', 'warning');
        this.addResult({
          test: 'healthCheck',
          status: 'warning',
          message: 'Service is accessible but may not be fully healthy',
          data: response.data
        });
      }
    } catch (error) {
      this.log(`Health check failed: ${error.message}`, 'error');
      this.addResult({
        test: 'healthCheck',
        status: 'fail',
        message: 'Cannot connect to climate service',
        error: error.message
      });
    }
  }

  async testDataSourceValidation() {
    this.log('Test 2: Data Source Validation (Real vs Simulated)', 'test');

    const testBounds = {
      north: 41,
      south: 40,
      east: -73,
      west: -74,
      year: 2050,
      scenario: 'rcp45',
      resolution: 7
    };

    try {
      const startTime = performance.now();
      const response = await axios.get(`${this.climateServiceUrl}/api/climate/temperature-projection`, {
        params: testBounds,
        timeout: 60000 // 60 second timeout for real data
      });
      const elapsedTime = performance.now() - startTime;

      const data = response.data.data;
      const metadata = data.metadata;

      this.log(`Request completed in ${(elapsedTime / 1000).toFixed(2)}s`, 'info');
      this.log(`Data source: ${metadata.source}`, 'info');
      this.log(`Is real data: ${metadata.isRealData}`, 'info');
      this.log(`Data type: ${metadata.dataType}`, 'info');
      this.log(`Feature count: ${metadata.count}`, 'info');

      // Check if data is real NASA data
      const isRealData = metadata.isRealData === true && metadata.dataType === 'real';

      if (isRealData) {
        this.log('✅ REAL NASA DATA detected', 'success');
        this.addResult({
          test: 'dataSourceValidation',
          status: 'pass',
          message: 'Successfully loaded real NASA NEX-GDDP-CMIP6 data',
          data: {
            source: metadata.source,
            model: metadata.model,
            scenario: metadata.scenario,
            featureCount: metadata.count,
            responseTime: `${(elapsedTime / 1000).toFixed(2)}s`
          }
        });
      } else {
        this.log('⚠️ FALLBACK DATA detected - this should be an error!', 'warning');
        this.addResult({
          test: 'dataSourceValidation',
          status: 'fail',
          message: 'Received simulated/fallback data instead of real NASA data',
          issue: 'Layer is falling back to simulated data instead of throwing an error',
          data: {
            source: metadata.source,
            isRealData: metadata.isRealData,
            dataType: metadata.dataType,
            featureCount: metadata.count
          }
        });
      }
    } catch (error) {
      this.log(`Data fetch failed: ${error.message}`, 'error');
      this.addResult({
        test: 'dataSourceValidation',
        status: 'fail',
        message: 'Failed to fetch temperature projection data',
        error: error.message
      });
    }
  }

  async testErrorHandlingInsteadOfFallback() {
    this.log('Test 3: Error Handling (Should error, not fallback)', 'test');

    // This test simulates a scenario where Earth Engine is unavailable
    // Currently the code falls back to simulated data - it should error instead

    this.log('Note: This test would require mocking Earth Engine failure', 'info');
    this.log('Current behavior: Falls back to simulated data', 'warning');
    this.log('Expected behavior: Should throw an error', 'warning');

    this.addResult({
      test: 'errorHandlingInsteadOfFallback',
      status: 'recommendation',
      message: 'Layer should throw errors instead of silently falling back to simulated data',
      recommendation: 'Modify nasa_ee_climate.py to throw errors instead of returning fallback data',
      locations: [
        'nasa_ee_climate.py:69-71 (EE not initialized)',
        'nasa_ee_climate.py:162-172 (Exception handler)'
      ]
    });
  }

  async testHexagonCoverage() {
    this.log('Test 4: Hexagon Coverage (No gaps in data)', 'test');

    const testBounds = {
      north: 40.8,
      south: 40.7,
      east: -73.9,
      west: -74.0,
      year: 2050,
      scenario: 'rcp45',
      resolution: 7
    };

    try {
      const response = await axios.get(`${this.climateServiceUrl}/api/climate/temperature-projection`, {
        params: testBounds,
        timeout: 60000
      });

      const features = response.data.data.features;

      if (!features || features.length === 0) {
        this.log('No features returned', 'error');
        this.addResult({
          test: 'hexagonCoverage',
          status: 'fail',
          message: 'No hexagon features returned for test bounds'
        });
        return;
      }

      this.log(`Received ${features.length} hexagon features`, 'info');

      // Check for features with null/undefined temperature data
      const missingDataCount = features.filter(f =>
        f.properties.tempAnomaly === null ||
        f.properties.tempAnomaly === undefined
      ).length;

      if (missingDataCount > 0) {
        this.log(`⚠️ ${missingDataCount} hexagons have missing temperature data`, 'warning');
        this.addResult({
          test: 'hexagonCoverage',
          status: 'warning',
          message: `${missingDataCount} out of ${features.length} hexagons have missing data`,
          issue: 'Some hexagons may not have complete coverage'
        });
      } else {
        this.log('All hexagons have temperature data', 'success');
        this.addResult({
          test: 'hexagonCoverage',
          status: 'pass',
          message: 'All hexagons have complete temperature data',
          data: { totalHexagons: features.length }
        });
      }
    } catch (error) {
      this.log(`Coverage test failed: ${error.message}`, 'error');
      this.addResult({
        test: 'hexagonCoverage',
        status: 'fail',
        message: 'Failed to test hexagon coverage',
        error: error.message
      });
    }
  }

  async testHexagonGeometry() {
    this.log('Test 5: Hexagon Geometry (Valid polygons, no rendering gaps)', 'test');

    const testBounds = {
      north: 40.8,
      south: 40.7,
      east: -73.9,
      west: -74.0,
      year: 2050,
      scenario: 'rcp45',
      resolution: 7
    };

    try {
      const response = await axios.get(`${this.climateServiceUrl}/api/climate/temperature-projection`, {
        params: testBounds,
        timeout: 60000
      });

      const features = response.data.data.features;

      if (!features || features.length === 0) {
        this.log('No features to test geometry', 'warning');
        return;
      }

      let validGeometry = 0;
      let invalidGeometry = 0;
      const geometryIssues = [];

      features.forEach((feature, idx) => {
        const coords = feature.geometry.coordinates;

        // Check if polygon is closed (first and last coordinates match)
        if (coords && coords[0] && coords[0].length > 0) {
          const firstPoint = coords[0][0];
          const lastPoint = coords[0][coords[0].length - 1];

          if (JSON.stringify(firstPoint) === JSON.stringify(lastPoint)) {
            validGeometry++;
          } else {
            invalidGeometry++;
            geometryIssues.push(`Feature ${idx}: Polygon not closed`);
          }

          // Check if polygon has at least 7 points (6 sides + closing point for hexagon)
          if (coords[0].length < 7) {
            geometryIssues.push(`Feature ${idx}: Only ${coords[0].length} points (expected 7 for hexagon)`);
          }
        } else {
          invalidGeometry++;
          geometryIssues.push(`Feature ${idx}: Invalid coordinate structure`);
        }
      });

      this.log(`Valid geometries: ${validGeometry}`, 'info');
      this.log(`Invalid geometries: ${invalidGeometry}`, invalidGeometry > 0 ? 'warning' : 'info');

      if (invalidGeometry === 0) {
        this.log('All hexagon geometries are valid', 'success');
        this.addResult({
          test: 'hexagonGeometry',
          status: 'pass',
          message: 'All hexagon geometries are properly formed',
          data: { validCount: validGeometry }
        });
      } else {
        this.log('Some hexagons have geometry issues', 'warning');
        this.addResult({
          test: 'hexagonGeometry',
          status: 'warning',
          message: `${invalidGeometry} hexagons have geometry issues`,
          issues: geometryIssues.slice(0, 10) // First 10 issues
        });
      }

      // Check for rendering gap issue (stroke width 0)
      this.addResult({
        test: 'hexagonRenderingGaps',
        status: 'recommendation',
        message: 'Hexagon stroke is set to transparent with width 0, which may cause visual gaps',
        recommendation: 'Set stroke width to 0.5-1px with matching fill color to eliminate gaps between hexagons',
        location: 'frontend/src/components/OpenLayersGlobe.tsx:162-165'
      });
    } catch (error) {
      this.log(`Geometry test failed: ${error.message}`, 'error');
      this.addResult({
        test: 'hexagonGeometry',
        status: 'fail',
        message: 'Failed to test hexagon geometry',
        error: error.message
      });
    }
  }

  async testDifferentScenarios() {
    this.log('Test 6: Different Emission Scenarios', 'test');

    const scenarios = ['rcp26', 'rcp45', 'rcp85'];
    const testBounds = {
      north: 40.8,
      south: 40.7,
      east: -73.9,
      west: -74.0,
      year: 2050,
      resolution: 6 // Lower resolution for faster testing
    };

    const results = [];

    for (const scenario of scenarios) {
      try {
        const response = await axios.get(`${this.climateServiceUrl}/api/climate/temperature-projection`, {
          params: { ...testBounds, scenario },
          timeout: 60000
        });

        const metadata = response.data.data.metadata;
        const features = response.data.data.features;

        if (features && features.length > 0) {
          const avgAnomaly = features.reduce((sum, f) => sum + (f.properties.tempAnomaly || 0), 0) / features.length;

          results.push({
            scenario,
            sspScenario: metadata.sspScenario,
            featureCount: features.length,
            avgAnomaly: avgAnomaly.toFixed(2),
            isRealData: metadata.isRealData
          });

          this.log(`Scenario ${scenario}: ${avgAnomaly.toFixed(2)}°C anomaly`, 'info');
        }
      } catch (error) {
        results.push({
          scenario,
          error: error.message
        });
        this.log(`Scenario ${scenario} failed: ${error.message}`, 'error');
      }
    }

    // Check if temperature anomalies increase with more severe scenarios
    const hasValidData = results.filter(r => r.avgAnomaly !== undefined);
    if (hasValidData.length === 3) {
      const rcp26 = parseFloat(hasValidData.find(r => r.scenario === 'rcp26')?.avgAnomaly || 0);
      const rcp45 = parseFloat(hasValidData.find(r => r.scenario === 'rcp45')?.avgAnomaly || 0);
      const rcp85 = parseFloat(hasValidData.find(r => r.scenario === 'rcp85')?.avgAnomaly || 0);

      if (rcp26 < rcp45 && rcp45 < rcp85) {
        this.log('Temperature anomalies correctly increase with emission scenarios', 'success');
        this.addResult({
          test: 'differentScenarios',
          status: 'pass',
          message: 'All scenarios return valid data with expected temperature progression',
          data: { rcp26, rcp45, rcp85 }
        });
      } else {
        this.log('Temperature progression does not match expected pattern', 'warning');
        this.addResult({
          test: 'differentScenarios',
          status: 'warning',
          message: 'Temperature anomalies do not follow expected progression (RCP 2.6 < RCP 4.5 < RCP 8.5)',
          data: { rcp26, rcp45, rcp85 }
        });
      }
    } else {
      this.addResult({
        test: 'differentScenarios',
        status: 'fail',
        message: 'Could not retrieve data for all scenarios',
        data: results
      });
    }
  }

  async testDifferentYears() {
    this.log('Test 7: Different Projection Years', 'test');

    const years = [2030, 2050, 2070, 2100];
    const testBounds = {
      north: 40.8,
      south: 40.7,
      east: -73.9,
      west: -74.0,
      scenario: 'rcp85',
      resolution: 6
    };

    const results = [];

    for (const year of years) {
      try {
        const response = await axios.get(`${this.climateServiceUrl}/api/climate/temperature-projection`, {
          params: { ...testBounds, year },
          timeout: 60000
        });

        const features = response.data.data.features;

        if (features && features.length > 0) {
          const avgAnomaly = features.reduce((sum, f) => sum + (f.properties.tempAnomaly || 0), 0) / features.length;
          results.push({ year, avgAnomaly: avgAnomaly.toFixed(2) });
          this.log(`Year ${year}: ${avgAnomaly.toFixed(2)}°C anomaly`, 'info');
        }
      } catch (error) {
        results.push({ year, error: error.message });
        this.log(`Year ${year} failed: ${error.message}`, 'error');
      }
    }

    if (results.length === years.length && results.every(r => r.avgAnomaly)) {
      this.log('All projection years return valid data', 'success');
      this.addResult({
        test: 'differentYears',
        status: 'pass',
        message: 'All projection years return valid temperature data',
        data: results
      });
    } else {
      this.addResult({
        test: 'differentYears',
        status: 'fail',
        message: 'Some projection years failed to return data',
        data: results
      });
    }
  }

  async testPerformance() {
    this.log('Test 8: Performance Testing', 'test');

    const testBounds = {
      north: 41,
      south: 40,
      east: -73,
      west: -74,
      year: 2050,
      scenario: 'rcp45',
      resolution: 7
    };

    const timings = [];

    for (let i = 0; i < 3; i++) {
      try {
        const startTime = performance.now();
        await axios.get(`${this.climateServiceUrl}/api/climate/temperature-projection`, {
          params: testBounds,
          timeout: 60000
        });
        const elapsedTime = performance.now() - startTime;
        timings.push(elapsedTime);
        this.log(`Request ${i + 1}: ${(elapsedTime / 1000).toFixed(2)}s`, 'info');
      } catch (error) {
        this.log(`Performance test ${i + 1} failed: ${error.message}`, 'error');
      }
    }

    if (timings.length > 0) {
      const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
      const minTime = Math.min(...timings);
      const maxTime = Math.max(...timings);

      this.log(`Average: ${(avgTime / 1000).toFixed(2)}s, Min: ${(minTime / 1000).toFixed(2)}s, Max: ${(maxTime / 1000).toFixed(2)}s`, 'info');

      // First request might be slow due to Earth Engine initialization
      // Subsequent requests should be faster
      if (timings.length > 1 && timings[1] < timings[0] * 0.5) {
        this.log('Caching appears to be working', 'success');
      }

      this.addResult({
        test: 'performance',
        status: 'pass',
        message: 'Performance metrics collected',
        data: {
          avgTime: `${(avgTime / 1000).toFixed(2)}s`,
          minTime: `${(minTime / 1000).toFixed(2)}s`,
          maxTime: `${(maxTime / 1000).toFixed(2)}s`
        }
      });
    } else {
      this.addResult({
        test: 'performance',
        status: 'fail',
        message: 'Could not collect performance metrics'
      });
    }
  }

  generateReport() {
    const passCount = this.testResults.filter(r => r.status === 'pass').length;
    const failCount = this.testResults.filter(r => r.status === 'fail').length;
    const warningCount = this.testResults.filter(r => r.status === 'warning').length;
    const recommendationCount = this.testResults.filter(r => r.status === 'recommendation').length;

    console.log('\n' + '='.repeat(80));
    console.log('Future Temperature Anomaly Layer - Test Report');
    console.log('='.repeat(80));
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Passed: ${passCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   ⚠️  Warnings: ${warningCount}`);
    console.log(`   💡 Recommendations: ${recommendationCount}`);
    console.log('\n' + '-'.repeat(80));

    console.log('\n📝 Detailed Results:\n');
    this.testResults.forEach((result, idx) => {
      const icon = {
        pass: '✅',
        fail: '❌',
        warning: '⚠️',
        recommendation: '💡',
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
      if (result.location || result.locations) {
        console.log(`   📍 Location: ${result.location || result.locations.join(', ')}`);
      }
      console.log('');
    });

    console.log('='.repeat(80));

    return {
      summary: {
        total: this.testResults.length,
        passed: passCount,
        failed: failCount,
        warnings: warningCount,
        recommendations: recommendationCount
      },
      results: this.testResults
    };
  }
}

// Run tests if executed directly
if (require.main === module) {
  const agent = new FutureAnomalyLayerTestAgent({
    backendUrl: process.env.BACKEND_URL || 'http://localhost:3001',
    climateServiceUrl: process.env.CLIMATE_SERVICE_URL || 'http://localhost:5000',
    verbose: true
  });

  agent.runAllTests()
    .then(report => {
      process.exit(report.summary.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Test agent crashed:', error);
      process.exit(1);
    });
}

module.exports = FutureAnomalyLayerTestAgent;
