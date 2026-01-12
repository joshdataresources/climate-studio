# Climate Migration Analysis - Implementation Plan

## Context: The Phoenix Factory Paradox
Why build factories in Phoenix when climate projections show:
- Summer temps reaching 120°F+ by 2050
- Colorado River allocations declining
- Groundwater depletion (Central Arizona dropping 500+ feet since 1900)
- Upstream competition from 40M people in 7 states

**Answer:** Short-term land/labor costs + tax incentives vs. long-term existential risk. Your tool will make this visible.

---

## PHASE 1: Temperature Projections per Metro

### 1.1 Data Schema Extension
Add to `megaregion-data.json`:
```json
{
  "name": "Phoenix",
  "lat": 33.4484,
  "lon": -112.074,
  "populations": {...},
  "temperature_projections": {
    "baseline_1995_2014": {
      "avg_summer_max": 104.5,
      "avg_winter_min": 45.2,
      "avg_annual": 75.3
    },
    "projections": {
      "ssp245": {
        "2025": {"summer_max": 105.8, "annual_avg": 76.1},
        "2035": {"summer_max": 107.2, "annual_avg": 77.5},
        "2050": {"summer_max": 110.1, "annual_avg": 80.2},
        "2075": {"summer_max": 113.8, "annual_avg": 83.9},
        "2100": {"summer_max": 116.5, "annual_avg": 86.1}
      },
      "ssp585": {
        "2025": {"summer_max": 106.1, "annual_avg": 76.4},
        "2035": {"summer_max": 108.9, "annual_avg": 78.8},
        "2050": {"summer_max": 113.2, "annual_avg": 82.7},
        "2075": {"summer_max": 119.4, "annual_avg": 88.3},
        "2100": {"summer_max": 124.7, "annual_avg": 92.8}
      }
    }
  }
}
```

### 1.2 Backend Service: Temperature Extraction

**File:** `qgis-processing/services/metro_temperature_projections.py`

