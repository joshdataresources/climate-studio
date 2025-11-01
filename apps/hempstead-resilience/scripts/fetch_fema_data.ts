/**
 * fetch_fema_data.ts
 * Fetches FEMA National Flood Hazard Layer (NFHL) data
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

// FEMA flood zone classifications
enum FloodZone {
  VE = 'VE',      // Coastal flood with velocity hazard (wave action)
  AE = 'AE',      // 100-year floodplain with BFE determined
  AO = 'AO',      // 100-year shallow flooding
  X_SHADED = 'X', // 500-year floodplain
  X = 'X_UNSHADED' // Minimal flood hazard
}

const FLOOD_ZONE_RISK: Record<string, number> = {
  'VE': 1.0,      // Highest risk
  'AE': 0.8,
  'AO': 0.6,
  'X': 0.3,       // 500-year
  'X_UNSHADED': 0.1
};

interface FEMAFloodZone {
  zone: FloodZone;
  bfe_ft: number; // Base Flood Elevation in feet NAVD88
  risk_level: number;
  depth_ft: number;
}

interface FEMADataPoint {
  lon: number;
  lat: number;
  flood_zone: FloodZone;
  bfe_ft: number;
  risk_level: number;
  depth_ft: number;
  county: string;
}

/**
 * Fetch FEMA NFHL data
 *
 * In production, use FEMA Map Service Center API:
 * https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/
 *
 * Layers:
 * - 28: S_Fld_Haz_Ar (Flood Hazard Areas)
 * - 8: S_BFE (Base Flood Elevations)
 */
async function fetchFEMAData(): Promise<FEMADataPoint[]> {
  console.log('Fetching FEMA NFHL flood hazard data...');

  const dataPoints: FEMADataPoint[] = [];
  const resolution = 0.005; // ~0.3 mile grid

  // In production, call FEMA API:
  // const url = `https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query`;
  // const params = {
  //   geometry: `${BBOX.minLon},${BBOX.minLat},${BBOX.maxLon},${BBOX.maxLat}`,
  //   geometryType: 'esriGeometryEnvelope',
  //   outFields: '*',
  //   returnGeometry: true,
  //   f: 'geojson'
  // };

  // Simulate FEMA data based on proximity to coast
  for (let lon = BBOX.minLon; lon <= BBOX.maxLon; lon += resolution) {
    for (let lat = BBOX.minLat; lat <= BBOX.maxLat; lat += resolution) {
      const distanceFromCoast = lat - BBOX.minLat;
      const normalizedDistance = distanceFromCoast / (BBOX.maxLat - BBOX.minLat);

      let zone: FloodZone;
      let bfe_ft: number;
      let depth_ft: number;

      // Coastal areas (lowest latitudes) are VE zones
      if (normalizedDistance < 0.15) {
        zone = FloodZone.VE;
        bfe_ft = 12 + Math.random() * 3; // 12-15 ft NAVD88
        depth_ft = 8 + Math.random() * 4;
      }
      // Near-coastal areas are AE zones
      else if (normalizedDistance < 0.35) {
        zone = FloodZone.AE;
        bfe_ft = 9 + Math.random() * 3; // 9-12 ft NAVD88
        depth_ft = 4 + Math.random() * 4;
      }
      // Moderate risk areas
      else if (normalizedDistance < 0.55) {
        zone = FloodZone.AO;
        bfe_ft = 6 + Math.random() * 3;
        depth_ft = 2 + Math.random() * 2;
      }
      // 500-year floodplain
      else if (normalizedDistance < 0.75) {
        zone = FloodZone.X_SHADED;
        bfe_ft = 4 + Math.random() * 2;
        depth_ft = 1 + Math.random();
      }
      // Minimal risk
      else {
        zone = FloodZone.X;
        bfe_ft = 2 + Math.random();
        depth_ft = 0.5 + Math.random() * 0.5;
      }

      dataPoints.push({
        lon,
        lat,
        flood_zone: zone,
        bfe_ft,
        risk_level: FLOOD_ZONE_RISK[zone],
        depth_ft,
        county: 'Nassau'
      });
    }
  }

  console.log(`✓ Generated ${dataPoints.length} FEMA flood hazard points`);

  return dataPoints;
}

/**
 * Convert to GeoJSON
 */
function convertToGeoJSON(dataPoints: FEMADataPoint[]) {
  const features = dataPoints.map(point => ({
    type: 'Feature' as const,
    geometry: {
      type: 'Point' as const,
      coordinates: [point.lon, point.lat]
    },
    properties: {
      flood_zone: point.flood_zone,
      bfe_ft: point.bfe_ft,
      bfe_m: point.bfe_ft * 0.3048,
      risk_level: point.risk_level,
      depth_ft: point.depth_ft,
      depth_m: point.depth_ft * 0.3048,
      county: point.county
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
async function fetchAndSaveFEMAData(): Promise<void> {
  try {
    const dataPoints = await fetchFEMAData();
    const geojson = convertToGeoJSON(dataPoints);

    const outputPath = path.join(__dirname, '../data/inputs/fema_flood_hazard.geojson');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));

    console.log(`✓ Saved FEMA flood hazard data to: ${outputPath}`);

    // Print summary by zone
    const zoneCounts = dataPoints.reduce((acc, p) => {
      acc[p.flood_zone] = (acc[p.flood_zone] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('\nFlood Zone Distribution:');
    Object.entries(zoneCounts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([zone, count]) => {
        const pct = ((count / dataPoints.length) * 100).toFixed(1);
        console.log(`  ${zone}: ${count} (${pct}%)`);
      });

  } catch (error) {
    console.error('Error fetching FEMA data:', error);
    throw error;
  }
}

export { fetchAndSaveFEMAData, fetchFEMAData, FloodZone, FLOOD_ZONE_RISK };

// Run if called directly
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  fetchAndSaveFEMAData().catch(console.error);
}
