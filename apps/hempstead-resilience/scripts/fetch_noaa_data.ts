/**
 * fetch_noaa_data.ts
 * Fetches NOAA Sea Level Rise data for the Hempstead area
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Bounding box for Town of Hempstead coastal area
const BBOX = {
  minLon: -73.75,
  minLat: 40.60,
  maxLon: -73.45,
  maxLat: 40.70
};

// Sea level rise scenarios in feet
const SLR_SCENARIOS = [1, 2, 3, 4, 5, 6];

// Approximate year mappings based on NOAA projections (intermediate scenario)
const YEAR_MAPPING: Record<number, number> = {
  1: 2030,
  2: 2040,
  3: 2050,
  4: 2060,
  5: 2070,
  6: 2080
};

interface NOAADataPoint {
  lon: number;
  lat: number;
  slr_ft: number;
  flood_depth_ft: number;
  year_projected: number;
  confidence: string;
}

/**
 * Generate sampling grid within bounding box
 */
function generateSamplingGrid(resolution: number = 0.01): Array<[number, number]> {
  const points: Array<[number, number]> = [];

  for (let lon = BBOX.minLon; lon <= BBOX.maxLon; lon += resolution) {
    for (let lat = BBOX.minLat; lat <= BBOX.maxLat; lat += resolution) {
      points.push([lon, lat]);
    }
  }

  return points;
}

/**
 * Simulate NOAA SLR data (in production, this would call actual NOAA API)
 *
 * NOAA Sea Level Rise Viewer API endpoints:
 * - https://coast.noaa.gov/slrdata/
 * - https://chs.coast.noaa.gov/slr/
 *
 * For actual implementation, use:
 * https://coast.noaa.gov/arcgis/rest/services/dc_slr/slr_0ft/MapServer/
 * https://coast.noaa.gov/arcgis/rest/services/dc_slr/slr_1ft/MapServer/
 * etc.
 */
async function fetchNOAASLRData(): Promise<NOAADataPoint[]> {
  console.log('Fetching NOAA Sea Level Rise data...');

  const samplingPoints = generateSamplingGrid(0.01); // ~0.6 mile grid
  const dataPoints: NOAADataPoint[] = [];

  console.log(`Generated ${samplingPoints.length} sampling points`);

  for (const slr_ft of SLR_SCENARIOS) {
    console.log(`Processing ${slr_ft}ft scenario (year ~${YEAR_MAPPING[slr_ft]})...`);

    // In production, call NOAA API here
    // const apiUrl = `https://coast.noaa.gov/arcgis/rest/services/dc_slr/slr_${slr_ft}ft/MapServer/export`;

    // Simulate flood depth based on proximity to coast and elevation
    for (const [lon, lat] of samplingPoints) {
      // Simple simulation: flood depth increases near coast (lower latitude)
      const distanceFromCoast = lat - BBOX.minLat;
      const normalizedDistance = distanceFromCoast / (BBOX.maxLat - BBOX.minLat);

      // Areas closer to coast (lower normalized distance) have higher flood risk
      const baseFloodDepth = (1 - normalizedDistance) * slr_ft * 1.5;

      // Add some variation based on longitude (different bays/inlets)
      const longitudeVariation = Math.sin((lon - BBOX.minLon) * 10) * 0.5;

      const flood_depth_ft = Math.max(0, baseFloodDepth + longitudeVariation);

      if (flood_depth_ft > 0.1) { // Only include areas with significant flooding
        dataPoints.push({
          lon,
          lat,
          slr_ft,
          flood_depth_ft,
          year_projected: YEAR_MAPPING[slr_ft],
          confidence: slr_ft <= 3 ? 'high' : slr_ft <= 4 ? 'medium' : 'low'
        });
      }
    }
  }

  console.log(`✓ Generated ${dataPoints.length} flood projection points`);

  return dataPoints;
}

/**
 * Convert to GeoJSON format
 */
function convertToGeoJSON(dataPoints: NOAADataPoint[]) {
  const features = dataPoints.map(point => ({
    type: 'Feature' as const,
    geometry: {
      type: 'Point' as const,
      coordinates: [point.lon, point.lat]
    },
    properties: {
      slr_ft: point.slr_ft,
      flood_depth_ft: point.flood_depth_ft,
      flood_depth_m: point.flood_depth_ft * 0.3048,
      year_projected: point.year_projected,
      confidence: point.confidence
    }
  }));

  return {
    type: 'FeatureCollection' as const,
    features
  };
}

/**
 * Main function to fetch and save NOAA data
 */
async function fetchAndSaveNOAAData(): Promise<void> {
  try {
    const dataPoints = await fetchNOAASLRData();
    const geojson = convertToGeoJSON(dataPoints);

    // Save to file
    const outputPath = path.join(__dirname, '../data/inputs/noaa_slr_data.geojson');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));

    console.log(`✓ Saved NOAA SLR data to: ${outputPath}`);

    // Print summary statistics
    const scenarios = SLR_SCENARIOS.map(slr => {
      const scenarioPoints = dataPoints.filter(p => p.slr_ft === slr);
      const avgDepth = scenarioPoints.reduce((sum, p) => sum + p.flood_depth_ft, 0) / scenarioPoints.length;
      const maxDepth = Math.max(...scenarioPoints.map(p => p.flood_depth_ft));

      return {
        slr_ft: slr,
        year: YEAR_MAPPING[slr],
        points: scenarioPoints.length,
        avg_depth_ft: avgDepth.toFixed(2),
        max_depth_ft: maxDepth.toFixed(2)
      };
    });

    console.log('\nScenario Summary:');
    console.table(scenarios);

  } catch (error) {
    console.error('Error fetching NOAA data:', error);
    throw error;
  }
}

export { fetchAndSaveNOAAData, fetchNOAASLRData, BBOX, YEAR_MAPPING };

// Run if called directly
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  fetchAndSaveNOAAData().catch(console.error);
}
