# Climate Migration Analysis - Linear Project Structure

## EPIC 1: Metro Temperature Projections (National)
**Goal:** Add 100-year temperature projections for all US metro areas

**Priority:** P0 (Foundational data layer)

**Estimated Timeline:** 2 weeks

---

### Issue 1.1: Set Up Temperature Data Pipeline
**Type:** Task
**Priority:** P0
**Estimate:** 3 points

**Description:**
Create Python service to extract NASA NEX-GDDP-CMIP6 temperature data from Google Earth Engine for all metros in `megaregion-data.json`.

**Acceptance Criteria:**
- [ ] Service authenticates with Earth Engine
- [ ] Multi-model ensemble averaging (ACCESS-CM2, CMCC-ESM2, MIROC6, MRI-ESM2-0)
- [ ] Extracts data for both SSP2-4.5 and SSP5-8.5 scenarios
- [ ] Decadal averages: 2025, 2035, 2045, 2055, 2065, 2075, 2085, 2095
- [ ] Calculates baseline (1995-2014) for comparison
- [ ] Outputs JSON with structure: `metro_name -> scenario -> decade -> {summer_max, winter_min, annual_avg}`

**Technical Notes:**
- Use 50km buffer around metro center point
- Convert Kelvin to Fahrenheit
- Handle missing data gracefully (some models/scenarios may be incomplete)

**Files:**
- `qgis-processing/services/metro_temperature_projections.py`
- Output: `qgis-processing/metro_temperature_projections.json`

---

### Issue 1.2: Run Temperature Extraction for All Metros
**Type:** Task
**Priority:** P0
**Estimate:** 1 point (+ 2 hours runtime)

**Description:**
Execute the temperature extraction script for all ~50 metros in the dataset.

**Acceptance Criteria:**
- [ ] Script runs successfully for all metros
- [ ] No metros missing data
- [ ] Output file size reasonable (~500KB - 2MB)
- [ ] Spot-check 5 random metros for data quality

**Technical Notes:**
- Run overnight due to Earth Engine API rate limits
- Log any metros with missing model data
- Consider caching intermediate results

---

### Issue 1.3: Add Temperature API Endpoint
**Type:** Feature
**Priority:** P0
**Estimate:** 2 points

**Description:**
Create Flask API endpoint to serve temperature projection data.

**Acceptance Criteria:**
- [ ] Endpoint: `GET /api/climate/metro-temperature/<metro_name>`
- [ ] Query params: `?scenario=ssp245|ssp585` (optional, defaults to both)
- [ ] Returns baseline + projections for requested scenario(s)
- [ ] Handles 404 for unknown metros
- [ ] Response time < 50ms (pre-computed data)

**API Response Example:**
```json
{
  "success": true,
  "data": {
    "name": "Denver",
    "lat": 39.7392,
    "lon": -104.9903,
    "baseline_1995_2014": {
      "avg_summer_max": 88.3,
      "avg_winter_min": 18.7,
      "avg_annual": 53.5
    },
    "projections": {
      "ssp585": {
        "2025": {"summer_max": 89.1, "annual_avg": 54.2},
        "2035": {"summer_max": 91.5, "annual_avg": 56.1},
        ...
      }
    }
  }
}
```

**Files:**
- `qgis-processing/climate_server.py` (add endpoint)

---

### Issue 1.4: Build Temperature Chart Component
**Type:** Feature
**Priority:** P1
**Estimate:** 3 points

**Description:**
Create React component to visualize temperature projections as line chart with scenario toggle.

**Acceptance Criteria:**
- [ ] Line chart shows temperature trend 2025-2095
- [ ] Baseline displayed as dashed reference line
- [ ] Toggle between SSP2-4.5 and SSP5-8.5
- [ ] Shows temperature increase delta prominently
- [ ] Warning indicators when temps exceed thresholds (e.g., >90°F annual avg)
- [ ] Responsive design
- [ ] Loading and error states

**Design Notes:**
- Color scheme: Blue (baseline) → Red gradient (projections)
- Use recharts or similar library
- Show both absolute temps and anomaly (increase from baseline)

**Files:**
- `apps/climate-studio/src/components/MetroTemperatureChart.tsx`

---

### Issue 1.5: Integrate Temperature Data into Metro Detail View
**Type:** Feature
**Priority:** P1
**Estimate:** 2 points

**Description:**
Add temperature projections section to existing metro popup/detail view.

**Acceptance Criteria:**
- [ ] When user clicks metro circle, show temperature chart
- [ ] Display key metrics: baseline temp, 2050 temp, 2095 temp, total increase
- [ ] Link to full analysis view
- [ ] Smooth animations on load

**Files:**
- Update existing metro detail component
- Hook into existing click handlers

