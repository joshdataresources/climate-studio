/**
 * USGS Aquifer Service
 * Fetches aquifer polygon boundaries and groundwater level data from USGS APIs
 * 
 * DATA SOURCE:
 * - Primary: USGS Principal Aquifers via ArcGIS REST API
 *   - National endpoint: https://arcgis.water.nv.gov/arcgis/rest/services/BaseLayers/USGS_Aquifers_Principal/FeatureServer/0
 *   - NY State endpoint: https://services.arcgis.com/jDGuO8tYggdCCnUJ/arcgis/rest/services/Principal_aquifers/FeatureServer/0
 * 
 * - Fallback: Simplified polygon boundaries based on USGS Ground Water Atlas of the United States
 *   - Boundaries are approximations based on known geographic extents of major aquifer systems
 *   - Coordinates derived from USGS principal aquifer maps and hydrogeologic province boundaries
 *   - Simplified for performance but representative of actual aquifer extents
 *   - Source: USGS Circular 1323, Ground Water Atlas of the United States
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Load USGS Principal Aquifers JSON data
let usgsAquifersData = null;
function loadUSGSAquifersData() {
  if (!usgsAquifersData) {
    // Try multiple possible paths (works in both local and Docker environments)
    const possiblePaths = [
      path.join(__dirname, '../data/usgs-principal-aquifers.json'),
      path.join(process.cwd(), 'backend/data/usgs-principal-aquifers.json'),
      path.join(process.cwd(), 'data/usgs-principal-aquifers.json'),
      '/app/backend/data/usgs-principal-aquifers.json' // Docker path
    ];
    
    try {
      let fileContent = null;
      let usedPath = null;
      
      for (const dataPath of possiblePaths) {
        try {
          if (fs.existsSync(dataPath)) {
            fileContent = fs.readFileSync(dataPath, 'utf8');
            usedPath = dataPath;
            break;
          }
        } catch (e) {
          // Try next path
          continue;
        }
      }
      
      if (!fileContent) {
        throw new Error('JSON file not found in any expected location');
      }
      
      usgsAquifersData = JSON.parse(fileContent);
      console.log(`✅ Loaded ${usgsAquifersData.features.length} aquifers from JSON file (${usedPath})`);
    } catch (error) {
      console.error('❌ Error loading USGS aquifers JSON:', error.message);
      console.error('   Attempted paths:', possiblePaths);
      usgsAquifersData = { type: 'FeatureCollection', features: [] };
    }
  }
  return usgsAquifersData;
}

// API Endpoints - using verified working ArcGIS services
const ARCGIS_AQUIFERS_ENDPOINTS = {
  // NY State Principal Aquifers (verified working)
  'ny': 'https://services.arcgis.com/jDGuO8tYggdCCnUJ/arcgis/rest/services/Principal_aquifers/FeatureServer/0/query',
  // USGS Principal Aquifers - National coverage (Nevada Division of Water Resources hosts USGS data)
  'national': 'https://arcgis.water.nv.gov/arcgis/rest/services/BaseLayers/USGS_Aquifers_Principal/FeatureServer/0/query',
  // Fallback: US Aquifers from USGS (National Map)
  'national-fallback': 'https://carto.nationalmap.gov/arcgis/rest/services/structures/MapServer/13/query'
};
const NWIS_GROUNDWATER_URL = 'https://waterservices.usgs.gov/nwis/gwlevels/';
const NWIS_SITES_URL = 'https://waterservices.usgs.gov/nwis/site/';

// Cache for aquifer data (boundaries change very rarely)
let aquiferCache = {
  data: null,
  timestamp: null,
  ttl: 24 * 60 * 60 * 1000 // 24 hours
};

/**
 * Fetch principal aquifer boundaries from ArcGIS REST API
 * @param {Object} bounds - Bounding box {north, south, east, west}
 * @param {string} aquiferName - Optional filter by aquifer name
 * @param {string} region - Region identifier for endpoint selection
 * @returns {Object} GeoJSON FeatureCollection
 */
async function getAquiferBoundaries(bounds = null, aquiferName = null, region = 'ny', generalized = false) {
  // Prioritize JSON file data - it's more reliable and comprehensive
  const jsonData = loadUSGSAquifersData();
  if (jsonData && jsonData.features && jsonData.features.length > 0) {
    console.log(`📍 Using USGS Principal Aquifers JSON data (${jsonData.features.length} aquifers)`);
    return getUSGSAquifersFromJSON(bounds, generalized, aquiferName);
  }

  // Fallback to API if JSON not available
  try {
    // Select endpoint based on region
    const endpoint = ARCGIS_AQUIFERS_ENDPOINTS[region] || ARCGIS_AQUIFERS_ENDPOINTS['ny'];
    
    // Build query parameters
    const params = {
      f: 'geojson',
      outFields: '*',
      outSR: '4326',
      returnGeometry: true,
      where: '1=1'
    };

    // Add spatial filter if bounds provided
    if (bounds) {
      const { north, south, east, west } = bounds;
      params.geometry = `${west},${south},${east},${north}`;
      params.geometryType = 'esriGeometryEnvelope';
      params.inSR = '4326';
      params.spatialRel = 'esriSpatialRelIntersects';
    }

    // Add name filter if provided
    if (aquiferName) {
      params.where = `AQ_NAME LIKE '%${aquiferName}%' OR NAME LIKE '%${aquiferName}%'`;
    }

    console.log(`📍 Fetching aquifer boundaries from ${region} endpoint...`);
    
    const response = await axios.get(endpoint, {
      params,
      timeout: 30000
    });

    if (response.data && response.data.features && response.data.features.length > 0) {
      console.log(`✅ Retrieved ${response.data.features.length} aquifer features from ${region} endpoint`);
      
      // Enhance features with additional metadata
      const enhancedFeatures = response.data.features.map(feature => ({
        ...feature,
        properties: {
          ...feature.properties,
          // Add display-friendly fields
          displayName: feature.properties.AQ_NAME || feature.properties.NAME || feature.properties.TYPE || 'Aquifer',
          aquiferType: feature.properties.ROCK_TYPE || feature.properties.TYPE || feature.properties.AQ_TYPE || 'Unconsolidated',
          ROCK_TYPE: feature.properties.ROCK_TYPE || feature.properties.TYPE || 'Sand and gravel',
          area_sq_mi: feature.properties.sq_mi || (feature.properties.Shape__Area 
            ? (feature.properties.Shape__Area / 2589988.11).toFixed(0) 
            : null),
          yieldRange: feature.properties.GALPERMIN || 'Unknown'
        }
      }));

      return {
        type: 'FeatureCollection',
        features: enhancedFeatures,
        metadata: {
          source: 'USGS/State Principal Aquifers (API)',
          retrieved: new Date().toISOString(),
          count: enhancedFeatures.length,
          region: region
        }
      };
    }

    // If API returned empty, use fallback data
    console.log(`⚠️ ${region} endpoint returned empty, using fallback aquifer data`);
    return getFallbackAquiferData(bounds, generalized);

  } catch (error) {
    console.error('❌ Error fetching aquifer boundaries:', error.message);
    // Return JSON file data instead of throwing
    console.log('⚠️ Using USGS Principal Aquifers JSON data due to API error');
    return getUSGSAquifersFromJSON(bounds, generalized);
  }
}

