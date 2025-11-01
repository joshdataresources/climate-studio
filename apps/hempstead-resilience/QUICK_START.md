# Quick Start Guide
## Town of Hempstead Coastal Resilience Analysis

### ⚡ Run Everything (5 Minutes)

```bash
cd /Users/joshuabutler/Documents/github-project/climate-studio/apps/hempstead-resilience

# Install dependencies (first time only)
npm install

# Run complete analysis pipeline
npm run pipeline
```

### 📊 View Results

After the pipeline completes:

```bash
# View top 10 high-risk zones
cat output/summary_table.csv

# Read comprehensive analysis
cat output/analysis_summary.md

# Check generated GeoJSON files
ls -lh data/*.geojson
ls -lh data/inputs/*.geojson
```

### 🗺️ Import to Climate Studio

```bash
# Copy the layer manifest
cp data/layers/resilience_manifest.json \
   ../climate-studio/src/data/layers/hempstead-resilience.json

# Or manually import the GeoJSON files into your map viewer
```

### 🎯 What Gets Generated

1. **`resilience_projects.geojson`** - 20 existing projects mapped
2. **`resilience_needs.geojson`** - ~15,000 risk assessment points
3. **`summary_table.csv`** - Top 10 unprotected high-risk zones
4. **`analysis_summary.md`** - Full markdown report with recommendations

### 🔍 Pipeline Steps

The `npm run pipeline` command runs:

1. ✅ **Parse Projects** (20 projects from document)
2. ✅ **Fetch NOAA Data** (6 SLR scenarios: +1ft to +6ft)
3. ✅ **Fetch FEMA Data** (Flood zones: VE, AE, AO, X)
4. ✅ **Fetch Elevation** (DEM data for terrain)
5. ✅ **Compute Need Index** (Risk calculation)
6. ✅ **Generate Reports** (CSV + Markdown)

**Total time:** ~15-30 seconds (simulated data)

### 📈 Expected Output

```
======================================================================
HEMPSTEAD RESILIENCE ANALYSIS PIPELINE
======================================================================
1. [✓] Parse Projects (2.3s)
2. [✓] Fetch NOAA Data (5.1s)
3. [✓] Fetch FEMA Data (4.8s)
4. [✓] Fetch Elevation Data (6.2s)
5. [✓] Compute Need Index (3.7s)
6. [✓] Generate Reports (1.2s)
======================================================================
✅ PIPELINE COMPLETED SUCCESSFULLY
======================================================================

Total duration: 23.3s

📊 Generated Files:
  ├─ data/resilience_projects.geojson
  ├─ data/resilience_needs.geojson
  ├─ data/inputs/
  │   ├─ noaa_slr_data.geojson
  │   ├─ fema_flood_hazard.geojson
  │   └─ elevation_dem.geojson
  ├─ data/layers/resilience_manifest.json
  └─ output/
      ├─ summary_table.csv
      └─ analysis_summary.md
```

### 🎨 Visualization Color Scheme

- 🔴 **High Risk** (Need Index ≥ 0.7) - Red
- 🟠 **Medium Risk** (0.4 - 0.7) - Orange
- 🟢 **Low Risk** (< 0.4) - Green
- 🔵 **Existing Projects** - Blue (varies by type)

### 🏙️ Target Communities

- Rockville Centre
- Baldwin
- Freeport
- Merrick
- Bellmore
- Wantagh
- Seaford
- Massapequa

**Plus:** Bay Park, Point Lookout, Long Beach, Oceanside

### 🔧 Run Individual Steps

```bash
npm run parse-projects      # Just extract projects
npm run fetch-noaa          # Just NOAA SLR data
npm run fetch-fema          # Just FEMA flood zones
npm run fetch-elevation     # Just elevation data
npm run compute-needs       # Just need index (requires above)
```

### 📝 Key Formula

```
NeedIndex = (0.5 × FloodDepth) + (0.3 × ElevationInverse) + (0.2 × NoProject)
```

Where:
- **FloodDepth** = Normalized flood depth from NOAA (0-1)
- **ElevationInverse** = Inverse elevation (low elev = high risk)
- **NoProject** = 1 if no nearby resilience project, 0 otherwise

### 🚨 Troubleshooting

**"Cannot find module tsx"**
```bash
npm install --save-dev tsx
```

**"File not found" errors**
```bash
# Run complete pipeline first
npm run pipeline
```

**Need to use real APIs instead of simulated data?**
- Edit the `fetch_*.ts` files
- Uncomment API calls
- Add API keys where needed
- See README.md for details

### 📖 Full Documentation

See [README.md](./README.md) for:
- Detailed methodology
- API configuration
- Customization options
- Data source documentation
- Climate Studio integration guide

---

**Ready?** Run `npm run pipeline` now! 🚀