---

## EPIC 2: Water Security Analysis (National)
**Goal:** Analyze water availability, groundwater depletion, and upstream/downstream conflicts for all US metros

**Priority:** P0 (Critical for investment decisions)

**Estimated Timeline:** 3 weeks

---

### Issue 2.1: Research and Map Water Sources
**Type:** Research
**Priority:** P0
**Estimate:** 5 points

**Description:**
Identify primary water sources (rivers, aquifers) for each US metro area.

**Deliverables:**
- [ ] Spreadsheet: `metro_name | primary_river | usgs_gage_id | primary_aquifer | river_basin`
- [ ] Document major river basin compacts and conflicts
- [ ] List depleting aquifers from GRACE data

**Research Focus:**
- Colorado River Basin metros (Phoenix, Las Vegas, LA, San Diego)
- Ogallala Aquifer metros (Denver, Kansas City, Dallas)
- California Central Valley (Fresno, Bakersfield, Sacramento)
- Mississippi/Missouri basins
- Great Lakes region

**Output:**
- `docs/WATER_SOURCES_BY_METRO.csv`
- `docs/RIVER_BASIN_CONFLICTS.md`

---

### Issue 2.2: Build USGS Stream Gage Finder Service
**Type:** Task
**Priority:** P0
**Estimate:** 3 points

**Description:**
Create service to find nearest USGS stream gage for each metro using dataretrieval package.

**Acceptance Criteria:**
- [ ] Function: `find_usgs_gage_for_metro(lat, lon, radius_km=50)`
- [ ] Returns gage ID, name, coordinates
- [ ] Handles metros with no nearby gages
- [ ] Validates gage has recent data (last 5 years)

**Technical Notes:**
- Use `dataretrieval.waterdata.get_info()`
- Filter for stream gages with daily discharge data
- Prioritize gages on major rivers

**Files:**
- `qgis-processing/services/usgs_gage_finder.py`

---

### Issue 2.3: Implement River Network Analysis (NLDI)
**Type:** Task
**Priority:** P0
**Estimate:** 5 points

**Description:**
Use USGS NLDI API to trace upstream/downstream relationships and identify metro dependencies.

**Acceptance Criteria:**
- [ ] Function: `get_upstream_network(usgs_gage_id, distance_km=500)`
- [ ] Returns list of upstream tributaries, gages, basin boundary
- [ ] Function: `get_downstream_network(usgs_gage_id, distance_km=200)`
- [ ] Identifies all metros on same river system
- [ ] Calculates dependency graph: metro_a depends on metro_b's water use

**Technical Notes:**
- Use `dataretrieval.nldi` module
- Navigation modes: UT (upstream tributaries), DM (downstream main stem)
- Cache results (NLDI can be slow)

**Files:**
- `qgis-processing/services/river_network_analyzer.py`

---

### Issue 2.4: Integrate GRACE Groundwater Depletion Data
**Type:** Task
**Priority:** P1
**Estimate:** 5 points

**Description:**
Add GRACE/GRACE-FO satellite groundwater trends for major US aquifers.

**Acceptance Criteria:**
- [ ] Pull GRACE data from Earth Engine: `ee.ImageCollection('NASA/GRACE/MASS_GRIDS/LAND')`
- [ ] Calculate linear trend (depletion rate) 2003-2024
- [ ] Map metros to affected aquifers
- [ ] Classify depletion severity: stable | moderate | severe | critical

**Aquifers to Analyze:**
- Ogallala (High Plains)
- California Central Valley
- Central Arizona
- Mississippi Embayment
- Atlantic Coastal Plain

**Files:**
- `qgis-processing/services/groundwater_analysis.py`

---

### Issue 2.5: Calculate Water Stress Scores
**Type:** Task
**Priority:** P0
**Estimate:** 3 points

**Description:**
Develop composite water stress metric (0-1 scale) combining multiple risk factors.

**Acceptance Criteria:**
- [ ] Algorithm considers:
  - Upstream competition (population density upstream)
  - River basin over-allocation status
  - Groundwater depletion rate
  - Legal/compact conflicts
  - Historical drought frequency
- [ ] Score calculation is transparent and documented
- [ ] Output: `metro_name | water_stress_score | risk_level`

**Scoring Weights:**
- Overallocated basin: +0.3
- Critical groundwater depletion: +0.3
- High upstream population growth: +0.2
- Legal conflicts: +0.1
- Large metro population: +0.1

**Files:**
- `qgis-processing/services/water_stress_calculator.py`

---

### Issue 2.6: Create Water Security API Endpoint
**Type:** Feature
**Priority:** P0
**Estimate:** 2 points

**Description:**
Flask endpoint serving water security analysis for each metro.