/**
 * Get aquifers from USGS Principal Aquifers JSON file
 * Lazy loads based on bounds
 * @param {Object} bounds - Optional bounding box to filter
 * @param {boolean} generalized - Whether to return generalized regions
 * @param {string} aquiferName - Optional filter by aquifer name
 * @returns {Object} GeoJSON FeatureCollection
 */
function getUSGSAquifersFromJSON(bounds = null, generalized = false, aquiferName = null) {
  const data = loadUSGSAquifersData();
  
  if (!data || !data.features || data.features.length === 0) {
    console.log('⚠️ No data in JSON file, using fallback');
    return getFallbackAquiferData(bounds, generalized);
  }

  // Enhance features with proper ROCK_TYPE mapping from category
  let features = data.features.map((feature, idx) => {
    const category = feature.properties?.category || '';
    let rockType = 'Sand and gravel';
    
    // Map category to ROCK_TYPE for proper coloring
    if (category.includes('Carbonate') || category.includes('carbonate')) {
      rockType = 'Carbonate';
    } else if (category.includes('Sandstone') || category.includes('sandstone')) {
      rockType = 'Sandstone';
    } else if (category.includes('Volcanic') || category.includes('volcanic') || category.includes('Igneous') || category.includes('Metamorphic')) {
      rockType = 'Volcanic';
    } else if (category.includes('Crystalline') || category.includes('crystalline')) {
      rockType = 'Crystalline';
    } else if (category.includes('Sand and Gravel') || category.includes('Unconsolidated') || category.includes('Semi-Consolidated')) {
      rockType = 'Sand and gravel';
    }

    return {
      ...feature,
      id: feature.id || idx + 1,
      properties: {
        ...feature.properties,
        displayName: feature.properties?.name || 'Aquifer',
        ROCK_TYPE: rockType,
        aquiferType: rockType,
        category: category,
        region: feature.properties?.region || 'Unknown'
      }
    };
  });

  // Filter by name if provided
  if (aquiferName) {
    const nameLower = aquiferName.toLowerCase();
    features = features.filter(f => {
      const name = f.properties?.name || f.properties?.displayName || '';
      return name.toLowerCase().includes(nameLower);
    });
  }

  // Filter by bounds if provided (lazy loading)
  if (bounds) {
    const padding = 2.0; // degrees
    const expandedBounds = {
      north: bounds.north + padding,
      south: bounds.south - padding,
      east: bounds.east + padding,
      west: bounds.west - padding
    };

    features = features.filter(f => {
      if (!f.geometry || !f.geometry.coordinates) return false;
      
      const coords = f.geometry.coordinates[0];
      if (!coords || coords.length === 0) return false;
      
      const lngs = coords.map(c => c[0]);
      const lats = coords.map(c => c[1]);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      
      // Check if aquifer intersects with expanded bounds
      return !(maxLng < expandedBounds.west || minLng > expandedBounds.east || 
               maxLat < expandedBounds.south || minLat > expandedBounds.north);
    });
  }

  // If generalized mode, group by region
  if (generalized) {
    const regionGroups = {};
    features.forEach(f => {
      const region = f.properties.region || 'Other';
      if (!regionGroups[region]) {
        regionGroups[region] = [];
      }
      regionGroups[region].push(f);
    });

    const generalizedFeatures = Object.entries(regionGroups).map(([region, aquifers]) => {
      // Create bounding box for all aquifers in region
      const allCoords = aquifers.flatMap(a => a.geometry.coordinates[0] || []);
      if (allCoords.length === 0) return null;
      
      const lngs = allCoords.map(c => c[0]);
      const lats = allCoords.map(c => c[1]);
      
      return {
        type: 'Feature',
        id: `generalized-${region}`,
        geometry: {
          type: 'Polygon',
          coordinates: [[[
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
            [Math.min(...lngs), Math.max(...lats)],
            [Math.min(...lngs), Math.min(...lats)]
          ]]]
        },
        properties: {
          displayName: `${region} Aquifer System`,
          ROCK_TYPE: aquifers[0].properties.ROCK_TYPE,
          aquiferType: aquifers[0].properties.ROCK_TYPE,
          region: region,
          aquiferCount: aquifers.length
        }
      };
    }).filter(Boolean);

    return {
      type: 'FeatureCollection',
      features: generalizedFeatures,
      metadata: {
        source: 'USGS Principal Aquifers (JSON - Generalized)',
        retrieved: new Date().toISOString(),
        count: generalizedFeatures.length,
        totalAquifers: data.features.length
      }
    };
  }

  return {
    type: 'FeatureCollection',
    features: features,
    metadata: {
      source: 'USGS Principal Aquifers (JSON)',
      retrieved: new Date().toISOString(),
      count: features.length,
      totalAquifers: data.features.length,
      boundsFiltered: !!bounds
    }
  };
}

/**
 * Fallback aquifer data for when API is unavailable
 * Based on USGS Principal Aquifers map
 */