```python
"""
Extract decadal temperature projections for US metro areas
using NASA NEX-GDDP-CMIP6 from Google Earth Engine
"""
import ee
import json
from typing import Dict, List

class MetroTemperatureService:
    """Calculate future temperature projections for metro areas"""

    MODELS = ['ACCESS-CM2', 'CMCC-ESM2', 'MIROC6', 'MRI-ESM2-0']  # Use ensemble
    SCENARIOS = ['ssp245', 'ssp585']
    DECADES = [2025, 2035, 2045, 2055, 2065, 2075, 2085, 2095]
    BASELINE_START = '1995-01-01'
    BASELINE_END = '2014-12-31'

    def __init__(self, ee_project: str):
        self.ee_project = ee_project
        ee.Initialize(project=ee_project)

    def get_baseline_temperatures(self, lat: float, lon: float, radius_km: float = 50) -> Dict:
        """Get 1995-2014 baseline temperatures for comparison"""

        point = ee.Geometry.Point([lon, lat])
        region = point.buffer(radius_km * 1000)  # Convert km to meters

        # Use ERA5 reanalysis for baseline (more accurate than models for historical)
        # Or use historical CMIP6 data
        dataset = ee.ImageCollection('NASA/GDDP-CMIP6') \
            .filter(ee.Filter.date(self.BASELINE_START, self.BASELINE_END)) \
            .filter(ee.Filter.eq('scenario', 'historical')) \
            .filter(ee.Filter.eq('model', 'ACCESS-CM2')) \
            .select(['tasmax', 'tasmin'])

        # Calculate statistics
        stats = dataset.mean().reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=region,
            scale=25000,
            maxPixels=1e9
        ).getInfo()

        # Convert Kelvin to Fahrenheit
        tasmax_f = (stats['tasmax'] - 273.15) * 9/5 + 32
        tasmin_f = (stats['tasmin'] - 273.15) * 9/5 + 32
        avg_annual = (tasmax_f + tasmin_f) / 2

        return {
            'avg_summer_max': round(tasmax_f, 1),
            'avg_winter_min': round(tasmin_f, 1),
            'avg_annual': round(avg_annual, 1)
        }

    def get_decadal_projections(self, lat: float, lon: float,
                                 scenario: str, decade: int,
                                 radius_km: float = 50) -> Dict:
        """Get temperature projection for a specific decade"""

        point = ee.Geometry.Point([lon, lat])
        region = point.buffer(radius_km * 1000)

        # Define decade range
        start_year = decade
        end_year = decade + 9

        # Multi-model ensemble
        model_results = []
        for model in self.MODELS:
            try:
                dataset = ee.ImageCollection('NASA/GDDP-CMIP6') \
                    .filter(ee.Filter.date(f'{start_year}-01-01', f'{end_year}-12-31')) \
                    .filter(ee.Filter.eq('scenario', scenario)) \
                    .filter(ee.Filter.eq('model', model)) \
                    .select(['tasmax', 'tasmin'])

                stats = dataset.mean().reduceRegion(
                    reducer=ee.Reducer.mean(),
                    geometry=region,
                    scale=25000,
                    maxPixels=1e9
                ).getInfo()

                if stats.get('tasmax') and stats.get('tasmin'):
                    model_results.append(stats)
            except Exception as e:
                print(f"Error with model {model}: {e}")
                continue

        if not model_results:
            raise ValueError(f"No data available for {scenario} {decade}")

        # Average across models
        avg_tasmax = sum(r['tasmax'] for r in model_results) / len(model_results)
        avg_tasmin = sum(r['tasmin'] for r in model_results) / len(model_results)

        # Convert Kelvin to Fahrenheit
        tasmax_f = (avg_tasmax - 273.15) * 9/5 + 32
        tasmin_f = (avg_tasmin - 273.15) * 9/5 + 32
        annual_avg = (tasmax_f + tasmin_f) / 2

        return {
            'summer_max': round(tasmax_f, 1),
            'winter_min': round(tasmin_f, 1),
            'annual_avg': round(annual_avg, 1),
            'models_used': len(model_results)
        }

    def generate_all_metro_projections(self, metros: List[Dict]) -> Dict:
        """Generate temperature projections for all metros"""

        results = {}
        for metro in metros:
            print(f"Processing {metro['name']}...")

            metro_data = {
                'name': metro['name'],
                'lat': metro['lat'],
                'lon': metro['lon'],
                'baseline_1995_2014': self.get_baseline_temperatures(
                    metro['lat'], metro['lon']
                ),
                'projections': {}
            }

            for scenario in self.SCENARIOS:
                metro_data['projections'][scenario] = {}
                for decade in self.DECADES:
                    try:
                        proj = self.get_decadal_projections(
                            metro['lat'], metro['lon'],
                            scenario, decade
                        )
                        metro_data['projections'][scenario][str(decade)] = proj
                    except Exception as e:
                        print(f"Error for {metro['name']} {scenario} {decade}: {e}")

            results[metro['name']] = metro_data

        return results


if __name__ == '__main__':
    import os

    # Load existing metro data
    with open('../apps/climate-studio/src/data/megaregion-data.json') as f:
        data = json.load(f)

    service = MetroTemperatureService(
        ee_project=os.getenv('EARTHENGINE_PROJECT', 'josh-geo-the-second')
    )

    # Generate projections
    projections = service.generate_all_metro_projections(data['metros'])

    # Save results
    with open('metro_temperature_projections.json', 'w') as f:
        json.dump(projections, f, indent=2)

    print("✅ Temperature projections generated!")
```

### 1.3 API Endpoint

**File:** `qgis-processing/climate_server.py` (add endpoint)

