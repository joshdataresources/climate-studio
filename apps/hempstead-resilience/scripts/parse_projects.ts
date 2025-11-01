/**
 * parse_projects.ts
 * Extracts project information from the Town of Hempstead document and generates GeoJSON
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Project {
  name: string;
  type: string;
  location: string;
  neighborhood: string;
  description: string;
  lat: number;
  lon: number;
  status: string;
  funding?: string;
}

interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    name: string;
    type: string;
    location: string;
    neighborhood: string;
    description: string;
    status: string;
    funding?: string;
  };
}

interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

// Known coordinates for key locations in the target area (geocoded via Nominatim)
const LOCATION_COORDS: Record<string, [number, number]> = {
  // [lon, lat] format for GeoJSON
  'Rockville Centre': [-73.6412, 40.6587],
  'Baldwin': [-73.6093, 40.6565],
  'Baldwin Park': [-73.6093, 40.6565],
  'Freeport': [-73.5832, 40.6576],
  'Merrick': [-73.5513, 40.6629],
  'Bellmore': [-73.5271, 40.6687],
  'Wantagh': [-73.5101, 40.6837],
  'Seaford': [-73.4882, 40.6657],
  'Massapequa': [-73.4743, 40.6807],
  'Bay Park': [-73.6555, 40.6165],
  'Point Lookout': [-73.5812, 40.5930],
  'Lido Beach': [-73.6180, 40.5884],
  'Long Beach': [-73.6579, 40.5887],
  'Oceanside': [-73.6401, 40.6387],
  'East Rockaway': [-73.6696, 40.6421],
  'Woodmere': [-73.7124, 40.6321],
  'Inwood': [-73.7465, 40.6221],
  'Island Park': [-73.6554, 40.6043],
  'Harbor Isle': [-73.6654, 40.6043],
  'Mill River': [-73.6912, 40.6587],
  'Hempstead Bay': [-73.6500, 40.6000],
  'Middle Bay': [-73.6000, 40.5800],
  'Reynolds Channel': [-73.6300, 40.5900]
};

// Extract projects from the document
const projects: Project[] = [
  // Road Elevation & Drainage Projects
  {
    name: 'Bay Park Road Elevation (East, West, North Boulevards)',
    type: 'Road Elevation & Drainage',
    location: 'Bay Park',
    neighborhood: 'Bay Park',
    description: 'Raised and improved roads to mitigate chronic flooding, installed 17 tidal check valves, bioswales, and rain gardens',
    lat: 40.6165,
    lon: -73.6555,
    status: 'Completed',
    funding: 'HUD CDBG-DR ($125M Living with the Bay program)'
  },
  {
    name: 'Baldwin Drainage Upgrades',
    type: 'Road Elevation & Drainage',
    location: 'Baldwin',
    neighborhood: 'Baldwin',
    description: 'Storm drain improvements and tidal check valves to reduce flooding',
    lat: 40.6565,
    lon: -73.6093,
    status: 'Completed',
    funding: 'NY Rising Community Reconstruction'
  },
  {
    name: 'Bellmore-Wantagh Street Elevation',
    type: 'Road Elevation & Drainage',
    location: 'Bellmore-Wantagh',
    neighborhood: 'Bellmore',
    description: 'Low-lying streets elevated with new storm drains to reduce tidal flooding',
    lat: 40.6687,
    lon: -73.5271,
    status: 'Completed',
    funding: 'NY Rising Community Reconstruction'
  },
  {
    name: 'Merrick Drainage Improvements',
    type: 'Road Elevation & Drainage',
    location: 'Merrick',
    neighborhood: 'Merrick',
    description: 'Storm sewer upgrades and tidal check valves',
    lat: 40.6629,
    lon: -73.5513,
    status: 'Completed',
    funding: 'NY Rising Community Reconstruction'
  },
  {
    name: 'Seaford Street Elevation & Shoreline Protection',
    type: 'Road Elevation & Drainage',
    location: 'Seaford',
    neighborhood: 'Seaford',
    description: 'Road raising, new storm drains, and timber/vinyl bulkhead at Anchor Place',
    lat: 40.6657,
    lon: -73.4882,
    status: 'Completed',
    funding: 'NY Rising Community Reconstruction'
  },
  {
    name: 'Woodmere Drainage & Street Elevation',
    type: 'Road Elevation & Drainage',
    location: 'Woodmere',
    neighborhood: 'Woodmere',
    description: 'Street elevation and storm drain improvements in Five Towns area',
    lat: 40.6321,
    lon: -73.7124,
    status: 'Completed',
    funding: 'NY Rising Community Reconstruction'
  },
  {
    name: 'Oceanside Stormwater Improvements',
    type: 'Road Elevation & Drainage',
    location: 'Oceanside',
    neighborhood: 'Oceanside',
    description: 'Larger storm drain pipes, additional catch basins, and pump stations',
    lat: 40.6387,
    lon: -73.6401,
    status: 'Completed',
    funding: 'NY Rising Community Reconstruction'
  },

  // Living Shorelines & Natural Barriers
  {
    name: 'Baldwin Park Living Shoreline',
    type: 'Living Shoreline',
    location: 'Baldwin Park (Middle Bay)',
    neighborhood: 'Baldwin',
    description: 'Replacing failing timber bulkhead with natural living shoreline, tidal wetlands, marsh grasses, shrubs, and upland trees',
    lat: 40.6565,
    lon: -73.6093,
    status: 'Completed',
    funding: 'NY Rising Community Reconstruction'
  },
  {
    name: 'Middle Hempstead Bay Living Barrier Reef',
    type: 'Living Shoreline',
    location: 'Middle Hempstead Bay',
    neighborhood: 'Hempstead Bay',
    description: 'Artificial oyster reef using recycled shells from restaurants to dampen waves, reduce erosion, and improve water quality',
    lat: 40.6000,
    lon: -73.6500,
    status: 'Active/Ongoing',
    funding: 'Town funds + NGO partnerships (CCE, Operation SPLASH)'
  },

  // Marsh Restoration
  {
    name: 'Hempstead Bay Marsh Restoration (Mill River)',
    type: 'Marsh Restoration',
    location: 'Hempstead Bay / Mill River',
    neighborhood: 'Mill River',
    description: 'Create 200 linear feet of living shoreline and restore 9 acres of tidal marsh using thin-layer sediment deposition',
    lat: 40.6587,
    lon: -73.6912,
    status: 'In Progress',
    funding: 'NOAA National Coastal Resilience Fund ($10M + $5.76M match)'
  },
  {
    name: 'Pearsalls Hassock Marsh Restoration',
    type: 'Marsh Restoration',
    location: 'Pearsalls Hassock',
    neighborhood: 'Hempstead Bay',
    description: 'Re-establish historic elevations, fill ditches, construct living shoreline edges',
    lat: 40.5950,
    lon: -73.6400,
    status: 'Planned',
    funding: 'Nassau County + NYS funds'
  },
  {
    name: 'South Black Banks Hassock Restoration',
    type: 'Marsh Restoration',
    location: 'South Black Banks Hassock',
    neighborhood: 'Hempstead Bay',
    description: 'Stabilize eroding marsh and improve habitat through elevation restoration',
    lat: 40.5900,
    lon: -73.6350,
    status: 'Planned',
    funding: 'Nassau County + NYS funds'
  },

  // Dunes, Berms & Beach Nourishment
  {
    name: 'Long Beach Barrier Island Dune System',
    type: 'Dune & Beach Nourishment',
    location: 'Long Beach Island (Point Lookout to East Rockaway Inlet)',
    neighborhood: 'Point Lookout',
    description: '7-mile continuous dune (~16 ft elevation), raised beach berm (~5 ft), 4M cubic yards of sand, new groins',
    lat: 40.5930,
    lon: -73.5812,
    status: 'Completed',
    funding: 'U.S. Army Corps + Federal Sandy Relief (~$150M)'
  },
  {
    name: 'Point Lookout Stone Revetment',
    type: 'Shoreline Stabilization',
    location: 'Point Lookout (Jones Inlet)',
    neighborhood: 'Point Lookout',
    description: '2,000 linear feet of stone revetment and shoreline stabilization',
    lat: 40.5930,
    lon: -73.5812,
    status: 'Completed',
    funding: 'NY Rising Community Reconstruction'
  },

  // Critical Infrastructure
  {
    name: 'South Shore Water Reclamation Facility (Bay Park Plant) Hardening',
    type: 'Critical Infrastructure',
    location: 'Bay Park',
    neighborhood: 'Bay Park',
    description: 'Earthen berm and floodwall (500-year flood level), tidal flood gates, elevated pumps and electrical systems',
    lat: 40.6165,
    lon: -73.6555,
    status: 'Completed',
    funding: 'FEMA (~$830M)'
  },
  {
    name: 'Bay Park Conveyance Project',
    type: 'Critical Infrastructure',
    location: 'Bay Park to Cedar Creek',
    neighborhood: 'Bay Park',
    description: 'Divert 50M gallons/day of treated wastewater from Hempstead Bay to improve water quality and marsh health',
    lat: 40.6165,
    lon: -73.6555,
    status: 'In Progress',
    funding: 'NYS + Nassau County (~$439M, $300M state)'
  },
  {
    name: 'Long Beach Wastewater Plant Consolidation',
    type: 'Critical Infrastructure',
    location: 'Long Beach',
    neighborhood: 'Long Beach',
    description: 'Convert to hardened pump station with backup power and flood barriers, elevate sewer pump stations above 500-year surge',
    lat: 40.5887,
    lon: -73.6579,
    status: 'In Progress',
    funding: 'Nassau County + NYS'
  },

  // Green Infrastructure
  {
    name: 'Mill River Greenway',
    type: 'Green Infrastructure',
    location: 'Mill River Watershed',
    neighborhood: 'Mill River',
    description: 'Greenway route with stormwater management features and bioretention',
    lat: 40.6587,
    lon: -73.6912,
    status: 'Completed',
    funding: 'Living with the Bay ($125M CDBG-DR)'
  },
  {
    name: 'Smith Pond & Hempstead Lake Upgrades',
    type: 'Green Infrastructure',
    location: 'Hempstead Lake State Park',
    neighborhood: 'Hempstead',
    description: 'Stormwater park and habitat improvements at headwaters of Mill River',
    lat: 40.6850,
    lon: -73.6200,
    status: 'Completed',
    funding: 'Living with the Bay ($125M CDBG-DR)'
  }
];

async function geocodeLocation(locationName: string): Promise<[number, number] | null> {
  // First check our known coordinates
  if (LOCATION_COORDS[locationName]) {
    return LOCATION_COORDS[locationName];
  }

  // For unknown locations, try Nominatim API (with delay to respect rate limits)
  try {
    const encodedLocation = encodeURIComponent(`${locationName}, Nassau County, New York, USA`);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedLocation}&limit=1`,
      {
        headers: {
          'User-Agent': 'HempsteadResilienceProject/1.0'
        }
      }
    );

    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit: 1 request/second

    const data = await response.json();
    if (data && data.length > 0) {
      return [parseFloat(data[0].lon), parseFloat(data[0].lat)];
    }
  } catch (error) {
    console.error(`Failed to geocode ${locationName}:`, error);
  }

  return null;
}

async function generateProjectGeoJSON(): Promise<void> {
  console.log('Generating resilience projects GeoJSON...');

  const features: GeoJSONFeature[] = projects.map(project => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [project.lon, project.lat]
    },
    properties: {
      name: project.name,
      type: project.type,
      location: project.location,
      neighborhood: project.neighborhood,
      description: project.description,
      status: project.status,
      funding: project.funding
    }
  }));

  const geojson: GeoJSONFeatureCollection = {
    type: 'FeatureCollection',
    features
  };

  // Write to output file
  const outputPath = path.join(__dirname, '../data/resilience_projects.geojson');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));

  console.log(`✓ Generated ${features.length} project features`);
  console.log(`✓ Saved to: ${outputPath}`);

  // Print summary by neighborhood
  const neighborhoodCounts = projects.reduce((acc, p) => {
    acc[p.neighborhood] = (acc[p.neighborhood] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\nProjects by neighborhood:');
  Object.entries(neighborhoodCounts)
    .sort(([, a], [, b]) => b - a)
    .forEach(([neighborhood, count]) => {
      console.log(`  ${neighborhood}: ${count}`);
    });
}

export { generateProjectGeoJSON, projects };

// Run if called directly
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  generateProjectGeoJSON().catch(console.error);
}
