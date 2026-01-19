# Rivers to Metro Cities - Examples & Data Structure

## Target Rivers for Metro Cities

### High Priority Examples

#### 1. Phoenix, AZ Metro
- **Primary River**: Salt River
  - Flow: ~3,000-5,000 CFS (varies seasonally)
  - Dependency: ~40% of Phoenix water supply
  - Connection: Upstream reservoirs (Roosevelt, Apache, Canyon, Saguaro)
  - Risk: High - Already stressed, climate projections show decline
  - Impact: Critical - Phoenix is in desert, limited alternatives

- **Secondary River**: Verde River
  - Flow: ~1,500-2,500 CFS
  - Dependency: ~15% of Phoenix water supply
  - Connection: Upstream of Salt River confluence
  - Risk: Medium-High
  - Impact: Significant

#### 2. San Antonio, TX Metro
- **Primary Source**: Edwards Aquifer (groundwater, but recharged by rivers)
  - Recharge Rivers: San Antonio River, Guadalupe River tributaries
  - Dependency: ~60% of San Antonio water
  - Connection: Karst aquifer recharged by surface rivers
  - Risk: High - Aquifer depletion, river recharge declining
  - Impact: Critical

- **Surface River**: San Antonio River
  - Flow: ~500-1,500 CFS
  - Dependency: ~20% direct, ~40% indirect (aquifer recharge)
  - Connection: Flows through city, upstream sources critical
  - Risk: Medium-High
  - Impact: Significant

#### 3. Charlotte, NC Metro
- **Primary River**: Catawba River
  - Flow: ~4,000-8,000 CFS
  - Dependency: ~70% of Charlotte water supply
  - Connection: Upstream reservoirs (Lake Norman, Mountain Island Lake)
  - Risk: Medium - Growing demand, interstate water disputes
  - Impact: Critical

#### 4. Nashville, TN Metro
- **Primary River**: Cumberland River
  - Flow: ~8,000-15,000 CFS (borderline major, but regional)
  - Dependency: ~85% of Nashville water supply
  - Connection: Upstream of city, multiple dams
  - Risk: Medium - Generally stable but vulnerable to drought
  - Impact: Critical

#### 5. Kansas City, MO Metro
- **Primary Source**: Missouri River (major, but show tributaries)
  - Tributary: Blue River
    - Flow: ~500-1,500 CFS
    - Dependency: ~25% of KC water
    - Connection: Local watershed, upstream of city
    - Risk: Medium
    - Impact: Significant

#### 6. Minneapolis, MN Metro
- **Primary Source**: Mississippi River (major, but show headwaters significance)
  - Headwater Rivers: Minnesota River, St. Croix River
  - Flow: Minnesota River ~2,000-5,000 CFS
  - Dependency: ~30% of metro area water (via Mississippi)
  - Connection: Upstream of Minneapolis, critical for quality
  - Risk: Low-Medium - Generally abundant but quality concerns
  - Impact: Moderate

### Medium Priority Examples

#### 7. Austin, TX Metro
- **Primary River**: Colorado River (Texas, not the major one)
  - Flow: ~1,000-3,000 CFS
  - Dependency: ~60% of Austin water
  - Connection: Upstream reservoirs (Lake Travis, Lake Austin)
  - Risk: High - Drought-prone, growing demand
  - Impact: Critical

#### 8. Raleigh, NC Metro
- **Primary River**: Neuse River
  - Flow: ~2,000-4,000 CFS
  - Dependency: ~50% of Raleigh water
  - Connection: Upstream of city, Falls Lake reservoir
  - Risk: Medium - Growing population pressure
  - Impact: Significant

#### 9. Salt Lake City, UT Metro
- **Primary Rivers**: Jordan River, Weber River
  - Flow: Jordan ~500-1,500 CFS, Weber ~1,000-3,000 CFS
  - Dependency: ~40% combined
  - Connection: Upstream of city, mountain snowpack dependent
  - Risk: High - Snowpack decline, drought
  - Impact: Critical

#### 10. Boise, ID Metro
- **Primary River**: Boise River
  - Flow: ~2,000-5,000 CFS
  - Dependency: ~70% of Boise water
  - Connection: Upstream reservoirs (Lucky Peak, Arrowrock)
  - Risk: Medium-High - Snowpack dependent
  - Impact: Critical

## Data Structure Template

