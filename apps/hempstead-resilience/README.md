# Town of Hempstead Coastal Resilience Analysis

Comprehensive GIS-based resilience assessment for Town of Hempstead's South Shore communities (Rockville Centre → Massapequa).

## Overview

This pipeline analyzes coastal resilience needs by integrating:
- **NOAA Sea Level Rise** projections (+1ft to +6ft scenarios)
- **FEMA Flood Hazard** zones (NFHL)
- **Digital Elevation Model** (SRTM/Copernicus)
- **Existing Resilience Projects** from Town documentation

### Resilience Need Index Formula

```
NeedIndex = (0.5 × FloodDepthNorm) + (0.3 × ElevationInverse) + (0.2 × NoProjectFlag)
```

**Risk Categories:**
- **High:** Need Index ≥ 0.7 (Red)
- **Medium:** 0.4 - 0.7 (Orange)
- **Low:** < 0.4 (Green)

## Installation

```bash
cd /Users/joshuabutler/Documents/github-project/climate-studio/apps/hempstead-resilience
npm install
```

## Usage

### Run Complete Pipeline

Execute all steps in sequence:

```bash
npm run pipeline
```

This will:
1. Extract and geocode 20+ resilience projects
2. Fetch NOAA sea level rise data (6 scenarios)
3. Fetch FEMA flood hazard zones
4. Fetch elevation data (DEM)
5. Compute Resilience Need Index for ~15,000 grid cells
6. Generate top 10 high-risk zones CSV
7. Create comprehensive analysis report

**Duration:** ~15-30 seconds (simulated data) or ~5-10 minutes (real API calls)

### Run Individual Steps

```bash
# Parse existing projects only
npm run parse-projects

# Fetch NOAA SLR data only
npm run fetch-noaa

# Fetch FEMA flood zones only
npm run fetch-fema

# Fetch elevation data only
npm run fetch-elevation

# Compute need index only (requires previous steps)
npm run compute-needs
```

## Generated Output Files

### Data Files (GeoJSON)

```
data/
├── resilience_projects.geojson      # 20 existing projects
├── resilience_needs.geojson         # Need assessment grid (~15k points)
└── inputs/
    ├── noaa_slr_data.geojson        # Sea level rise scenarios
    ├── fema_flood_hazard.geojson    # FEMA flood zones
    └── elevation_dem.geojson        # Digital elevation model
```

### Reports & Visualizations

```
output/
├── summary_table.csv                # Top 10 unprotected high-risk zones
└── analysis_summary.md              # Comprehensive markdown report

data/layers/
└── resilience_manifest.json         # Layer manifest for climate-studio-v3
```

## Layer Manifest for Climate Studio

The generated `resilience_manifest.json` includes:

**Layers:**
1. **Resilience Need Index** - Risk heatmap (red/orange/green)
2. **Existing Projects** - Color-coded by project type
3. **FEMA Flood Zones** - VE, AE, AO, X zones
4. **SLR Scenarios** - Heatmap by flood depth