function getFallbackAquiferData(bounds, generalized = false) {
  // Pre-defined major US aquifer regions (expanded beyond just Long Island)
  const majorAquifers = [
    // Long Island - Detailed aquifers (more accurate shapes)
    {
      name: 'Long Island - Upper Glacial Aquifer',
      type: 'Sand and gravel (glacial)',
      coords: [[
        [-74.0, 40.58], [-73.8, 40.60], [-73.5, 40.65], [-73.2, 40.70],
        [-72.8, 40.75], [-72.5, 40.80], [-72.3, 40.85], [-72.3, 41.0],
        [-72.5, 41.05], [-73.0, 41.05], [-73.5, 41.0], [-73.8, 40.95],
        [-74.0, 40.90], [-74.0, 40.58]
      ]],
      yieldRange: '>100',
      region: 'Northeast'
    },
    {
      name: 'Long Island - Magothy Aquifer',
      type: 'Sand and gravel',
      coords: [[
        [-73.9, 40.60], [-73.6, 40.62], [-73.3, 40.65], [-72.9, 40.70],
        [-72.6, 40.75], [-72.5, 40.80], [-72.5, 40.92], [-72.7, 40.95],
        [-73.0, 40.95], [-73.4, 40.92], [-73.7, 40.88], [-73.9, 40.85],
        [-73.9, 40.60]
      ]],
      yieldRange: '>100',
      region: 'Northeast'
    },
    {
      name: 'Long Island - Lloyd Aquifer',
      type: 'Sand and gravel (deep)',
      coords: [[
        [-73.95, 40.62], [-73.7, 40.64], [-73.4, 40.66], [-73.0, 40.68],
        [-72.8, 40.70], [-72.7, 40.75], [-72.7, 40.88], [-72.9, 40.90],
        [-73.2, 40.92], [-73.6, 40.90], [-73.85, 40.88], [-73.95, 40.85],
        [-73.95, 40.62]
      ]],
      yieldRange: '10-100',
      region: 'Northeast'
    },
    {
      name: 'Long Island - Jameco Aquifer',
      type: 'Sand and gravel',
      coords: [[
        [-73.7, 40.65], [-73.5, 40.67], [-73.2, 40.70], [-72.9, 40.73],
        [-72.8, 40.76], [-72.8, 40.85], [-73.0, 40.87], [-73.3, 40.88],
        [-73.5, 40.87], [-73.7, 40.85], [-73.7, 40.65]
      ]],
      yieldRange: '>100',
      region: 'Northeast'
    },
    // Mid-Atlantic
    {
      name: 'Potomac-Raritan-Magothy Aquifer',
      type: 'Sand and gravel',
      coords: [[
        [-75.5, 39.5], [-75.2, 39.6], [-74.8, 39.7], [-74.5, 39.8],
        [-74.2, 39.9], [-74.0, 40.0], [-74.0, 40.2], [-74.2, 40.3],
        [-74.5, 40.4], [-74.8, 40.45], [-75.0, 40.5], [-75.3, 40.5],
        [-75.5, 40.4], [-75.5, 39.5]
      ]],
      yieldRange: '>100',
      region: 'Mid-Atlantic'
    },
    {
      name: 'Northern Atlantic Coastal Plain Aquifer',
      type: 'Sand and gravel',
      coords: [[
        [-77.0, 38.0], [-76.5, 38.2], [-76.0, 38.5], [-75.5, 38.8],
        [-75.0, 39.2], [-74.8, 39.5], [-74.5, 39.8], [-74.5, 40.0],
        [-75.0, 40.0], [-75.5, 39.8], [-76.0, 39.5], [-76.5, 39.2],
        [-77.0, 38.8], [-77.0, 38.0]
      ]],
      yieldRange: '>100',
      region: 'Mid-Atlantic'
    },
    // Southeast
    {
      name: 'Floridan Aquifer System',
      type: 'Carbonate',
      coords: [[
        [-87.0, 30.0], [-86.5, 30.5], [-85.5, 31.0], [-84.5, 31.5],
        [-83.5, 32.0], [-82.5, 32.5], [-81.5, 33.0], [-81.0, 33.5],
        [-80.5, 34.0], [-80.0, 34.5], [-80.0, 35.0], [-80.5, 35.0],
        [-81.5, 34.5], [-82.5, 34.0], [-83.5, 33.5], [-84.5, 33.0],
        [-85.5, 32.5], [-86.5, 32.0], [-87.0, 31.5], [-87.0, 30.0]
      ]],
      yieldRange: '>100',
      region: 'Southeast'
    },
    {
      name: 'Southeastern Coastal Plain Aquifer',
      type: 'Sand and gravel',
      coords: [[
        [-85.0, 30.0], [-84.0, 30.5], [-83.0, 31.0], [-82.0, 31.5],
        [-81.0, 32.0], [-80.0, 32.5], [-79.0, 33.0], [-78.0, 33.5],
        [-77.0, 34.0], [-76.0, 34.5], [-75.5, 35.0], [-75.0, 35.5],
        [-75.0, 36.0], [-76.0, 36.0], [-77.0, 35.5], [-78.0, 35.0],
        [-79.0, 34.5], [-80.0, 34.0], [-81.0, 33.5], [-82.0, 33.0],
        [-83.0, 32.5], [-84.0, 32.0], [-85.0, 31.5], [-85.0, 30.0]
      ]],
      yieldRange: '>100',
      region: 'Southeast'
    },
    // Midwest
    {
      name: 'Ogallala Aquifer',
      type: 'Sand and gravel',
      coords: [[
        [-106.0, 32.0], [-105.5, 33.0], [-105.0, 34.5], [-104.5, 36.0],
        [-104.0, 37.5], [-103.5, 39.0], [-103.0, 40.5], [-102.0, 41.5],
        [-100.5, 42.0], [-98.0, 42.5], [-96.5, 43.0], [-95.5, 43.0],
        [-95.0, 42.5], [-95.0, 40.0], [-95.5, 37.5], [-96.0, 35.0],
        [-96.5, 33.0], [-97.0, 32.0], [-98.0, 32.0], [-100.0, 32.0],
        [-102.0, 32.0], [-104.0, 32.0], [-106.0, 32.0]
      ]],
      yieldRange: '10-100',
      region: 'Midwest'
    },
    {
      name: 'Mississippi River Valley Alluvial Aquifer',
      type: 'Sand and gravel',
      coords: [[
        [-95.0, 29.0], [-94.0, 30.0], [-93.0, 31.5], [-92.0, 33.0],
        [-91.0, 34.5], [-90.0, 36.0], [-89.5, 37.0], [-89.0, 37.5],
        [-88.5, 38.0], [-88.0, 37.5], [-88.0, 35.0], [-88.5, 33.0],
        [-89.0, 31.0], [-89.5, 29.5], [-90.0, 29.0], [-91.5, 29.0],
        [-93.0, 29.0], [-95.0, 29.0]
      ]],
      yieldRange: '>100',
      region: 'Midwest'
    },
    {
      name: 'Glacial Deposits Aquifer (Great Lakes)',
      type: 'Sand and gravel (glacial)',
      coords: [[
        [-92.0, 41.0], [-91.0, 42.0], [-90.0, 43.0], [-89.0, 44.0],
        [-88.0, 45.0], [-87.0, 45.5], [-86.0, 46.0], [-85.0, 46.5],
        [-84.0, 47.0], [-83.0, 47.0], [-82.0, 46.5], [-81.0, 46.0],
        [-80.5, 45.5], [-80.0, 44.5], [-80.0, 43.0], [-80.5, 42.0],
        [-81.0, 41.5], [-82.0, 41.0], [-84.0, 41.0], [-86.0, 41.0],
        [-88.0, 41.0], [-90.0, 41.0], [-92.0, 41.0]
      ]],
      yieldRange: '>100',
      region: 'Midwest'
    },
    // West
    {
      name: 'Central Valley Aquifer',
      type: 'Sand and gravel',
      coords: [[
        [-122.5, 35.0], [-122.0, 36.0], [-121.5, 37.0], [-121.0, 38.0],
        [-120.5, 39.0], [-120.0, 39.5], [-119.5, 40.0], [-119.0, 40.5],
        [-119.5, 40.5], [-120.5, 40.0], [-121.5, 39.5], [-122.0, 38.5],
        [-122.5, 37.5], [-122.5, 36.0], [-122.5, 35.0]
      ]],
      yieldRange: '>100',
      region: 'West'
    },
    {
      name: 'Columbia Plateau Basalts',
      type: 'Volcanic',
      coords: [[
        [-121.0, 45.0], [-120.0, 45.5], [-119.0, 46.0], [-118.0, 46.5],
        [-117.0, 47.0], [-116.5, 47.5], [-116.0, 48.0], [-116.5, 48.0],
        [-117.5, 47.5], [-118.5, 47.0], [-119.5, 46.5], [-120.5, 46.0],
        [-121.0, 45.5], [-121.0, 45.0]
      ]],
      yieldRange: '10-100',
      region: 'West'
    },
    {
      name: 'Basin and Range Carbonate Aquifers',
      type: 'Carbonate',
      coords: [[
        [-120.0, 35.0], [-119.0, 36.0], [-118.0, 37.0], [-117.0, 38.0],
        [-116.0, 39.0], [-115.0, 40.0], [-114.0, 41.0], [-113.0, 41.5],
        [-112.0, 42.0], [-111.5, 42.0], [-111.0, 41.5], [-111.5, 40.5],
        [-112.0, 39.5], [-113.0, 38.5], [-114.0, 37.5], [-115.0, 36.5],
        [-116.0, 36.0], [-117.0, 35.5], [-118.0, 35.0], [-119.0, 35.0],
        [-120.0, 35.0]
      ]],
      yieldRange: '10-100',
      region: 'West'
    },
    {
      name: 'High Plains Aquifer',
      type: 'Sand and gravel',
      coords: [[
        [-104.0, 32.0], [-103.5, 33.5], [-103.0, 35.0], [-102.5, 36.5],
        [-102.0, 38.0], [-101.5, 39.0], [-101.0, 39.5], [-100.5, 40.0],
        [-100.0, 40.0], [-99.5, 39.5], [-99.0, 38.5], [-99.5, 37.0],
        [-100.0, 35.5], [-100.5, 34.0], [-101.0, 33.0], [-101.5, 32.5],
        [-102.0, 32.0], [-103.0, 32.0], [-104.0, 32.0]
      ]],
      yieldRange: '10-100',
      region: 'West'
    },
    // Additional Major US Aquifers
    {
      name: 'Biscayne Aquifer',
      type: 'Carbonate',
      coords: [[
        [-80.5, 25.5], [-80.3, 26.0], [-80.2, 26.5], [-80.1, 27.0],
        [-80.0, 27.5], [-80.0, 28.0], [-80.2, 28.0], [-80.4, 27.5],
        [-80.5, 27.0], [-80.5, 26.5], [-80.5, 26.0], [-80.5, 25.5]
      ]],
      yieldRange: '>100',
      region: 'Southeast'
    },
    {
      name: 'California Coastal Basin Aquifers',
      type: 'Sand and gravel',
      coords: [[
        [-122.5, 32.5], [-122.0, 33.0], [-121.5, 33.5], [-121.0, 34.0],
        [-120.5, 34.5], [-120.0, 35.0], [-119.5, 35.5], [-119.0, 36.0],
        [-118.5, 36.5], [-118.0, 37.0], [-118.5, 37.0], [-119.0, 36.5],
        [-119.5, 36.0], [-120.0, 35.5], [-120.5, 35.0], [-121.0, 34.5],
        [-121.5, 34.0], [-122.0, 33.5], [-122.5, 33.0], [-122.5, 32.5]
      ]],
      yieldRange: '>100',
      region: 'West'
    },
    {
      name: 'Rio Grande Aquifer System',
      type: 'Sand and gravel',
      coords: [[
        [-109.0, 29.0], [-108.5, 30.0], [-108.0, 31.0], [-107.5, 32.0],
        [-107.0, 33.0], [-106.5, 34.0], [-106.0, 35.0], [-105.5, 35.5],
        [-105.0, 36.0], [-104.5, 36.0], [-104.0, 35.5], [-104.5, 34.5],
        [-105.0, 33.5], [-105.5, 32.5], [-106.0, 31.5], [-106.5, 30.5],
        [-107.0, 30.0], [-107.5, 29.5], [-108.0, 29.0], [-108.5, 29.0],
        [-109.0, 29.0]
      ]],
      yieldRange: '10-100',
      region: 'West'
    },
    {
      name: 'Mississippi Embayment Aquifer System',
      type: 'Sand and gravel',
      coords: [[
        [-95.0, 32.0], [-94.0, 33.0], [-93.0, 34.0], [-92.0, 35.0],
        [-91.0, 36.0], [-90.5, 36.5], [-90.0, 37.0], [-89.5, 37.5],
        [-89.0, 38.0], [-88.5, 37.5], [-88.0, 37.0], [-88.5, 36.0],
        [-89.0, 35.0], [-89.5, 34.0], [-90.0, 33.5], [-90.5, 33.0],
        [-91.0, 32.5], [-92.0, 32.0], [-93.0, 32.0], [-94.0, 32.0],
        [-95.0, 32.0]
      ]],
      yieldRange: '>100',
      region: 'Midwest'
    },
    {
      name: 'Basin and Range Basin-Fill Aquifers',
      type: 'Sand and gravel',
      coords: [[
        [-120.0, 32.0], [-119.0, 33.0], [-118.0, 34.0], [-117.0, 35.0],
        [-116.0, 36.0], [-115.0, 37.0], [-114.0, 38.0], [-113.0, 39.0],
        [-112.0, 40.0], [-111.5, 40.5], [-111.0, 41.0], [-111.5, 40.5],
        [-112.0, 39.5], [-113.0, 38.5], [-114.0, 37.5], [-115.0, 36.5],
        [-116.0, 35.5], [-117.0, 34.5], [-118.0, 33.5], [-119.0, 32.5],
        [-120.0, 32.0]
      ]],
      yieldRange: '10-100',
      region: 'West'
    },
    {
      name: 'Surficial Aquifer System (Southeast)',
      type: 'Sand and gravel',
      coords: [[
        [-87.0, 30.0], [-86.0, 30.5], [-85.0, 31.0], [-84.0, 31.5],
        [-83.0, 32.0], [-82.0, 32.5], [-81.0, 33.0], [-80.5, 33.5],
        [-80.0, 34.0], [-79.5, 34.0], [-79.0, 33.5], [-79.5, 33.0],
        [-80.0, 32.5], [-81.0, 32.0], [-82.0, 31.5], [-83.0, 31.0],
        [-84.0, 30.5], [-85.0, 30.0], [-86.0, 30.0], [-87.0, 30.0]
      ]],
      yieldRange: '>100',
      region: 'Southeast'
    },
    {
      name: 'Edwards-Trinity Aquifer System',
      type: 'Carbonate',
      coords: [[
        [-104.0, 29.0], [-103.5, 30.0], [-103.0, 31.0], [-102.5, 32.0],
        [-102.0, 33.0], [-101.5, 33.5], [-101.0, 34.0], [-100.5, 34.0],
        [-100.0, 33.5], [-100.5, 32.5], [-101.0, 31.5], [-101.5, 30.5],
        [-102.0, 30.0], [-102.5, 29.5], [-103.0, 29.0], [-103.5, 29.0],
        [-104.0, 29.0]
      ]],
      yieldRange: '>100',
      region: 'West'
    },
    {
      name: 'Snake River Plain Aquifer',
      type: 'Volcanic',
      coords: [[
        [-117.0, 42.0], [-116.5, 42.5], [-116.0, 43.0], [-115.5, 43.5],
        [-115.0, 44.0], [-114.5, 44.5], [-114.0, 45.0], [-113.5, 45.0],
        [-113.0, 44.5], [-113.5, 44.0], [-114.0, 43.5], [-114.5, 43.0],
        [-115.0, 42.5], [-115.5, 42.0], [-116.0, 42.0], [-116.5, 42.0],
        [-117.0, 42.0]
      ]],
      yieldRange: '10-100',
      region: 'West'
    },
    {
      name: 'Denver Basin Aquifer',
      type: 'Sandstone',
      coords: [[
        [-105.5, 39.0], [-105.0, 39.5], [-104.5, 40.0], [-104.0, 40.5],
        [-103.5, 40.5], [-103.0, 40.0], [-103.5, 39.5], [-104.0, 39.0],
        [-104.5, 39.0], [-105.0, 39.0], [-105.5, 39.0]
      ]],
      yieldRange: '10-100',
      region: 'West'
    }
  ];

  // If generalized mode, merge aquifers by region
  if (generalized) {
    const generalizedAquifers = [];
    
    // Group aquifers by region
    const regionGroups = {};
    majorAquifers.forEach(a => {
      const region = a.region || 'Other';
      if (!regionGroups[region]) {
        regionGroups[region] = [];
      }
      regionGroups[region].push(a);
    });
    
    // For each region, create a simplified bounding box
    Object.entries(regionGroups).forEach(([region, aquifers]) => {
      // Flatten all coordinates from all aquifers in this region
      const allCoords = aquifers.flatMap(a => a.coords[0]);
      const lngs = allCoords.map(c => c[0]);
      const lats = allCoords.map(c => c[1]);
      
      // Use the most common type and yield range
      const types = aquifers.map(a => a.type);
      const mostCommonType = types.sort((a, b) =>
        types.filter(v => v === a).length - types.filter(v => v === b).length
      ).pop() || aquifers[0].type;
      
      generalizedAquifers.push({
        name: `${region} Aquifer System`,
        type: mostCommonType,
        coords: [[[
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
          [Math.min(...lngs), Math.max(...lats)],
          [Math.min(...lngs), Math.min(...lats)]
        ]]],
        yieldRange: aquifers[0].yieldRange,
        region: region
      });
    });
    
    return createFeatureCollection(generalizedAquifers, bounds);
  }

  return createFeatureCollection(majorAquifers, bounds);
}

