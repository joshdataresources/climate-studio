# Plan: Connecting Rivers to Metro Cities in Climate Layer

## Overview
Show rivers that connect to cities in the Metro Data Statistics Climate layer. These rivers should be significant enough to limit water access upstream and impact urban prosperity, but not so major that they're already well-documented, and not so small (feeder rivers) that they're insignificant.

## Objectives
1. **Identify connecting rivers**: Rivers that actually supply water to metro cities
2. **Filter by significance**: Not major rivers (already in rivers.json), not feeder rivers (too small)
3. **Show water access limitations**: Rivers that can limit urban prosperity and water necessary for survival
4. **Integrate with Metro Statistics Layer**: Display when the megaregion_timeseries layer is active

## River Classification Criteria

### Tier 1: Major Rivers (Already Documented)
- **Examples**: Colorado, Mississippi, Columbia, Rio Grande
- **Characteristics**: 
  - Flow > 10,000 CFS baseline
  - Multiple major cities depend on them
  - Already in rivers.json
- **Action**: Use existing data, enhance with metro connections

### Tier 2: Significant Connecting Rivers (Target for This Feature)
- **Characteristics**:
  - Flow: 500-10,000 CFS baseline
  - Supply 1-3 metro cities
  - Can limit water access if depleted
  - Upstream of cities (water source, not just passing through)
  - Critical for urban water supply (>30% dependency)
- **Examples**:
  - Chattahoochee (Atlanta) - 6,500 CFS
  - Trinity (Dallas) - 6,000 CFS
  - South Platte (Denver) - 500 CFS
  - Potomac (DC) - 11,000 CFS (borderline major)
  - Delaware (Philly/NYC) - 11,000 CFS (borderline major)

### Tier 3: Feeder Rivers (Exclude)
- **Characteristics**:
  - Flow < 500 CFS
  - Tributaries to larger rivers
  - Not directly supplying cities
  - Too small to significantly impact urban water access
- **Action**: Exclude from visualization

## Data Sources Needed

### 1. Metro City Data (Existing)
- **File**: `apps/climate-studio/src/data/megaregion-data.json`
- **Contains**: 50+ metro areas with lat/lon, population projections
- **Status**: ✅ Available

### 2. River Network Data
- **Option A**: USGS National Hydrography Dataset (NHD)
  - Comprehensive river network
  - Includes flow data, stream order
  - Requires processing to extract relevant rivers
- **Option B**: Natural Earth Rivers
  - Already available in backend (`naturalEarth.js`)
  - Less detailed but easier to use
- **Option C**: OpenStreetMap Waterways
  - Most detailed
  - Requires significant processing

### 3. City-River Connection Data
- **Method 1**: Proximity-based (within X km of city)
  - Simple but may miss actual connections
