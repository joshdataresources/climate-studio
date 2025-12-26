#!/usr/bin/env node
/**
 * Backend Connection Diagnostic Script
 * Tests all connection points to identify issues
 */

const http = require('http');

const tests = [
  {
    name: 'Backend Health Endpoint (Direct)',
    url: 'http://localhost:3001/health',
    method: 'GET'
  },
  {
    name: 'Backend Status Endpoint (Direct)',
    url: 'http://localhost:3001/api/climate/status',
    method: 'GET'
  },
  {
    name: 'Backend Status via Proxy',
    url: 'http://localhost:8080/api/climate/status',
    method: 'GET'
  },
  {
    name: 'Backend with CORS Headers',
    url: 'http://localhost:3001/api/climate/status',
    method: 'GET',
    headers: {
      'Origin': 'http://localhost:8080'
    }
  }
];

async function testConnection(test) {
  return new Promise((resolve) => {
    const url = new URL(test.url);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: test.method || 'GET',
      headers: test.headers || {}
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const corsHeaders = {
          'access-control-allow-origin': res.headers['access-control-allow-origin'],
          'access-control-allow-methods': res.headers['access-control-allow-methods'],
          'access-control-allow-credentials': res.headers['access-control-allow-credentials']
        };
        resolve({
          success: res.statusCode >= 200 && res.statusCode < 300,
          statusCode: res.statusCode,
          headers: res.headers,
          corsHeaders,
          data: data.substring(0, 200), // First 200 chars
          error: null
        });
      });
    });

    req.on('error', (error) => {
      resolve({
        success: false,
        statusCode: null,
        headers: null,
        corsHeaders: null,
        data: null,
        error: error.message
      });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({
        success: false,
        statusCode: null,
        headers: null,
        corsHeaders: null,
        data: null,
        error: 'Request timeout'
      });
    });

    req.end();
  });
}

async function runDiagnostics() {
  console.log('🔍 Backend Connection Diagnostics\n');
  console.log('='.repeat(60));

  for (const test of tests) {
    console.log(`\n📋 Testing: ${test.name}`);
    console.log(`   URL: ${test.url}`);
    
    const result = await testConnection(test);
    
    if (result.success) {
      console.log(`   ✅ Status: ${result.statusCode}`);
      if (result.corsHeaders['access-control-allow-origin']) {
        console.log(`   ✅ CORS: ${result.corsHeaders['access-control-allow-origin']}`);
      }
      try {
        const json = JSON.parse(result.data);
        console.log(`   ✅ Response: ${JSON.stringify(json).substring(0, 100)}...`);
      } catch (e) {
        console.log(`   ✅ Response: ${result.data.substring(0, 100)}...`);
      }
    } else {
      console.log(`   ❌ Failed: ${result.error || `Status ${result.statusCode}`}`);
      if (result.statusCode) {
        console.log(`   Status Code: ${result.statusCode}`);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n💡 Tips:');
  console.log('   - If direct connections work but proxy fails, check Vite config');
  console.log('   - If CORS fails, check backend CORS configuration');
  console.log('   - If all fail, check if backend is running on port 3001');
  console.log('   - Check browser console for detailed error messages\n');
}

runDiagnostics().catch(console.error);