/**
 * Get generalized aquifer coverage polygon
 * This represents the overall extent where principal aquifers exist in the US
 * Simplified boundary showing aquifer presence vs absence
 * Uses the JSON file to create a union of all aquifer boundaries
 * @param {Object} bounds - Optional bounding box to filter
 * @returns {Object} GeoJSON FeatureCollection with simplified coverage polygon
 */
function getGeneralizedAquiferCoverage(bounds = null) {
  // Try to use JSON file data to create more accurate coverage
  const jsonData = loadUSGSAquifersData();
  if (jsonData && jsonData.features && jsonData.features.length > 0) {
    // Filter by bounds if provided
    let features = jsonData.features;
    if (bounds) {
      features = features.filter(f => {
        if (!f.geometry || !f.geometry.coordinates) return false;
        const coords = f.geometry.coordinates[0];
        if (!coords || coords.length === 0) return false;
        const lngs = coords.map(c => c[0]);
        const lats = coords.map(c => c[1]);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        return !(maxLng < bounds.west || minLng > bounds.east || 
                 maxLat < bounds.south || minLat > bounds.north);
      });
    }

    if (features.length > 0) {
      // Create a simplified bounding polygon that encompasses all aquifers
      const allCoords = features.flatMap(f => f.geometry.coordinates[0] || []);
      if (allCoords.length > 0) {
        const lngs = allCoords.map(c => c[0]);
        const lats = allCoords.map(c => c[1]);
        
        // Create a simplified convex hull-like polygon
        // For simplicity, use bounding box with some smoothing
        const coveragePolygon = {
          type: 'Feature',
          id: 'us-aquifer-coverage',
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [Math.min(...lngs), Math.min(...lats)],
              [Math.max(...lngs), Math.min(...lats)],
              [Math.max(...lngs), Math.max(...lats)],
              [Math.min(...lngs), Math.max(...lats)],
              [Math.min(...lngs), Math.min(...lats)]
            ]]
          },
          properties: {
            displayName: 'US Principal Aquifer Coverage',
            description: `Generalized extent of ${jsonData.features.length} US Principal Aquifers`,
            aquiferCount: jsonData.features.length,
            source: 'USGS Principal Aquifers (JSON)',
            type: 'coverage',
            hasAquifers: true
          }
        };

        return {
          type: 'FeatureCollection',
          features: [coveragePolygon],
          metadata: {
            source: 'USGS Principal Aquifer Coverage (JSON-based)',
            retrieved: new Date().toISOString(),
            count: 1,
            note: `Simplified coverage polygon representing extent of ${jsonData.features.length} US Principal Aquifers`,
            totalAquifers: jsonData.features.length
          }
        };
      }
    }
  }

  // Fallback to hardcoded polygon if JSON not available
  // Simplified polygon representing areas where principal aquifers exist
  // Based on USGS Principal Aquifers map - covers conterminous US, Hawaii, Puerto Rico, Virgin Islands
  // Western boundary extends to coast (two inclusive - includes coastal aquifers)
  const coveragePolygon = {
    type: 'Feature',
    id: 'us-aquifer-coverage',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        // Start at northwest (includes coastal areas)
        [-125.0, 49.0], // Northwest corner (includes coastal WA/OR)
        [-125.0, 48.5], // Follow coast
        [-124.5, 48.0],
        [-124.0, 47.5],
        [-123.5, 47.0],
        [-123.0, 46.5],
        [-122.5, 46.0],
        [-122.0, 45.5],
        [-121.5, 45.0],
        [-121.0, 44.5],
        [-120.5, 44.0],
        [-120.0, 43.5],
        [-119.5, 43.0],
        [-119.0, 42.5],
        [-118.5, 42.0],
        [-118.0, 41.5],
        [-117.5, 41.0],
        [-117.0, 40.5],
        [-116.5, 40.0],
        [-116.0, 39.5],
        [-115.5, 39.0],
        [-115.0, 38.5],
        [-114.5, 38.0],
        [-114.0, 37.5],
        [-113.5, 37.0],
        [-113.0, 36.5],
        [-112.5, 36.0],
        [-112.0, 35.5],
        [-111.5, 35.0],
        [-111.0, 34.5],
        [-110.5, 34.0],
        [-110.0, 33.5],
        [-109.5, 33.0],
        [-109.0, 32.5],
        [-108.5, 32.0],
        [-108.0, 31.5],
        [-107.5, 31.0],
        [-107.0, 30.5],
        [-106.5, 30.0],
        [-106.0, 29.5],
        [-105.5, 29.0],
        [-105.0, 28.5],
        [-104.5, 28.0],
        [-104.0, 27.5],
        [-103.5, 27.0],
        [-103.0, 26.5],
        [-102.5, 26.0],
        [-102.0, 25.5],
        [-101.5, 25.0],
        // Southeast corner
        [-80.0, 25.0], // Florida Keys
        [-80.5, 25.5],
        [-81.0, 26.0],
        [-81.5, 26.5],
        [-82.0, 27.0],
        [-82.5, 27.5],
        [-83.0, 28.0],
        [-83.5, 28.5],
        [-84.0, 29.0],
        [-84.5, 29.5],
        [-85.0, 30.0],
        [-85.5, 30.5],
        [-86.0, 31.0],
        [-86.5, 31.5],
        [-87.0, 32.0],
        [-87.5, 32.5],
        [-88.0, 33.0],
        [-88.5, 33.5],
        [-89.0, 34.0],
        [-89.5, 34.5],
        [-90.0, 35.0],
        [-90.5, 35.5],
        [-91.0, 36.0],
        [-91.5, 36.5],
        [-92.0, 37.0],
        [-92.5, 37.5],
        [-93.0, 38.0],
        [-93.5, 38.5],
        [-94.0, 39.0],
        [-94.5, 39.5],
        [-95.0, 40.0],
        [-95.5, 40.5],
        [-96.0, 41.0],
        [-96.5, 41.5],
        [-97.0, 42.0],
        [-97.5, 42.5],
        [-98.0, 43.0],
        [-98.5, 43.5],
        [-99.0, 44.0],
        [-99.5, 44.5],
        [-100.0, 45.0],
        [-100.5, 45.5],
        [-101.0, 46.0],
        [-101.5, 46.5],
        [-102.0, 47.0],
        [-102.5, 47.5],
        [-103.0, 48.0],
        [-103.5, 48.5],
        [-104.0, 49.0],
        // Northeast corner
        [-75.0, 49.0], // Maine/Canada border
        [-75.5, 48.5],
        [-76.0, 48.0],
        [-76.5, 47.5],
        [-77.0, 47.0],
        [-77.5, 46.5],
        [-78.0, 46.0],
        [-78.5, 45.5],
        [-79.0, 45.0],
        [-79.5, 44.5],
        [-80.0, 44.0],
        [-80.5, 43.5],
        [-81.0, 43.0],
        [-81.5, 42.5],
        [-82.0, 42.0],
        [-82.5, 41.5],
        [-83.0, 41.0],
        [-83.5, 40.5],
        [-84.0, 40.0],
        [-84.5, 39.5],
        [-85.0, 39.0],
        [-85.5, 38.5],
        [-86.0, 38.0],
        [-86.5, 37.5],
        [-87.0, 37.0],
        [-87.5, 36.5],
        [-88.0, 36.0],
        [-88.5, 35.5],
        [-89.0, 35.0],
        [-89.5, 34.5],
        [-90.0, 34.0],
        [-90.5, 33.5],
        [-91.0, 33.0],
        [-91.5, 32.5],
        [-92.0, 32.0],
        [-92.5, 31.5],
        [-93.0, 31.0],
        [-93.5, 30.5],
        [-94.0, 30.0],
        [-94.5, 29.5],
        [-95.0, 29.0],
        [-95.5, 28.5],
        [-96.0, 28.0],
        [-96.5, 27.5],
        [-97.0, 27.0],
        [-97.5, 26.5],
        [-98.0, 26.0],
        [-98.5, 25.5],
        [-99.0, 25.0],
        // Back to start
        [-125.0, 49.0]
      ]]
    },
    properties: {
      displayName: 'US Principal Aquifer Coverage',
      description: 'Generalized extent of all 1702 US Principal Aquifers',
      aquiferCount: 1702,
      source: 'USGS Principal Aquifers',
      type: 'coverage',
      hasAquifers: true
    }
  };

  // Filter by bounds if provided (check if polygon intersects bounds)
  if (bounds) {
    const coords = coveragePolygon.geometry.coordinates[0];
    const lngs = coords.map(c => c[0]);
    const lats = coords.map(c => c[1]);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    
    // Check if polygon intersects with bounds
    const intersects = !(maxLng < bounds.west || minLng > bounds.east || 
                         maxLat < bounds.south || minLat > bounds.north);
    
    if (!intersects) {
      return {
        type: 'FeatureCollection',
        features: [],
        metadata: {
          source: 'USGS Principal Aquifer Coverage (Generalized)',
          retrieved: new Date().toISOString(),
          count: 0,
          note: 'No aquifer coverage in this area'
        }
      };
    }
  }

  return {
    type: 'FeatureCollection',
    features: [coveragePolygon],
    metadata: {
      source: 'USGS Principal Aquifer Coverage (Generalized)',
      retrieved: new Date().toISOString(),
      count: 1,
      note: 'Simplified coverage polygon representing extent of all 1702 US Principal Aquifers',
      totalAquifers: 1702
    }
  };
}