- **Method 2**: Watershed-based (city in river's watershed)
  - More accurate
  - Requires watershed boundary data
- **Method 3**: Water supply dependency data
  - Most accurate
  - May require manual research/curation

### 4. Flow/Depletion Projections
- **Source**: USGS Water Data, climate projections
- **Needed**: Baseline flow, projected depletion by year
- **Similar to**: Existing rivers.json structure

## Implementation Plan

### Phase 1: Data Collection & Processing

#### Step 1.1: Identify Metro Cities Needing River Connections
- [ ] Extract all metro cities from megaregion-data.json
- [ ] Cross-reference with existing rivers.json cities_supplied
- [ ] Identify cities NOT yet connected to rivers
- [ ] Prioritize cities with high population and water stress

#### Step 1.2: Research & Curate Connecting Rivers
For each unconnected metro city:
- [ ] Identify primary water source rivers (research-based)
- [ ] Determine river flow (CFS) and significance
- [ ] Check if river is upstream of city (critical for water access)
- [ ] Calculate water dependency percentage
- [ ] Filter: Keep Tier 2 rivers (500-10,000 CFS), exclude Tier 3 feeders

#### Step 1.3: Create Enhanced Rivers Dataset
- [ ] Create `metro-connecting-rivers.json` with structure:
  ```json
  {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "properties": {
          "name": "River Name",
          "baseline_flow_cfs_2025": 6000,
          "metro_cities": [
            {
              "name": "City Name",
              "lat": 33.749,
              "lng": -84.388,
              "dependency_percent": 70,
              "connection_type": "primary_source" | "significant_supply" | "upstream_limiting"
            }
          ],
          "flow_projections": { "2025": 6000, "2050": 5720, ... },
          "depletion_factors": "...",
          "water_access_risk": "high" | "medium" | "low",
          "urban_prosperity_impact": "critical" | "significant" | "moderate"
        },
        "geometry": { "type": "LineString", "coordinates": [...] }
      }
    ]
  }
  ```

### Phase 2: Integration with Metro Statistics Layer

#### Step 2.1: Enhance MegaregionLayer Component
- [ ] Add river visualization when metro layer is active
- [ ] Show connecting rivers for visible metro cities
- [ ] Color-code by water access risk or flow depletion
- [ ] Add toggle to show/hide connecting rivers

#### Step 2.2: River-Metro Connection Visualization
- [ ] Draw lines from rivers to metro cities they supply
- [ ] Use different line styles for connection types:
  - Primary source: Bold, solid
  - Significant supply: Medium, dashed
  - Upstream limiting: Thin, dotted
- [ ] Show flow depletion projections on river segments

#### Step 2.3: Interactive Features
- [ ] Click river to see:
  - Connected metro cities
  - Water dependency percentages
  - Flow projections
  - Urban prosperity impact
- [ ] Click metro city to see:
  - All connecting rivers
  - Total water dependency
  - Water access risk level

### Phase 3: Data Processing Script

#### Step 3.1: Create River-Metro Matcher Script
- [ ] Script: `scripts/match-rivers-to-metros.js` or Python equivalent
- [ ] Input: megaregion-data.json, river network data
- [ ] Process:
  1. For each metro city, find nearby rivers (within 50km)
  2. Filter by flow (500-10,000 CFS)
  3. Check if upstream of city (watershed analysis)
  4. Calculate dependency based on city size and river flow
- [ ] Output: Enhanced rivers dataset with metro connections

#### Step 3.2: Manual Curation Support
- [ ] Create spreadsheet template for manual research
- [ ] Fields: Metro name, River name, Flow CFS, Dependency %, Connection type, Notes
- [ ] Import script to convert spreadsheet to JSON

### Phase 4: UI/UX Enhancements

#### Step 4.1: Layer Controls
- [ ] Add "Connecting Rivers" toggle to Metro Statistics layer controls
- [ ] Add filter options:
  - Show all connecting rivers
  - Show only high-risk rivers (water access risk = "high")
  - Show only critical impact rivers (urban_prosperity_impact = "critical")

#### Step 4.2: Legend & Information
- [ ] Add legend for:
  - River flow depletion colors (similar to existing rivers.json)
  - Connection type line styles
  - Water access risk levels
- [ ] Add info panel explaining:
  - What "connecting rivers" means
  - Why these rivers matter for urban prosperity
  - How to interpret the visualization

## Example Cities & Rivers to Include

### High Priority (High Population, Water Stress)
1. **Atlanta, GA** → Chattahoochee River (already in rivers.json, enhance)
2. **Dallas, TX** → Trinity River (already in rivers.json, enhance)
3. **Denver, CO** → South Platte River (already in rivers.json, enhance)
4. **Phoenix, AZ** → Salt River, Verde River (not in rivers.json)
5. **Las Vegas, NV** → Colorado River (already connected, enhance)
6. **San Antonio, TX** → San Antonio River, Edwards Aquifer recharge
7. **Charlotte, NC** → Catawba River
8. **Nashville, TN** → Cumberland River
9. **Kansas City, MO** → Missouri River tributaries
10. **Minneapolis, MN** → Minnesota River, Mississippi headwaters

### Medium Priority
- Cities with moderate water stress
- Rivers with 1,000-5,000 CFS flow
- Secondary water sources

## Technical Considerations

### Performance
- Only load rivers for visible metro cities (viewport-based)
- Use simplified river geometries for overview, detailed for zoom
- Cache river-metro connections

### Data Accuracy
- Prioritize accuracy over completeness
- Start with well-researched connections
- Allow manual curation and updates

### Integration Points
- **MegaregionLayer.tsx**: Add river visualization
- **climateLayers.ts**: Add river layer config if needed
- **rivers.json**: Enhance existing or create new dataset
- **WaterAccessView.tsx**: May want to show metro connections here too

## Success Criteria
1. ✅ All major metro cities have at least one connecting river shown
2. ✅ Rivers are filtered appropriately (not major, not feeder)
3. ✅ Water access limitations are clearly visualized
4. ✅ Urban prosperity impact is communicated
5. ✅ Integration with Metro Statistics layer is seamless
6. ✅ Performance is acceptable (no lag when toggling)

## Next Steps
1. **Immediate**: Review and refine this plan
2. **Short-term**: Start with manual curation of top 10 metro cities
3. **Medium-term**: Build data processing script for automated matching
4. **Long-term**: Integrate with watershed analysis for accuracy

## Questions to Resolve
1. Should we merge with existing rivers.json or create separate dataset?
2. What's the exact flow threshold for "significant but not major"?
3. How do we determine "upstream" vs "downstream" of cities?
4. Should we show all connecting rivers or only those with >X% dependency?
5. How to handle cities with multiple river sources?
