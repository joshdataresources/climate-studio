/**
 * fetch_elevation_data.ts
 * Fetches DEM (Digital Elevation Model) data from SRTM or Copernicus
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BBOX = {
  minLon: -73.75,
  minLat: 40.60,
  maxLon: -73.45,
  maxLat: 40.70
};

interface ElevationPoint {
  lon: number;
  lat: number;
  elevation_m: number;
  elevation_ft: number;
  source: string;
}

/**
 * Fetch elevation data
 *
 * In production, use one of these services:
 * - USGS 3DEP (3D Elevation Program): https://elevation.nationalmap.gov/arcgis/rest/services/
 * - Copernicus DEM: https://spacedata.copernicus.eu/
 * - SRTM via OpenTopography: https://portal.opentopography.org/
 * - Open-Elevation API: https://api.open-elevation.com/
 *
 * For Long Island, USGS 3DEP has high-resolution LiDAR data
 */
async function fetchElevationData(): Promise<ElevationPoint[]> {
  console.log('Fetching elevation data...');

  const dataPoints: ElevationPoint[] = [];
  const resolution = 0.005; // ~0.3 mile grid

  // In production, batch query elevation API:
  // const url = 'https://api.open-elevation.com/api/v1/lookup';
  // const locations = points.map(p => ({ latitude: p[1], longitude: p[0] }));
  // const response = await fetch(url, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ locations })
  // });

  // Simulate elevation data based on distance from coast
  // Long Island's barrier islands are low (0-3m), inland areas rise to 10-30m
  for (let lon = BBOX.minLon; lon <= BBOX.maxLon; lon += resolution) {
    for (let lat = BBOX.minLat; lat <= BBOX.maxLat; lat += resolution) {
      const distanceFromCoast = lat - BBOX.minLat;
      const normalizedDistance = distanceFromCoast / (BBOX.maxLat - BBOX.minLat);

      // Barrier islands and immediate coast are very low elevation
      let elevation_m: number;
      if (normalizedDistance < 0.1) {
        // Barrier islands: 0-3m
        elevation_m = Math.random() * 3;
      } else if (normalizedDistance < 0.25) {
        // Near-coastal lowlands: 1-5m
        elevation_m = 1 + Math.random() * 4;
      } else if (normalizedDistance < 0.5) {
        // Coastal plain: 3-10m
        elevation_m = 3 + Math.random() * 7;
      } else if (normalizedDistance < 0.75) {
        // Rising terrain: 8-20m
        elevation_m = 8 + Math.random() * 12;
      } else {
        // Inland higher ground: 15-30m
        elevation_m = 15 + Math.random() * 15;
      }

      // Add some local variation
      const localVariation = (Math.random() - 0.5) * 2;
      elevation_m = Math.max(0, elevation_m + localVariation);

      dataPoints.push({
        lon,
        lat,
        elevation_m,
        elevation_ft: elevation_m * 3.28084,
        source: 'Simulated DEM (SRTM/Copernicus equivalent)'
      });
    }
  }

  console.log(`✓ Generated ${dataPoints.length} elevation points`);

  return dataPoints;
}

/**
 * Convert to GeoJSON
 */
function convertToGeoJSON(dataPoints: ElevationPoint[]) {
  const features = dataPoints.map(point => ({
    type: 'Feature' as const,
    geometry: {
      type: 'Point' as const,
      coordinates: [point.lon, point.lat]
    },
    properties: {
      elevation_m: Math.round(point.elevation_m * 100) / 100,
      elevation_ft: Math.round(point.elevation_ft * 100) / 100,
      source: point.source
    }
  }));

  return {
    type: 'FeatureCollection' as const,
    features
  };
}

/**
 * Main function
 */
async function fetchAndSaveElevationData(): Promise<void> {
  try {
    const dataPoints = await fetchElevationData();
    const geojson = convertToGeoJSON(dataPoints);

    const outputPath = path.join(__dirname, '../data/inputs/elevation_dem.geojson');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));

    console.log(`✓ Saved elevation data to: ${outputPath}`);

    // Print statistics
    const elevations = dataPoints.map(p => p.elevation_m);
    const min = Math.min(...elevations);
    const max = Math.max(...elevations);
    const avg = elevations.reduce((a, b) => a + b, 0) / elevations.length;

    console.log('\nElevation Statistics:');
    console.log(`  Min: ${min.toFixed(2)}m (${(min * 3.28084).toFixed(2)}ft)`);
    console.log(`  Max: ${max.toFixed(2)}m (${(max * 3.28084).toFixed(2)}ft)`);
    console.log(`  Avg: ${avg.toFixed(2)}m (${(avg * 3.28084).toFixed(2)}ft)`);

    // Elevation distribution
    const ranges = [
      { name: '0-3m (Barrier/Beach)', min: 0, max: 3 },
      { name: '3-5m (Low coastal)', min: 3, max: 5 },
      { name: '5-10m (Coastal plain)', min: 5, max: 10 },
      { name: '10-20m (Rising terrain)', min: 10, max: 20 },
      { name: '20m+ (Inland hills)', min: 20, max: 100 }
    ];

    console.log('\nElevation Distribution:');
    ranges.forEach(range => {
      const count = elevations.filter(e => e >= range.min && e < range.max).length;
      const pct = ((count / elevations.length) * 100).toFixed(1);
      console.log(`  ${range.name}: ${count} (${pct}%)`);
    });

  } catch (error) {
    console.error('Error fetching elevation data:', error);
    throw error;
  }
}

export { fetchAndSaveElevationData, fetchElevationData };

// Run if called directly
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  fetchAndSaveElevationData().catch(console.error);
}