/**
 * Helper function to create GeoJSON FeatureCollection from aquifer data
 */
function createFeatureCollection(aquifers, bounds) {
  const features = aquifers.map((aquifer, idx) => ({
    type: 'Feature',
    id: idx + 1,
    geometry: {
      type: 'Polygon',
      coordinates: aquifer.coords
    },
    properties: {
      displayName: aquifer.name,
      ROCK_TYPE: aquifer.type,
      aquiferType: aquifer.type,
      yieldRange: aquifer.yieldRange,
      area_sq_mi: null,
      source: 'Fallback Data',
      region: aquifer.region || 'Unknown'
    }
  }));

  // Filter by bounds if provided, but be lenient to show nearby aquifers
  let filteredFeatures = features;
  if (bounds) {
    // Add padding to bounds to include nearby aquifers
    const padding = 2.0; // degrees
    const expandedBounds = {
      north: bounds.north + padding,
      south: bounds.south - padding,
      east: bounds.east + padding,
      west: bounds.west - padding
    };
    
    filteredFeatures = features.filter(f => {
      const coords = f.geometry.coordinates[0];
      const lngs = coords.map(c => c[0]);
      const lats = coords.map(c => c[1]);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      
      // Check if aquifer intersects with expanded bounds
      return !(maxLng < expandedBounds.west || minLng > expandedBounds.east || 
               maxLat < expandedBounds.south || minLat > expandedBounds.north);
    });
    
    // If no features match bounds, return all features (user might be zoomed in too much)
    if (filteredFeatures.length === 0) {
      console.log('⚠️ No aquifers match bounds, returning all fallback aquifers');
      filteredFeatures = features;
    }
  }

  return {
    type: 'FeatureCollection',
    features: filteredFeatures,
    metadata: {
      source: 'USGS Principal Aquifers (Fallback)',
      retrieved: new Date().toISOString(),
      count: filteredFeatures.length,
      note: 'Using cached data - live API unavailable'
    }
  };
}