**Color Scheme:**
- 🔴 **High risk** - Red (#dc2626)
- 🟠 **Medium risk** - Orange (#f97316)
- 🟢 **Low risk** - Green (#22c55e)
- 🔵 **Existing project** - Blue (varies by type)

**Filters Available:**
- Risk category
- Year projection (2030-2080)
- Has existing project (yes/no)
- Project type
- Project status

## Visualization in Climate Studio v3

### Import Layers

1. Copy the manifest to your climate-studio app:
   ```bash
   cp data/layers/resilience_manifest.json \
      ../climate-studio/src/data/layers/hempstead-resilience.json
   ```

2. Update your layer registry to include:
   ```typescript
   import hempsteadLayers from './data/layers/hempstead-resilience.json';
   ```

3. The layers will appear in your map interface with:
   - Interactive popups showing need index, elevation, flood depth
   - Filterable by risk category and year
   - Toggle between existing projects and needs assessment

### Example Usage

```typescript
// In your climate-studio map component
const [selectedLayers, setSelectedLayers] = useState([
  'resilience-needs',
  'existing-projects'
]);

// Apply filters
const filters = {
  riskCategory: 'High',
  hasProject: false,
  year: { min: 2030, max: 2050 }
};
```

## Key Findings Summary

The analysis typically identifies:

- **~15,000** sampling points analyzed across the study area
- **~30-40%** high-risk zones (Need Index ≥ 0.7)
- **~100-200** high-risk zones **without existing protection**
- **20** existing resilience projects documented

### Top Priority Areas

1. **Coastal Barrier Communities** (Point Lookout, Lido Beach, Long Beach)
   - Low elevation (<3m) + high SLR exposure
   - Recommended: Living shorelines, dune maintenance

2. **Back-Bay Communities** (Baldwin, Freeport, Oceanside)
   - Tidal flooding from Hempstead Bay
   - Recommended: Road elevation, drainage upgrades, tidal check valves

3. **Wetland Buffer Zones**
   - Critical marsh restoration needed
   - Recommended: Thin-layer sediment deposition, living shorelines

## Data Sources

### Production APIs (requires configuration)

To use real data sources instead of simulated data:

1. **NOAA SLR Viewer API**
   ```typescript
   // In fetch_noaa_data.ts
   const apiUrl = `https://coast.noaa.gov/arcgis/rest/services/dc_slr/slr_${slr_ft}ft/MapServer/export`;
   ```

2. **FEMA NFHL**
   ```typescript
   // In fetch_fema_data.ts
   const url = 'https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query';
   ```

3. **Open Elevation API**
   ```typescript
   // In fetch_elevation_data.ts
   const url = 'https://api.open-elevation.com/api/v1/lookup';
   ```

4. **Nominatim Geocoding**
   ```typescript
   // In parse_projects.ts
   const url = `https://nominatim.openstreetmap.org/search?q=${location}`;
   ```

**Note:** Remember to:
- Add API keys where required
- Respect rate limits (1 req/sec for Nominatim)
- Add error handling and retry logic
- Cache results to avoid redundant calls

## Customization

### Adjust Risk Weights

Edit `scripts/compute_need_index.ts`:

```typescript
// Current formula
const need_index = (0.5 * floodDepthNorm) +
                   (0.3 * elevationInverse) +
                   (0.2 * noProjectFlag);

// Example: Emphasize elevation more
const need_index = (0.4 * floodDepthNorm) +
                   (0.4 * elevationInverse) +
                   (0.2 * noProjectFlag);
```

### Change Risk Thresholds

```typescript
// In compute_need_index.ts
if (need_index >= 0.7) {
  risk_category = 'High';
} else if (need_index >= 0.4) {
  risk_category = 'Medium';
} else {
  risk_category = 'Low';
}
```

### Add More Projects

Edit `scripts/parse_projects.ts` and add to the `projects` array:

```typescript
{
  name: 'New Marsh Restoration Project',
  type: 'Marsh Restoration',
  location: 'Merrick',
  neighborhood: 'Merrick',
  description: 'Restore 5 acres of tidal wetlands...',
  lat: 40.6629,
  lon: -73.5513,
  status: 'Planned',
  funding: 'NYS Environmental Bond Act'
}
```

## Troubleshooting

### Missing tsx dependency

```bash
npm install --save-dev tsx
```

### TypeScript errors

Ensure `@types/node` is installed:
```bash
npm install --save-dev @types/node
```

### File not found errors

Run the complete pipeline first:
```bash
npm run pipeline
```

Individual steps depend on previous steps completing.

## Project Structure

```
hempstead-resilience/
├── scripts/
│   ├── parse_projects.ts         # Extract & geocode projects
│   ├── fetch_noaa_data.ts        # NOAA SLR scenarios
│   ├── fetch_fema_data.ts        # FEMA flood zones
│   ├── fetch_elevation_data.ts   # DEM elevation
│   ├── compute_need_index.ts     # Calculate resilience needs
│   └── run_pipeline.ts           # Main orchestrator
├── data/
│   ├── resilience_projects.geojson
│   ├── resilience_needs.geojson
│   ├── inputs/
│   └── layers/
│       └── resilience_manifest.json
├── output/
│   ├── summary_table.csv
│   └── analysis_summary.md
├── package.json
└── README.md
```

## Contributing

To add new features:

1. **New Data Sources:** Add a new `fetch_*.ts` script
2. **New Analysis:** Modify `compute_need_index.ts`
3. **New Visualizations:** Update `resilience_manifest.json`
4. **New Reports:** Modify `run_pipeline.ts` → `generateReports()`

## License

This project analyzes public data from NOAA, FEMA, and Town of Hempstead sources for resilience planning purposes.

## Contact

For questions about the Town of Hempstead Coastal Resilience Initiative:
- **Town Website:** https://hempsteadny.gov/159/Conservation-Waterways
- **NOAA Resources:** https://coast.noaa.gov/slr/
- **FEMA Maps:** https://hazards.fema.gov/

---

**Generated:** 2025-11-01
**Last Updated:** 2025-11-01