**Acceptance Criteria:**
- [ ] Endpoint: `GET /api/climate/metro-water-security/<metro_name>`
- [ ] Returns: water stress score, risk level, primary sources, upstream metros, conflicts
- [ ] Response time < 100ms

**API Response Example:**
```json
{
  "success": true,
  "data": {
    "metro_name": "Phoenix",
    "water_stress_score": 0.92,
    "risk_level": "extreme",
    "primary_sources": [
      {
        "name": "Colorado River",
        "type": "surface_water",
        "allocation_acre_feet": 2800000,
        "reliability": "critical"
      },
      {
        "name": "Central Arizona Aquifer",
        "type": "groundwater",
        "status": "depleting",
        "depletion_rate_ft_per_year": -8.5
      }
    ],
    "upstream_metros": ["Denver", "Las Vegas", "Los Angeles"],
    "river_basin": "colorado",
    "conflicts": [
      "Colorado River Compact disputes",
      "CAP allocation cuts (50% since 2022)"
    ]
  }
}
```

**Files:**
- `qgis-processing/climate_server.py` (add endpoint)

---

### Issue 2.7: Build Water Security Dashboard Component
**Type:** Feature
**Priority:** P1
**Estimate:** 5 points

**Description:**
React component visualizing water security metrics and upstream/downstream dependencies.

**Acceptance Criteria:**
- [ ] Water stress score gauge (0-100%)
- [ ] List of water sources with status indicators
- [ ] River network diagram showing upstream/downstream metros
- [ ] Groundwater depletion trend chart (if applicable)
- [ ] Warning callouts for critical conflicts

**Design Elements:**
- Color coding: Green (low stress) → Yellow → Orange → Red (extreme)
- Interactive hover: Click upstream metro to navigate to their profile
- Icons for water source types (river, groundwater, reservoir)

**Files:**
- `apps/climate-studio/src/components/WaterSecurityDashboard.tsx`

---

## EPIC 3: Combined Risk Analysis Dashboard
**Goal:** Integrate temperature and water data into unified metro risk assessment

**Priority:** P1 (High value for decision-making)

**Estimated Timeline:** 1 week

---

### Issue 3.1: Design Composite Risk Score Algorithm
**Type:** Task
**Priority:** P1
**Estimate:** 3 points

**Description:**
Create weighted risk score combining temperature increase and water stress.

**Acceptance Criteria:**
- [ ] Algorithm: `composite_risk = (temp_risk * 0.4) + (water_stress * 0.4) + (population_pressure * 0.2)`
- [ ] Temperature risk: Based on absolute temp and rate of increase
- [ ] Document methodology and assumptions
- [ ] Validate against known high-risk metros (Phoenix, Las Vegas, Fresno)

**Risk Thresholds:**
- Annual avg temp > 80°F: High risk
- Annual avg temp > 90°F: Extreme risk
- Temp increase > 5°F by 2050: High risk
- Water stress > 0.7: Extreme risk

**Files:**
- `qgis-processing/services/composite_risk_calculator.py`

---

### Issue 3.2: Build Metro Risk Profile Component
**Type:** Feature
**Priority:** P1
**Estimate:** 5 points

**Description:**
Comprehensive metro analysis view combining all risk factors.

**Acceptance Criteria:**
- [ ] Overall risk gauge/score
- [ ] Temperature projection chart
- [ ] Water security section
- [ ] Population growth trend
- [ ] Investment risk assessment (specifically for manufacturing/long-term assets)
- [ ] Comparison to national average/peer cities

**Special Features:**
- Phoenix gets "Manufacturing Investment Warning" callout
- Las Vegas gets "Tourism Viability Warning"
- Coastal cities get "Sea Level Rise" section (from existing data)

**Files:**
- `apps/climate-studio/src/components/MetroRiskProfile.tsx`

---

### Issue 3.3: Add Risk Scoring to Map Visualization
**Type:** Feature
**Priority:** P1
**Estimate:** 3 points

**Description:**
Update metro circle colors to reflect composite risk score instead of just population growth.

**Acceptance Criteria:**
- [ ] Circle fill color based on risk: Green → Yellow → Orange → Red
- [ ] Toggle between "Population Growth" and "Climate Risk" color modes
- [ ] Update legend accordingly
- [ ] Smooth color transitions

**Files:**
- Update `DeckGLMap.tsx` megaregion layer logic

---

### Issue 3.4: Create Risk Comparison Tool
**Type:** Feature
**Priority:** P2
**Estimate:** 5 points

**Description:**
Side-by-side comparison view for evaluating multiple metros.

**Acceptance Criteria:**
- [ ] Select 2-4 metros for comparison
- [ ] Show all metrics in table format
- [ ] Radar chart comparing risk dimensions
- [ ] Export comparison as PDF/image