/**
 * Fetch groundwater level data from USGS NWIS
 * @param {string} stateCd - State code (e.g., 'NY', 'CA')
 * @param {Object} bounds - Optional bounding box
 * @param {number} period - Period in days (default 30)
 * @returns {Object} Groundwater level data with site info
 */
async function getGroundwaterLevels(stateCd = null, bounds = null, period = 30) {
  try {
    // Build URL with query string (NWIS is picky about parameter format)
    let url = `${NWIS_GROUNDWATER_URL}?format=json&siteType=GW&siteStatus=active`;
    
    if (stateCd) {
      url += `&stateCd=${stateCd}`;
    }

    if (bounds) {
      const { north, south, east, west } = bounds;
      // NWIS wants bBox as: west,south,east,north
      url += `&bBox=${west},${south},${east},${north}`;
    }

    // Add period for recent data
    url += `&period=P${period}D`;

    console.log('📍 Fetching groundwater levels from USGS NWIS...');

    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        'Accept': 'application/json'
      }
    });

    if (response.data && response.data.value) {
      const timeSeries = response.data.value.timeSeries || [];
      console.log(`✅ Retrieved data for ${timeSeries.length} groundwater sites`);

      // Transform to GeoJSON for map display
      const features = timeSeries
        .filter(ts => ts.sourceInfo && ts.sourceInfo.geoLocation)
        .map(ts => {
          const sourceInfo = ts.sourceInfo;
          const geoLoc = sourceInfo.geoLocation.geogLocation;
          const values = ts.values?.[0]?.value || [];
          const latestValue = values[values.length - 1];

          return {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [
                parseFloat(geoLoc.longitude),
                parseFloat(geoLoc.latitude)
              ]
            },
            properties: {
              siteCode: sourceInfo.siteCode?.[0]?.value || 'Unknown',
              siteName: sourceInfo.siteName || 'Unknown Site',
              latitude: parseFloat(geoLoc.latitude),
              longitude: parseFloat(geoLoc.longitude),
              latestLevel: latestValue ? parseFloat(latestValue.value) : null,
              latestDate: latestValue?.dateTime || null,
              unit: ts.variable?.unit?.unitCode || 'ft',
              variableName: ts.variable?.variableName || 'Depth to water level',
              valueCount: values.length
            }
          };
        });

      return {
        type: 'FeatureCollection',
        features,
        metadata: {
          source: 'USGS National Water Information System (NWIS)',
          retrieved: new Date().toISOString(),
          period: `${period} days`,
          count: features.length
        }
      };
    }

    // No data from API, return simulated well data for demonstration
    console.log('⚠️ No live groundwater data, generating sample wells');
    return getSimulatedGroundwaterWells(bounds);

  } catch (error) {
    console.error('❌ Error fetching groundwater levels:', error.message);
    // Return simulated data for demonstration
    console.log('⚠️ Using simulated groundwater data');
    return getSimulatedGroundwaterWells(bounds);
  }
}

