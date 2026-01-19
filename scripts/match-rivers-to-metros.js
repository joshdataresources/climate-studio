#!/usr/bin/env node
/**
 * Match Rivers to Metro Cities
 * 
 * This script helps identify and match rivers to metro cities from the
 * megaregion-data.json file. It can:
 * 1. Find cities that don't have river connections yet
 * 2. Help identify nearby rivers (proximity-based)
 * 3. Generate a template for manual curation
 * 4. Merge with existing rivers.json data
 */

const fs = require('fs');
const path = require('path');

// Paths
const METRO_DATA_PATH = path.join(__dirname, '../apps/climate-studio/src/data/megaregion-data.json');
const RIVERS_DATA_PATH = path.join(__dirname, '../apps/climate-studio/src/data/rivers.json');
const OUTPUT_PATH = path.join(__dirname, '../apps/climate-studio/src/data/metro-connecting-rivers.json');

// Helper: Calculate distance between two lat/lon points (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper: Find closest point on river to city
function findClosestPointOnRiver(cityLat, cityLon, riverCoords) {
  let minDistance = Infinity;
  let closestPoint = null;
  
  for (const coord of riverCoords) {
    const [lon, lat] = coord;
    const distance = calculateDistance(cityLat, cityLon, lat, lon);
    if (distance < minDistance) {
      minDistance = distance;
      closestPoint = { lat, lon, distance };
    }
  }
  
  return closestPoint;
}

// Load data
function loadData() {
  const metroData = JSON.parse(fs.readFileSync(METRO_DATA_PATH, 'utf8'));
  const riversData = JSON.parse(fs.readFileSync(RIVERS_DATA_PATH, 'utf8'));
  return { metroData, riversData };
}