**Use Cases:**
- Company deciding between Phoenix vs. Atlanta for new factory
- Family evaluating relocation options

**Files:**
- `apps/climate-studio/src/components/MetroComparison.tsx`

---

## EPIC 4: Data Quality & Documentation
**Goal:** Ensure data accuracy and provide methodology transparency

**Priority:** P2 (Important for credibility)

**Estimated Timeline:** 1 week

---

### Issue 4.1: Validate Temperature Projections Against NOAA
**Type:** Testing
**Priority:** P1
**Estimate:** 3 points

**Description:**
Spot-check temperature projections against NOAA Climate Explorer data.

**Acceptance Criteria:**
- [ ] Compare 10 random metros
- [ ] Differences < 5°F (models vary)
- [ ] Document any major discrepancies
- [ ] Add data source citations to UI

---

### Issue 4.2: Document Data Sources and Methodology
**Type:** Documentation
**Priority:** P1
**Estimate:** 3 points

**Description:**
Create comprehensive methodology document explaining data sources, calculations, and limitations.

**Deliverables:**
- [ ] `docs/DATA_SOURCES.md`: All datasets, APIs, citations
- [ ] `docs/METHODOLOGY.md`: Algorithm explanations, assumptions
- [ ] `docs/LIMITATIONS.md`: Known issues, uncertainty ranges

**Include:**
- IPCC scenario definitions (SSP2-4.5 vs SSP5-8.5)
- Model selection rationale
- Uncertainty quantification (model spread)
- Data update frequency

---

### Issue 4.3: Add Data Freshness Indicators
**Type:** Feature
**Priority:** P2
**Estimate:** 2 points

**Description:**
Show when data was last updated in the UI.

**Acceptance Criteria:**
- [ ] "Data as of: [date]" displayed on relevant views
- [ ] Tooltip explaining update frequency
- [ ] Warning if data > 6 months old

---

## EPIC 5: Future Enhancements (Backlog)
**Priority:** P3 (Future iterations)

---

### Issue 5.1: Add Precipitation Projections
**Description:** Show rainfall changes using NEX-GDDP-CMIP6 `pr` variable

### Issue 5.2: Wildfire Risk Analysis
**Description:** Integrate USFS wildfire hazard potential data

### Issue 5.3: Agricultural Viability
**Description:** Growing season length, frost dates, crop suitability

### Issue 5.4: Economic Impact Modeling
**Description:** Estimate GDP impact from climate risks

### Issue 5.5: Migration Flow Predictions
**Description:** Model population movements based on risk scores

---

## PROJECT MILESTONES

**Milestone 1: Temperature Data Complete** (End of Week 2)
- All metros have temperature projections
- API endpoint live
- Basic chart component working

**Milestone 2: Water Security Analysis Complete** (End of Week 5)
- Water stress scores calculated
- USGS gage mapping done
- Dashboard component built

**Milestone 3: Risk Dashboard Launch** (End of Week 6)
- Composite risk scores live
- Metro risk profiles accessible
- Map updated with risk colors

**Milestone 4: Production Ready** (End of Week 7)
- Documentation complete
- Data validation done
- Performance optimized

---

## TEAM ROLES

**Backend/Data Engineering:**
- Issues 1.1, 1.2, 1.3
- Issues 2.2, 2.3, 2.4, 2.5, 2.6
- Issue 3.1

**Frontend Development:**
- Issues 1.4, 1.5
- Issues 2.7
- Issues 3.2, 3.3, 3.4

**Research/Analysis:**
- Issue 2.1
- Issues 4.1, 4.2

---

## PRIORITY MATRIX

| Priority | Focus | Issues |
|----------|-------|--------|
| P0 | Must-have for MVP | 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.5, 2.6 |
| P1 | High value features | 1.4, 1.5, 2.4, 2.7, 3.1, 3.2, 3.3, 4.1, 4.2 |
| P2 | Nice to have | 3.4, 4.3 |
| P3 | Future iterations | Epic 5 |

---

## DEPENDENCIES

```
Issue 1.1 → 1.2 → 1.3 → 1.4 → 1.5
Issue 2.1 → 2.2 → 2.3 → 2.5 → 2.6 → 2.7
                    ↓
Issue 2.4 ──────────┘

Issues 1.3 + 2.6 → 3.1 → 3.2 → 3.3
```

---

## GETTING STARTED

To import into Linear:
1. Create project: "Climate Migration Analysis"
2. Create 5 epics (use titles above)
3. Create issues within each epic
4. Set priorities, estimates, assignees
5. Link dependencies using "Blocks" relationship

Alternatively, we can generate a CSV import file for Linear's bulk import feature.