/**
 * Generate simulated groundwater well data for demonstration
 */
function getSimulatedGroundwaterWells(bounds) {
  if (!bounds) {
    return {
      type: 'FeatureCollection',
      features: [],
      metadata: { source: 'No data', count: 0 }
    };
  }

  const { north, south, east, west } = bounds;
  const features = [];
  
  // Generate a grid of simulated monitoring wells
  const latStep = (north - south) / 8;
  const lonStep = (east - west) / 10;
  
  let id = 1;
  for (let lat = south + latStep/2; lat < north; lat += latStep) {
    for (let lon = west + lonStep/2; lon < east; lon += lonStep) {
      // Add some randomness to positions
      const jitterLat = lat + (Math.random() - 0.5) * latStep * 0.5;
      const jitterLon = lon + (Math.random() - 0.5) * lonStep * 0.5;
      
      // Simulate water level depth (varies by location)
      const baseDepth = 20 + Math.random() * 80;
      const depthVariation = Math.sin(lon * 10) * 20 + Math.cos(lat * 10) * 15;
      const waterLevel = Math.max(5, baseDepth + depthVariation);
      
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [jitterLon, jitterLat]
        },
        properties: {
          siteCode: `USGS-${String(id).padStart(8, '0')}`,
          siteName: `Monitoring Well ${id}`,
          latitude: jitterLat,
          longitude: jitterLon,
          latestLevel: Math.round(waterLevel * 10) / 10,
          latestDate: new Date().toISOString(),
          unit: 'ft',
          variableName: 'Depth to water level, feet below land surface',
          valueCount: 1,
          simulated: true
        }
      });
      id++;
    }
  }

  return {
    type: 'FeatureCollection',
    features,
    metadata: {
      source: 'Simulated Data (USGS-style)',
      retrieved: new Date().toISOString(),
      count: features.length,
      note: 'Simulated monitoring well data for demonstration'
    }
  };
}

/**
 * Fetch groundwater monitoring sites
 * @param {string} stateCd - State code
 * @param {Object} bounds - Optional bounding box
 * @returns {Object} GeoJSON of monitoring sites
 */
async function getMonitoringSites(stateCd = null, bounds = null) {
  try {
    const params = {
      format: 'rdb',
      siteType: 'GW',
      siteStatus: 'active',
      hasDataTypeCd: 'gw'
    };

    if (stateCd) {
      params.stateCd = stateCd;
    }

    if (bounds) {
      const { north, south, east, west } = bounds;
      params.bBox = `${west},${south},${east},${north}`;
    }

    console.log('📍 Fetching monitoring sites from USGS NWIS...');

    // Use JSON format for sites
    params.format = 'mapper';
    
    const response = await axios.get(NWIS_SITES_URL, {
      params,
      timeout: 30000
    });

    // Parse the mapper format response
    if (response.data) {
      // The mapper format returns a simple structure we can work with
      const lines = response.data.split('\n').filter(l => l.trim());
      const sites = [];
      
      // Skip header lines and parse site data
      let dataStarted = false;
      for (const line of lines) {
        if (line.startsWith('lat')) {
          dataStarted = true;
          continue;
        }
        if (!dataStarted || line.startsWith('#')) continue;
        
        const parts = line.split('\t');
        if (parts.length >= 4) {
          const lat = parseFloat(parts[0]);
          const lng = parseFloat(parts[1]);
          const siteNo = parts[2];
          const siteName = parts[3];
          
          if (!isNaN(lat) && !isNaN(lng)) {
            sites.push({
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [lng, lat]
              },
              properties: {
                siteCode: siteNo,
                siteName: siteName,
                latitude: lat,
                longitude: lng,
                siteType: 'Groundwater Well'
              }
            });
          }
        }
      }

      return {
        type: 'FeatureCollection',
        features: sites,
        metadata: {
          source: 'USGS NWIS Site Service',
          retrieved: new Date().toISOString(),
          count: sites.length
        }
      };
    }

    return {
      type: 'FeatureCollection',
      features: [],
      metadata: { source: 'USGS NWIS', error: 'No data' }
    };

  } catch (error) {
    console.error('❌ Error fetching monitoring sites:', error.message);
    return {
      type: 'FeatureCollection',
      features: [],
      metadata: { source: 'USGS NWIS', error: error.message }
    };
  }
}