// Find cities already connected in rivers.json
function findConnectedCities(riversData) {
  const connected = new Set();
  
  riversData.features.forEach(river => {
    if (river.properties?.cities_supplied) {
      river.properties.cities_supplied.forEach(city => {
        // Normalize city name for matching
        const normalized = city.name.toLowerCase()
          .replace(/,/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        connected.add(normalized);
      });
    }
  });
  
  return connected;
}

// Find unconnected metro cities
function findUnconnectedMetros(metroData, connectedCities) {
  const unconnected = [];
  
  metroData.metros.forEach(metro => {
    // Try different name variations
    const nameVariations = [
      metro.name.toLowerCase(),
      `${metro.name.toLowerCase()},`,
      metro.name.toLowerCase().replace(/\s+/g, ' '),
    ];
    
    const isConnected = nameVariations.some(name => {
      // Check if any connected city name contains this metro name or vice versa
      for (const connected of connectedCities) {
        if (connected.includes(name) || name.includes(connected)) {
          return true;
        }
      }
      return false;
    });
    
    if (!isConnected) {
      unconnected.push(metro);
    }
  });
  
  return unconnected;
}

// Find nearby rivers (proximity-based matching)
function findNearbyRivers(metro, riversData, maxDistanceKm = 50) {
  const nearby = [];
  
  riversData.features.forEach(river => {
    const coords = river.geometry?.coordinates;
    if (!coords || coords.length === 0) return;
    
    const closest = findClosestPointOnRiver(metro.lat, metro.lon, coords);
    
    if (closest && closest.distance <= maxDistanceKm) {
      nearby.push({
        river: river.properties.name,
        distance: closest.distance,
        closestPoint: closest,
        flow: river.properties.baseline_flow_cfs_2025,
        riverTier: river.properties.baseline_flow_cfs_2025 > 10000 ? 'major' : 
                   river.properties.baseline_flow_cfs_2025 > 500 ? 'significant' : 'feeder'
      });
    }
  });
  
  return nearby.sort((a, b) => a.distance - b.distance);
}

// Generate template for manual curation
function generateCurationTemplate(unconnectedMetros, riversData) {
  const template = {
    metadata: {
      generated: new Date().toISOString(),
      purpose: "Template for manually curating river-metro connections",
      instructions: [
        "1. Research each metro city's primary water sources",
        "2. Identify rivers that supply >20% of city's water",
        "3. Focus on rivers with 500-10,000 CFS flow (significant connecting rivers)",
        "4. Note if river is upstream of city (critical for water access)",
        "5. Estimate dependency percentage and water access risk"
      ]
    },
    metros: unconnectedMetros.map(metro => {
      const nearby = findNearbyRivers(metro, riversData, 100); // 100km search radius
      
      return {
        metro_name: metro.name,
        metro_lat: metro.lat,
        metro_lon: metro.lon,
        metro_population_2025: metro.populations['2025'],
        metro_region: metro.region,
        nearby_rivers: nearby.slice(0, 5), // Top 5 closest
        manual_research_needed: true,
        suggested_rivers: [], // To be filled manually
        notes: ""
      };
    })
  };
  
  return template;
}

// Generate summary report
function generateReport(metroData, riversData, unconnectedMetros) {
  const connectedCities = findConnectedCities(riversData);
  const totalMetros = metroData.metros.length;
  const connectedCount = totalMetros - unconnectedMetros.length;
  
  console.log('\n📊 River-Metro Connection Report');
  console.log('='.repeat(60));
  console.log(`Total Metro Cities: ${totalMetros}`);
  console.log(`Already Connected: ${connectedCount} (${Math.round(connectedCount/totalMetros*100)}%)`);
  console.log(`Needs Connection: ${unconnectedMetros.length} (${Math.round(unconnectedMetros.length/totalMetros*100)}%)`);
  console.log(`\nTotal Rivers in Dataset: ${riversData.features.length}`);
  
  // Count by tier
  const majorRivers = riversData.features.filter(r => 
    r.properties.baseline_flow_cfs_2025 > 10000
  ).length;
  const significantRivers = riversData.features.filter(r => 
    r.properties.baseline_flow_cfs_2025 >= 500 && r.properties.baseline_flow_cfs_2025 <= 10000
  ).length;
  const feederRivers = riversData.features.filter(r => 
    r.properties.baseline_flow_cfs_2025 < 500
  ).length;
  
  console.log(`  - Major Rivers (>10k CFS): ${majorRivers}`);
  console.log(`  - Significant (500-10k CFS): ${significantRivers}`);
  console.log(`  - Feeder (<500 CFS): ${feederRivers}`);
  
  console.log('\n🔍 Top 10 Unconnected Metros (by population):');
  const topUnconnected = unconnectedMetros
    .sort((a, b) => b.populations['2025'] - a.populations['2025'])
    .slice(0, 10);
  
  topUnconnected.forEach((metro, i) => {
    const pop = metro.populations['2025'].toLocaleString();
    console.log(`  ${i + 1}. ${metro.name} (${pop} people, ${metro.region})`);
  });
  
  return {
    totalMetros,
    connectedCount,
    unconnectedCount: unconnectedMetros.length,
    topUnconnected: topUnconnected.map(m => ({
      name: m.name,
      population: m.populations['2025'],
      region: m.region
    }))
  };
}

// Main execution
function main() {
  console.log('🌊 River-Metro Matching Tool');
  console.log('='.repeat(60));
  
  try {
    // Load data
    console.log('\n📂 Loading data...');
    const { metroData, riversData } = loadData();
    console.log(`✅ Loaded ${metroData.metros.length} metros and ${riversData.features.length} rivers`);
    
    // Find connected cities
    console.log('\n🔗 Analyzing existing connections...');
    const connectedCities = findConnectedCities(riversData);
    console.log(`✅ Found ${connectedCities.size} cities already connected`);
    
    // Find unconnected metros
    const unconnectedMetros = findUnconnectedMetros(metroData, connectedCities);
    console.log(`\n⚠️  Found ${unconnectedMetros.length} metros without river connections`);
    
    // Generate report
    const report = generateReport(metroData, riversData, unconnectedMetros);
    
    // Generate curation template
    console.log('\n📝 Generating curation template...');
    const template = generateCurationTemplate(unconnectedMetros, riversData);
    
    const templatePath = path.join(__dirname, '../apps/climate-studio/src/data/river-metro-curation-template.json');
    fs.writeFileSync(templatePath, JSON.stringify(template, null, 2));
    console.log(`✅ Template saved to: ${templatePath}`);
    
    // Generate summary
    const summaryPath = path.join(__dirname, '../apps/climate-studio/src/data/river-metro-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(report, null, 2));
    console.log(`✅ Summary saved to: ${summaryPath}`);
    
    console.log('\n✨ Analysis complete!');
    console.log('\nNext steps:');
    console.log('  1. Review the curation template');
    console.log('  2. Research each unconnected metro\'s water sources');
    console.log('  3. Add river connections to metro-connecting-rivers.json');
    console.log('  4. Use the data in MegaregionLayer component');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  loadData,
  findConnectedCities,
  findUnconnectedMetros,
  findNearbyRivers,
  generateCurationTemplate,
  generateReport
};