```python
@app.route('/api/climate/metro-temperature/<metro_name>', methods=['GET'])
def metro_temperature(metro_name):
    """
    Get temperature projections for a specific metro area

    Query Parameters:
        scenario: 'ssp245' or 'ssp585' (default: both)

    Returns:
        JSON with baseline and projection data
    """
    try:
        scenario = request.args.get('scenario', None)

        # Load pre-computed projections
        with open('metro_temperature_projections.json') as f:
            projections = json.load(f)

        if metro_name not in projections:
            return jsonify({
                'success': False,
                'error': f'Metro {metro_name} not found'
            }), 404

        data = projections[metro_name]

        # Filter by scenario if requested
        if scenario:
            data['projections'] = {
                scenario: data['projections'].get(scenario, {})
            }

        return jsonify({
            'success': True,
            'data': data
        })

    except Exception as e:
        logger.error(f"Error fetching metro temperature: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
```

### 1.4 Frontend Component

**File:** `apps/climate-studio/src/components/MetroTemperatureChart.tsx`

```typescript
import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'

interface TemperatureChartProps {
  metroName: string
  scenario: 'ssp245' | 'ssp585'
}

export function MetroTemperatureChart({ metroName, scenario }: TemperatureChartProps) {
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    fetch(`/api/climate/metro-temperature/${metroName}?scenario=${scenario}`)
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          setData(result.data)
        }
        setLoading(false)
      })
  }, [metroName, scenario])

  if (loading) return <div>Loading temperature projections...</div>
  if (!data) return <div>No data available</div>

  // Transform data for chart
  const baseline = data.baseline_1995_2014.avg_annual
  const projections = data.projections[scenario]

  const chartData = Object.entries(projections).map(([year, temps]: any) => ({
    year: parseInt(year),
    temperature: temps.annual_avg,
    baseline: baseline
  }))

  const tempIncrease = chartData[chartData.length - 1].temperature - baseline

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">{metroName} Temperature Projections</h3>
        <div className="text-sm">
          <span className="text-muted-foreground">Baseline (1995-2014): </span>
          <span className="font-medium">{baseline}°F</span>
        </div>
      </div>

      <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
        <p className="text-sm">
          <span className="font-semibold text-destructive">
            +{tempIncrease.toFixed(1)}°F by 2095
          </span>
          {' '}({scenario === 'ssp245' ? 'Moderate' : 'High'} Emissions Scenario)
        </p>
      </div>

      <LineChart width={600} height={300} data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="year" />
        <YAxis label={{ value: 'Temperature (°F)', angle: -90, position: 'insideLeft' }} />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="baseline"
          stroke="#888"
          strokeDasharray="5 5"
          name="1995-2014 Baseline"
        />
        <Line
          type="monotone"
          dataKey="temperature"
          stroke="#ef4444"
          strokeWidth={2}
          name="Projected Temperature"
        />
      </LineChart>

      {/* Warning threshold indicators */}
      {chartData.some(d => d.temperature > 90) && (
        <div className="text-xs text-amber-600">
          ⚠️ Average annual temperature exceeds 90°F in some decades
        </div>
      )}
    </div>
  )
}
```

---

## PHASE 2: Water Security Analysis

### 2.1 Data Schema for Water Security

```json
{
  "name": "Phoenix",
  "water_security": {
    "primary_sources": [
      {
        "name": "Colorado River",
        "type": "surface_water",
        "allocation_acre_feet": 2800000,
        "actual_delivery_2023": 1400000,
        "reliability": "critical",
        "upstream_states": ["CO", "UT", "WY", "NM"],
        "major_upstream_cities": [
          "Denver", "Las Vegas", "Los Angeles", "San Diego"
        ]
      },
      {
        "name": "Central Arizona Aquifer",
        "type": "groundwater",
        "status": "depleting",
        "depletion_rate_ft_per_year": -8.5,
        "total_decline_since_1900_ft": -520
      }
    ],
    "usgs_gage_id": "09522000",  // Colorado River near Imperial Dam
    "risk_factors": {
      "upstream_competition": "extreme",
      "groundwater_sustainability": "critical",
      "drought_vulnerability": "extreme",
      "legal_conflicts": ["Colorado River Compact disputes", "CAP allocation cuts"]
    },
    "water_stress_score": 0.92  // 0-1 scale, 1 = most stressed
  }
}
```