/**
 * Get aquifer data with groundwater levels combined
 * @param {Object} bounds - Bounding box
 * @param {string} stateCd - State code for groundwater data
 * @returns {Object} Combined aquifer and groundwater data
 */
async function getAquiferData(bounds = null, stateCd = null) {
  try {
    // Fetch both in parallel
    const [aquifers, groundwater] = await Promise.all([
      getAquiferBoundaries(bounds),
      stateCd ? getGroundwaterLevels(stateCd, bounds, 30) : Promise.resolve(null)
    ]);

    return {
      aquifers,
      groundwater,
      metadata: {
        retrieved: new Date().toISOString(),
        hasAquifers: aquifers.features.length > 0,
        hasGroundwater: groundwater?.features?.length > 0
      }
    };

  } catch (error) {
    console.error('❌ Error fetching combined aquifer data:', error.message);
    throw error;
  }
}

// Pre-defined regions for quick access
const REGIONS = {
  'long-island': {
    bounds: { north: 41.2, south: 40.4, east: -71.8, west: -74.1 },
    stateCd: 'NY',
    name: 'Long Island, NY',
    endpoint: 'ny'
  },
  'florida': {
    bounds: { north: 31.0, south: 24.5, east: -80.0, west: -87.6 },
    stateCd: 'FL',
    name: 'Florida',
    endpoint: 'national',
    fallbackAquifers: [
      { name: 'Floridan Aquifer System', type: 'Carbonate (limestone)', coords: [[[-87.5, 25.5], [-80.5, 25.5], [-80.5, 31.0], [-87.5, 31.0], [-87.5, 25.5]]], yieldRange: '>100' },
      { name: 'Biscayne Aquifer', type: 'Carbonate (limestone)', coords: [[[-80.8, 25.0], [-80.1, 25.0], [-80.1, 26.5], [-80.8, 26.5], [-80.8, 25.0]]], yieldRange: '>100' },
      { name: 'Sand and Gravel Aquifer', type: 'Sand and gravel', coords: [[[-87.5, 29.5], [-85.0, 29.5], [-85.0, 31.0], [-87.5, 31.0], [-87.5, 29.5]]], yieldRange: '10-100' }
    ]
  },
  'ogallala': {
    bounds: { north: 43.5, south: 31.5, east: -96.5, west: -104.5 },
    stateCd: null, // Multiple states
    name: 'Ogallala Aquifer Region',
    endpoint: 'national',
    fallbackAquifers: [
      { name: 'Ogallala Aquifer (High Plains)', type: 'Sand and gravel (unconsolidated)', coords: [[[-104.5, 31.5], [-96.5, 31.5], [-96.5, 43.5], [-104.5, 43.5], [-104.5, 31.5]]], yieldRange: '10-100' }
    ]
  },
  'california-central-valley': {
    bounds: { north: 40.5, south: 34.5, east: -118.5, west: -122.5 },
    stateCd: 'CA',
    name: 'California Central Valley',
    endpoint: 'national',
    fallbackAquifers: [
      { name: 'Central Valley Aquifer System', type: 'Sand and gravel (alluvial)', coords: [[[-122.0, 35.0], [-119.0, 35.0], [-119.0, 40.0], [-122.0, 40.0], [-122.0, 35.0]]], yieldRange: '>100' },
      { name: 'Sacramento Valley', type: 'Sand and gravel', coords: [[[-122.5, 38.5], [-121.0, 38.5], [-121.0, 40.5], [-122.5, 40.5], [-122.5, 38.5]]], yieldRange: '>100' },
      { name: 'San Joaquin Valley', type: 'Sand and gravel', coords: [[[-121.5, 34.5], [-118.5, 34.5], [-118.5, 38.0], [-121.5, 38.0], [-121.5, 34.5]]], yieldRange: '>100' }
    ]
  }
};

/**
 * Get aquifer data for a predefined region
 * @param {string} regionId - Region identifier
 * @returns {Object} Aquifer data for the region
 */
async function getRegionAquiferData(regionId) {
  const region = REGIONS[regionId];
  if (!region) {
    throw new Error(`Unknown region: ${regionId}. Available: ${Object.keys(REGIONS).join(', ')}`);
  }

  try {
    // Try to fetch from API
    const aquifers = await getAquiferBoundaries(region.bounds, null, region.endpoint);
    
    // If API returned no data, use fallback
    if (aquifers.features.length === 0 && region.fallbackAquifers) {
      console.log(`⚠️ Using fallback data for ${regionId}`);
      const features = region.fallbackAquifers.map((aq, idx) => ({
        type: 'Feature',
        id: idx + 1,
        geometry: { type: 'Polygon', coordinates: aq.coords },
        properties: {
          displayName: aq.name,
          ROCK_TYPE: aq.type,
          aquiferType: aq.type,
          yieldRange: aq.yieldRange,
          source: 'USGS Reference Data'
        }
      }));
      
      aquifers.features = features;
      aquifers.metadata.count = features.length;
      aquifers.metadata.note = 'Using reference data';
    }

    // Fetch groundwater data
    let groundwater = null;
    if (region.stateCd) {
      groundwater = await getGroundwaterLevels(region.stateCd, region.bounds, 30);
    }

    return {
      aquifers,
      groundwater,
      metadata: {
        retrieved: new Date().toISOString(),
        region: regionId,
        regionName: region.name,
        hasAquifers: aquifers.features.length > 0,
        hasGroundwater: groundwater?.features?.length > 0
      }
    };
    
  } catch (error) {
    console.error(`❌ Error fetching data for ${regionId}:`, error.message);
    
    // Return fallback data
    const features = (region.fallbackAquifers || []).map((aq, idx) => ({
      type: 'Feature',
      id: idx + 1,
      geometry: { type: 'Polygon', coordinates: aq.coords },
      properties: {
        displayName: aq.name,
        ROCK_TYPE: aq.type,
        aquiferType: aq.type,
        yieldRange: aq.yieldRange,
        source: 'USGS Reference Data'
      }
    }));

    return {
      aquifers: {
        type: 'FeatureCollection',
        features,
        metadata: {
          source: 'USGS Reference Data (Fallback)',
          count: features.length,
          note: 'API unavailable - using cached reference data'
        }
      },
      groundwater: null,
      metadata: {
        retrieved: new Date().toISOString(),
        region: regionId,
        regionName: region.name,
        hasAquifers: features.length > 0,
        hasGroundwater: false,
        error: error.message
      }
    };
  }
}

module.exports = {
  getAquiferBoundaries,
  getGroundwaterLevels,
  getMonitoringSites,
  getAquiferData,
  getRegionAquiferData,
  getGeneralizedAquiferCoverage,
  REGIONS
};

