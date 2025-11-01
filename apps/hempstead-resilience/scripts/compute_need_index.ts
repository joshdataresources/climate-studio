/**
 * compute_need_index.ts
 * Computes the Resilience Need Index for each grid cell
 *
 * Formula: NeedIndex = (0.5 × FloodDepthNorm) + (0.3 × ElevationInverse) + (0.2 × NoProjectFlag)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface InputData {
  lon: number;
  lat: number;
  flood_depth_m: number;
  elevation_m: number;
  slr_ft: number;
  year_projected: number;
  flood_zone?: string;
  bfe_m?: number;
}

interface ResilienceNeed {
  lon: number;
  lat: number;
  need_index: number;
  risk_category: 'High' | 'Medium' | 'Low';
  elevation_m: number;
  flood_depth_m: number;
  year: number;
  slr_ft: number;
  has_project: boolean;
  recommended_action: string;
  flood_zone?: string;
}

const BBOX = {
  minLon: -73.75,
  minLat: 40.60,
  maxLon: -73.45,
  maxLat: 40.70
};

/**
 * Load input data files
 */
function loadInputData(): InputData[] {
  const noaaPath = path.join(__dirname, '../data/inputs/noaa_slr_data.geojson');
  const elevPath = path.join(__dirname, '../data/inputs/elevation_dem.geojson');
  const femaPath = path.join(__dirname, '../data/inputs/fema_flood_hazard.geojson');
  const projectsPath = path.join(__dirname, '../data/resilience_projects.geojson');

  // Load GeoJSON files
  const noaaData = JSON.parse(fs.readFileSync(noaaPath, 'utf-8'));
  const elevData = JSON.parse(fs.readFileSync(elevPath, 'utf-8'));
  const femaData = JSON.parse(fs.readFileSync(femaPath, 'utf-8'));
  const projectsData = JSON.parse(fs.readFileSync(projectsPath, 'utf-8'));

  // Create spatial index of existing projects (simplified nearest neighbor)
  const projectLocations = projectsData.features.map((f: any) => ({
    lon: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1]
  }));

  // Merge datasets by coordinates
  const dataMap = new Map<string, InputData>();

  // Index elevation data
  const elevMap = new Map<string, number>();
  elevData.features.forEach((f: any) => {
    const [lon, lat] = f.geometry.coordinates;
    const key = `${lon.toFixed(3)},${lat.toFixed(3)}`;
    elevMap.set(key, f.properties.elevation_m);
  });

  // Index FEMA data
  const femaMap = new Map<string, any>();
  femaData.features.forEach((f: any) => {
    const [lon, lat] = f.geometry.coordinates;
    const key = `${lon.toFixed(3)},${lat.toFixed(3)}`;
    femaMap.set(key, {
      flood_zone: f.properties.flood_zone,
      bfe_m: f.properties.bfe_m
    });
  });

  // Process NOAA data and merge
  noaaData.features.forEach((f: any) => {
    const [lon, lat] = f.geometry.coordinates;
    const key = `${lon.toFixed(3)},${lat.toFixed(3)}`;

    const elevation_m = elevMap.get(key) || 0;
    const fema = femaMap.get(key) || {};

    dataMap.set(key, {
      lon,
      lat,
      flood_depth_m: f.properties.flood_depth_m,
      elevation_m,
      slr_ft: f.properties.slr_ft,
      year_projected: f.properties.year_projected,
      flood_zone: fema.flood_zone,
      bfe_m: fema.bfe_m
    });
  });

  return Array.from(dataMap.values());
}

/**
 * Check if location has existing resilience project nearby
 */
function hasNearbyProject(lon: number, lat: number, projects: any[]): boolean {
  const THRESHOLD_KM = 0.5; // 500m radius

  for (const project of projects) {
    const [pLon, pLat] = project.geometry.coordinates;

    // Haversine distance (simplified)
    const dLon = (pLon - lon) * Math.PI / 180;
    const dLat = (pLat - lat) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat * Math.PI / 180) * Math.cos(pLat * Math.PI / 180) *
              Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance_km = 6371 * c;

    if (distance_km < THRESHOLD_KM) {
      return true;
    }
  }

  return false;
}

/**
 * Compute Resilience Need Index
 */