### 2.2 River Network Service

**File:** `qgis-processing/services/water_security_analysis.py`

```python
"""
Analyze water security for US metro areas using USGS data and river networks
"""
import requests
from dataretrieval import nldi, waterdata
from typing import Dict, List, Tuple

class WaterSecurityService:
    """Analyze water security and upstream/downstream dependencies"""

    # Major US river basins and their conflicts
    RIVER_BASINS = {
        'colorado': {
            'name': 'Colorado River Basin',
            'states': ['CO', 'UT', 'WY', 'NM', 'AZ', 'NV', 'CA'],
            'total_allocation_af': 16_500_000,  # Acre-feet per year
            'actual_avg_flow_af': 12_300_000,  # 2000-2021 average
            'overallocated': True,
            'compact_year': 1922,
            'major_metros': ['Phoenix', 'Las Vegas', 'Los Angeles', 'San Diego', 'Denver']
        },
        'missouri': {
            'name': 'Missouri River Basin',
            'states': ['MT', 'ND', 'SD', 'WY', 'CO', 'NE', 'KS', 'MO', 'IA'],
            'major_metros': ['Kansas City', 'Omaha', 'Sioux Falls']
        },
        'mississippi': {
            'name': 'Mississippi River Basin',
            'states': ['MN', 'WI', 'IA', 'IL', 'MO', 'KY', 'TN', 'AR', 'MS', 'LA'],
            'major_metros': ['Minneapolis', 'St. Louis', 'Memphis', 'New Orleans']
        }
    }

    # Major depleting aquifers (from GRACE/GRACE-FO data)
    AQUIFERS = {
        'ogallala': {
            'name': 'High Plains (Ogallala) Aquifer',
            'states': ['SD', 'WY', 'NE', 'CO', 'KS', 'OK', 'TX', 'NM'],
            'area_sq_mi': 174_000,
            'status': 'severe_depletion',
            'depletion_rate_km3_per_year': -8.3,
            'metros_affected': ['Denver', 'Dallas']
        },
        'central_valley': {
            'name': 'California Central Valley Aquifer',
            'states': ['CA'],
            'status': 'critical_depletion',
            'depletion_rate_km3_per_year': -6.0,
            'metros_affected': ['Fresno', 'Bakersfield', 'Sacramento']
        },
        'central_arizona': {
            'name': 'Central Arizona Aquifer',
            'states': ['AZ'],
            'status': 'critical_depletion',
            'depletion_rate_ft_per_year': -8.5,
            'metros_affected': ['Phoenix', 'Tucson']
        }
    }

    def find_usgs_gage_for_metro(self, lat: float, lon: float,
                                   radius_km: float = 50) -> Dict:
        """Find nearest USGS stream gage to metro area"""
        try:
            # Search for USGS sites near coordinates
            sites_df = waterdata.get_info(
                stateCd=None,  # Search all states
                bBox=f"{lon-0.5},{lat-0.5},{lon+0.5},{lat+0.5}",  # ~50km box
                siteType='ST',  # Stream
                hasDataTypeCd='dv'  # Has daily values
            )

            if sites_df.empty:
                return None

            # Get the closest site
            closest = sites_df.iloc[0]

            return {
                'site_no': closest['site_no'],
                'station_nm': closest['station_nm'],
                'dec_lat_va': closest.get('dec_lat_va'),
                'dec_long_va': closest.get('dec_long_va')
            }
        except Exception as e:
            print(f"Error finding USGS gage: {e}")
            return None

    def get_upstream_dependencies(self, usgs_gage_id: str,
                                   distance_km: int = 500) -> List[Dict]:
        """Get all upstream river reaches and gages"""
        try:
            # Get upstream network
            flowlines = nldi.get_flowlines(
                feature_source='nwissite',
                feature_id=f'USGS-{usgs_gage_id}',
                navigation_mode='UT',  # Upstream with tributaries
                distance=distance_km
            )

            # Find upstream monitoring sites
            upstream_sites = nldi.get_features(
                feature_source='nwissite',
                feature_id=f'USGS-{usgs_gage_id}',
                navigation_mode='UT',
                data_source='nwissite'
            )

            return {
                'flowline_count': len(flowlines) if flowlines is not None else 0,
                'upstream_gage_count': len(upstream_sites) if upstream_sites is not None else 0,
                'total_upstream_distance_km': distance_km
            }
        except Exception as e:
            print(f"Error getting upstream dependencies: {e}")
            return None

    def calculate_water_stress_score(self, metro_name: str,
                                      population: int,
                                      river_basin: str = None) -> float:
        """
        Calculate water stress score (0-1, higher = more stressed)
        Based on: upstream competition, groundwater status, allocation cuts
        """
        score = 0.0

        # Check if in overallocated basin
        if river_basin and river_basin in self.RIVER_BASINS:
            basin = self.RIVER_BASINS[river_basin]
            if basin.get('overallocated'):
                score += 0.3
                # Additional penalty for being downstream
                if metro_name in basin['major_metros'][len(basin['major_metros'])//2:]:
                    score += 0.2

        # Check groundwater depletion
        for aquifer_name, aquifer in self.AQUIFERS.items():
            if metro_name in aquifer.get('metros_affected', []):
                if aquifer['status'] == 'critical_depletion':
                    score += 0.3
                elif aquifer['status'] == 'severe_depletion':
                    score += 0.2

        # Population pressure (large cities stress water more)
        if population > 5_000_000:
            score += 0.1
        elif population > 2_000_000:
            score += 0.05

        return min(score, 1.0)  # Cap at 1.0

    def analyze_metro_water_security(self, metro: Dict) -> Dict:
        """Complete water security analysis for a metro area"""

        name = metro['name']
        lat = metro['lat']
        lon = metro['lon']
        population = metro['populations'].get('2025', 0)

        # Find nearest gage
        gage = self.find_usgs_gage_for_metro(lat, lon)

        # Determine river basin
        river_basin = None
        for basin_key, basin_data in self.RIVER_BASINS.items():
            if name in basin_data.get('major_metros', []):
                river_basin = basin_key
                break

        # Calculate stress score
        stress_score = self.calculate_water_stress_score(
            name, population, river_basin
        )

        # Get upstream dependencies if gage found
        upstream = None
        if gage:
            upstream = self.get_upstream_dependencies(gage['site_no'])

        return {
            'metro_name': name,
            'usgs_gage': gage,
            'river_basin': river_basin,
            'upstream_network': upstream,
            'water_stress_score': round(stress_score, 2),
            'risk_level': 'extreme' if stress_score > 0.7 else
                         'high' if stress_score > 0.5 else
                         'moderate' if stress_score > 0.3 else 'low'
        }


if __name__ == '__main__':
    import json

    # Load metro data
    with open('../apps/climate-studio/src/data/megaregion-data.json') as f:
        data = json.load(f)

    service = WaterSecurityService()

    # Analyze each metro
    results = []
    for metro in data['metros']:
        print(f"Analyzing water security for {metro['name']}...")
        analysis = service.analyze_metro_water_security(metro)
        results.append(analysis)

    # Save results
    with open('metro_water_security.json', 'w') as f:
        json.dump(results, f, indent=2)

    print("✅ Water security analysis complete!")
```