```json
{
  "type": "FeatureCollection",
  "name": "Metro-Connecting Rivers - Water Access Limiting Factors",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "name": "Salt River",
        "baseline_flow_cfs_2025": 4000,
        "river_tier": "significant_connecting",
        "metro_cities": [
          {
            "name": "Phoenix",
            "lat": 33.4484,
            "lng": -112.0740,
            "dependency_percent": 40,
            "connection_type": "primary_source",
            "connection_details": "Upstream reservoirs supply Phoenix via Salt River Project",
            "water_access_risk": "high",
            "urban_prosperity_impact": "critical"
          }
        ],
        "flow_projections": {
          "2025": 4000,
          "2035": 3600,
          "2050": 3200,
          "2075": 2600,
          "2100": 2200,
          "2125": 1800
        },
        "depletion_factors": "Reduced snowpack, increased evaporation, prolonged drought, growing demand",
        "watershed_area_sqmi": 13000,
        "upstream_dams": ["Roosevelt", "Apache", "Canyon", "Saguaro"],
        "alternatives_available": false,
        "climate_vulnerability": "high"
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-111.5, 34.2],
          [-111.3, 33.8],
          [-111.1, 33.5],
          [-111.0, 33.4],
          [-110.9, 33.3]
        ]
      }
    }
  ]
}
```

## Connection Type Definitions

### `primary_source`
- River provides >50% of city's water supply
- City has limited alternatives
- River depletion would cause severe water stress
- **Visual**: Bold, solid line, high opacity

### `significant_supply`
- River provides 20-50% of city's water supply
- City has some alternatives but river is important
- River depletion would cause moderate water stress
- **Visual**: Medium, dashed line, medium opacity

### `upstream_limiting`
- River is upstream of city and affects water quality/availability
- May not be direct supply but limits overall water access
- River depletion/contamination impacts city downstream
- **Visual**: Thin, dotted line, lower opacity

## Water Access Risk Levels

### `high`
- River flow projected to decline >30% by 2050
- City has limited alternative water sources
- River is already stressed or over-allocated
- Climate projections show increased drought frequency

### `medium`
- River flow projected to decline 15-30% by 2050
- City has some alternative sources
- River is generally stable but vulnerable
- Climate projections show moderate impacts

### `low`
- River flow projected to decline <15% by 2050
- City has multiple alternative sources
- River is stable and well-managed
- Climate projections show minimal impacts

## Urban Prosperity Impact Levels

### `critical`
- Water access directly limits:
  - Population growth capacity
  - Economic development
  - Agricultural production
  - Industrial operations
- River depletion would cause:
  - Water rationing
  - Economic contraction
  - Population migration
  - Infrastructure stress

### `significant`
- Water access moderately limits:
  - Some growth sectors
  - Certain industries
  - Agricultural expansion
- River depletion would cause:
  - Increased water costs
  - Some economic constraints
  - Quality of life impacts

### `moderate`
- Water access has minor limitations
- River depletion would cause:
  - Some inconvenience
  - Minor cost increases
  - Manageable impacts

## Filtering Criteria Summary

### Include (Tier 2: Significant Connecting Rivers)
- Flow: 500-10,000 CFS baseline
- Supplies 1-3 metro cities
- Dependency: >20% for at least one city
- Upstream of city (water source)
- Can limit water access if depleted
- Not already in major rivers list

### Exclude
- **Tier 1 Major Rivers**: Already documented (Colorado, Mississippi, etc.)
- **Tier 3 Feeder Rivers**: Flow <500 CFS, tributaries only
- **Downstream Rivers**: Rivers that flow past city but don't supply it
- **Non-Significant**: <20% dependency, city has abundant alternatives

## Integration Notes

### With Metro Statistics Layer
- Show connecting rivers when `megaregion_timeseries` layer is active
- Filter rivers to only show those connected to visible metro cities
- Color-code by flow depletion (same scheme as existing rivers.json)
- Add connection lines from rivers to metro cities

### With Water Access View
- Optionally show metro connections in WaterAccessView
- Allow filtering by metro city
- Show combined water access risk (rivers + aquifers)

## Data Sources for Research

1. **USGS Water Data**: https://waterdata.usgs.gov/
   - Streamflow data
   - Water use by state/county
   - Reservoir levels

2. **EPA Watershed Data**: https://www.epa.gov/waterdata
   - Watershed boundaries
   - Water quality data
   - Source water assessments

3. **State Water Agencies**:
   - State-specific water supply reports
   - Water rights data
   - Reservoir operations

4. **City Water Departments**:
   - Water source reports
   - Water supply plans
   - Drought contingency plans

5. **Climate Projections**:
   - NOAA Climate.gov
   - USGS Climate Adaptation Science Centers
   - Regional climate assessments