function computeNeedIndex(data: InputData[]): ResilienceNeed[] {
  console.log('Computing Resilience Need Index...');

  // Load existing projects
  const projectsPath = path.join(__dirname, '../data/resilience_projects.geojson');
  const projectsData = JSON.parse(fs.readFileSync(projectsPath, 'utf-8'));

  // Normalize flood depth (0-1 scale)
  const maxFloodDepth = Math.max(...data.map(d => d.flood_depth_m));
  const minFloodDepth = Math.min(...data.map(d => d.flood_depth_m));

  // Normalize elevation (inverse: lower elevation = higher risk)
  const maxElevation = Math.max(...data.map(d => d.elevation_m));
  const minElevation = Math.min(...data.map(d => d.elevation_m));

  const results: ResilienceNeed[] = data.map(point => {
    // Normalized flood depth (0-1)
    const floodDepthNorm = (point.flood_depth_m - minFloodDepth) / (maxFloodDepth - minFloodDepth);

    // Elevation inverse (0-1, where low elevation = 1, high elevation = 0)
    const elevationInverse = 1 - ((point.elevation_m - minElevation) / (maxElevation - minElevation));

    // Check for existing project
    const has_project = hasNearbyProject(point.lon, point.lat, projectsData.features);
    const noProjectFlag = has_project ? 0 : 1;

    // Compute Need Index
    const need_index = (0.5 * floodDepthNorm) + (0.3 * elevationInverse) + (0.2 * noProjectFlag);

    // Categorize risk
    let risk_category: 'High' | 'Medium' | 'Low';
    if (need_index >= 0.7) {
      risk_category = 'High';
    } else if (need_index >= 0.4) {
      risk_category = 'Medium';
    } else {
      risk_category = 'Low';
    }

    // Recommend action based on risk and existing projects
    let recommended_action: string;
    if (risk_category === 'High' && !has_project) {
      if (point.elevation_m < 2) {
        recommended_action = 'Living shoreline + marsh restoration';
      } else if (point.flood_depth_m > 3) {
        recommended_action = 'Road elevation + drainage upgrades + tidal check valves';
      } else {
        recommended_action = 'Drainage improvements + green infrastructure';
      }
    } else if (risk_category === 'Medium' && !has_project) {
      recommended_action = 'Stormwater management + bioswales';
    } else if (risk_category === 'High' && has_project) {
      recommended_action = 'Monitor existing project performance';
    } else {
      recommended_action = 'Continue monitoring';
    }

    return {
      lon: point.lon,
      lat: point.lat,
      need_index,
      risk_category,
      elevation_m: point.elevation_m,
      flood_depth_m: point.flood_depth_m,
      year: point.year_projected,
      slr_ft: point.slr_ft,
      has_project,
      recommended_action,
      flood_zone: point.flood_zone
    };
  });

  console.log(`✓ Computed need index for ${results.length} locations`);

  return results;
}

/**
 * Convert to GeoJSON
 */
function convertToGeoJSON(results: ResilienceNeed[]) {
  const features = results.map(point => ({
    type: 'Feature' as const,
    geometry: {
      type: 'Point' as const,
      coordinates: [point.lon, point.lat]
    },
    properties: {
      need_index: Math.round(point.need_index * 1000) / 1000,
      risk_category: point.risk_category,
      elevation_m: Math.round(point.elevation_m * 100) / 100,
      flood_depth_m: Math.round(point.flood_depth_m * 100) / 100,
      year: point.year,
      slr_ft: point.slr_ft,
      has_project: point.has_project,
      recommended_action: point.recommended_action,
      flood_zone: point.flood_zone
    }
  }));

  return {
    type: 'FeatureCollection' as const,
    features
  };
}

/**
 * Generate summary statistics and CSV
 */
function generateSummary(results: ResilienceNeed[]): void {
  // Filter high-risk zones without existing projects
  const highRiskNoProject = results
    .filter(r => r.risk_category === 'High' && !r.has_project)
    .sort((a, b) => b.need_index - a.need_index)
    .slice(0, 10);

  // Generate CSV
  const csvHeader = 'name,lat,lon,need_index,elevation_m,flood_depth_m,year,recommended_action\n';
  const csvRows = highRiskNoProject.map((r, i) => {
    const name = `High-Risk Zone ${i + 1} (${r.lat.toFixed(4)}°N, ${Math.abs(r.lon).toFixed(4)}°W)`;
    return `"${name}",${r.lat},${r.lon},${r.need_index.toFixed(3)},${r.elevation_m.toFixed(2)},${r.flood_depth_m.toFixed(2)},${r.year},"${r.recommended_action}"`;
  }).join('\n');

  const csv = csvHeader + csvRows;

  const outputPath = path.join(__dirname, '../output/summary_table.csv');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, csv);

  console.log(`✓ Saved summary CSV to: ${outputPath}`);

  // Print statistics
  const risklevel = results.reduce((acc, r) => {
    acc[r.risk_category] = (acc[r.risk_category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\nRisk Category Distribution:');
  Object.entries(risklevel)
    .sort(([, a], [, b]) => b - a)
    .forEach(([cat, count]) => {
      const pct = ((count / results.length) * 100).toFixed(1);
      console.log(`  ${cat}: ${count} (${pct}%)`);
    });

  console.log(`\nHigh-risk zones without projects: ${highRiskNoProject.length}`);

  // Neighborhood analysis
  const neighborhoods = [
    'Rockville Centre', 'Baldwin', 'Freeport', 'Merrick',
    'Bellmore', 'Wantagh', 'Massapequa'
  ];

  console.log('\nTop 10 Unprotected High-Risk Zones:');
  console.table(highRiskNoProject.map((r, i) => ({
    Rank: i + 1,
    Lat: r.lat.toFixed(4),
    Lon: r.lon.toFixed(4),
    'Need Index': r.need_index.toFixed(3),
    'Elev (m)': r.elevation_m.toFixed(2),
    'Flood (m)': r.flood_depth_m.toFixed(2),
    Year: r.year,
    Action: r.recommended_action
  })));
}

/**
 * Main function
 */
async function computeAndSaveNeedIndex(): Promise<void> {
  try {
    console.log('Loading input datasets...');
    const inputData = loadInputData();

    const results = computeNeedIndex(inputData);

    // Save GeoJSON
    const geojson = convertToGeoJSON(results);
    const outputPath = path.join(__dirname, '../data/resilience_needs.geojson');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));

    console.log(`✓ Saved resilience needs GeoJSON to: ${outputPath}`);

    // Generate summary
    generateSummary(results);

  } catch (error) {
    console.error('Error computing need index:', error);
    throw error;
  }
}

export { computeAndSaveNeedIndex, computeNeedIndex };

// Run if called directly
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  computeAndSaveNeedIndex().catch(console.error);
}