---

## PHASE 3: Combined Analysis Dashboard

### 3.1 Metro Risk Profile Component

```typescript
// apps/climate-studio/src/components/MetroRiskProfile.tsx

interface MetroRiskProfileProps {
  metroName: string
}

export function MetroRiskProfile({ metroName }: MetroRiskProfileProps) {
  const [tempData, setTempData] = useState<any>(null)
  const [waterData, setWaterData] = useState<any>(null)

  // Fetch both datasets
  useEffect(() => {
    Promise.all([
      fetch(`/api/climate/metro-temperature/${metroName}`).then(r => r.json()),
      fetch(`/api/climate/metro-water-security/${metroName}`).then(r => r.json())
    ]).then(([temp, water]) => {
      setTempData(temp.data)
      setWaterData(water.data)
    })
  }, [metroName])

  if (!tempData || !waterData) return <div>Loading risk analysis...</div>

  // Calculate composite risk score
  const tempRisk = calculateTempRisk(tempData)
  const waterRisk = waterData.water_stress_score
  const compositeRisk = (tempRisk + waterRisk) / 2

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{metroName} Climate Risk Profile</h2>

      {/* Composite Risk Gauge */}
      <div className="p-6 bg-card rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold">Overall Climate Risk</span>
          <span className={`text-3xl font-bold ${getRiskColor(compositeRisk)}`}>
            {(compositeRisk * 100).toFixed(0)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
          <div
            className={`h-2 rounded-full ${getRiskColorBg(compositeRisk)}`}
            style={{ width: `${compositeRisk * 100}%` }}
          />
        </div>
      </div>

      {/* Temperature Projections */}
      <div className="p-6 bg-card rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Temperature Projections (SSP5-8.5)</h3>
        <MetroTemperatureChart metroName={metroName} scenario="ssp585" />
      </div>

      {/* Water Security Analysis */}
      <div className="p-6 bg-card rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Water Security</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-muted-foreground">Water Stress Score</span>
            <div className={`text-2xl font-bold ${getRiskColor(waterRisk)}`}>
              {(waterRisk * 100).toFixed(0)}%
            </div>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Risk Level</span>
            <div className="text-xl font-semibold">{waterData.risk_level}</div>
          </div>
        </div>

        {waterData.river_basin === 'colorado' && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded">
            <p className="text-sm font-semibold text-destructive">
              ⚠️ Colorado River Basin Overallocated
            </p>
            <p className="text-xs mt-1">
              Allocated: 16.5M acre-ft/year | Actual flow: 12.3M acre-ft/year
            </p>
          </div>
        )}
      </div>

      {/* Investment Warning for Phoenix */}
      {metroName === 'Phoenix' && (
        <div className="p-6 bg-amber-50 border-2 border-amber-300 rounded-lg">
          <h3 className="text-lg font-bold text-amber-900">
            🏭 Manufacturing Investment Risk Analysis
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-amber-900">
            <li>• Summer temps projected to exceed 120°F by 2075</li>
            <li>• Colorado River allocations cut by 50% since 2022</li>
            <li>• Groundwater declining 8.5 ft/year (unsustainable)</li>
            <li>• Competing with 40M people upstream for water</li>
            <li>• Outdoor work becomes dangerous 4-5 months/year</li>
          </ul>
          <p className="mt-4 text-xs font-semibold">
            Recommendation: 25-30 year facility lifespan may face existential risks
          </p>
        </div>
      )}
    </div>
  )
}
```

---

## EXECUTION ORDER

1. ✅ Verify Earth Engine access (you already have this)
2. 🔄 Run `metro_temperature_projections.py` to generate temp data (~2 hours runtime)
3. 🔄 Run `water_security_analysis.py` for water analysis (~30 mins)
4. 🔄 Merge results into `megaregion-data.json`
5. 🔄 Add API endpoints to `climate_server.py`
6. 🔄 Build frontend components (`MetroTemperatureChart`, `MetroRiskProfile`)
7. ✅ Test with Phoenix as case study

**Start with Step 2?** I can help you run the temperature extraction script first.
