#!/usr/bin/env python3
"""
Create Linear project structure for Climate Migration Analysis
Bulk creates epics and issues from the implementation plan
"""

import requests
import json
import os
from dotenv import load_dotenv

# Load API key
load_dotenv('.env.linear')
API_KEY = os.getenv('LINEAR_API_KEY')

if not API_KEY:
    print("❌ LINEAR_API_KEY not found. Please set it in .env.linear")
    exit(1)

GRAPHQL_ENDPOINT = 'https://api.linear.app/graphql'

headers = {
    'Authorization': API_KEY,
    'Content-Type': 'application/json'
}

def graphql_query(query, variables=None):
    """Execute GraphQL query against Linear API"""
    response = requests.post(
        GRAPHQL_ENDPOINT,
        headers=headers,
        json={'query': query, 'variables': variables or {}}
    )

    if response.status_code != 200:
        print(f"❌ API Error: {response.status_code}")
        print(response.text)
        return None

    data = response.json()
    if 'errors' in data:
        print(f"❌ GraphQL Error: {data['errors']}")
        return None

    return data.get('data')

# Step 1: Get your team ID
def get_team_id():
    query = '''
        query {
            teams {
                nodes {
                    id
                    name
                    key
                }
            }
        }
    '''
    data = graphql_query(query)
    if not data:
        return None

    teams = data['teams']['nodes']
    print(f"\n📋 Available teams:")
    for i, team in enumerate(teams):
        print(f"  {i+1}. {team['name']} (key: {team['key']})")

    if len(teams) == 1:
        return teams[0]['id']

    choice = input(f"\nSelect team (1-{len(teams)}): ")
    return teams[int(choice)-1]['id']

# Step 2: Create project
def create_project(team_id, name, description):
    query = '''
        mutation ProjectCreate($input: ProjectCreateInput!) {
            projectCreate(input: $input) {
                project {
                    id
                    name
                    url
                }
            }
        }
    '''
    variables = {
        'input': {
            'teamIds': [team_id],
            'name': name,
            'description': description,
            'state': 'planned'
        }
    }

    data = graphql_query(query, variables)
    if data:
        return data['projectCreate']['project']
    return None

# Step 3: Create epic (using Project instead)
def create_issue(team_id, title, description, priority=2, estimate=None, project_id=None, labels=None):
    """Create an issue in Linear"""
    query = '''
        mutation IssueCreate($input: IssueCreateInput!) {
            issueCreate(input: $input) {
                issue {
                    id
                    identifier
                    title
                    url
                }
            }
        }
    '''

    issue_input = {
        'teamId': team_id,
        'title': title,
        'description': description,
        'priority': priority,
    }

    if estimate:
        issue_input['estimate'] = estimate

    if project_id:
        issue_input['projectId'] = project_id

    if labels:
        issue_input['labelIds'] = labels

    variables = {'input': issue_input}

    data = graphql_query(query, variables)
    if data:
        return data['issueCreate']['issue']
    return None

# Step 4: Create label
def create_label(team_id, name, color):
    """Create a label for categorization"""
    query = '''
        mutation IssueLabelCreate($input: IssueLabelCreateInput!) {
            issueLabelCreate(input: $input) {
                issueLabel {
                    id
                    name
                }
            }
        }
    '''
    variables = {
        'input': {
            'teamId': team_id,
            'name': name,
            'color': color
        }
    }

    data = graphql_query(query, variables)
    if data:
        return data['issueLabelCreate']['issueLabel']
    return None

# Define all epics and issues
EPICS = {
    'epic1': {
        'name': 'Epic 1: Metro Temperature Projections',
        'description': 'Add 100-year temperature projections for all US metro areas using NASA NEX-GDDP-CMIP6 data.',
        'color': 'red',
        'issues': [
            {
                'title': 'Set Up Temperature Data Pipeline',
                'description': '''Create Python service to extract NASA NEX-GDDP-CMIP6 temperature data from Google Earth Engine for all metros.

**Acceptance Criteria:**
- [ ] Service authenticates with Earth Engine
- [ ] Multi-model ensemble averaging (ACCESS-CM2, CMCC-ESM2, MIROC6, MRI-ESM2-0)
- [ ] Extracts data for both SSP2-4.5 and SSP5-8.5 scenarios
- [ ] Decadal averages: 2025, 2035, 2045, 2055, 2065, 2075, 2085, 2095
- [ ] Calculates baseline (1995-2014) for comparison
- [ ] Outputs JSON with structure: metro_name → scenario → decade → {summer_max, winter_min, annual_avg}

**Files:**
- `qgis-processing/services/metro_temperature_projections.py`
- Output: `qgis-processing/metro_temperature_projections.json`''',
                'priority': 1,  # Urgent
                'estimate': 3
            },
            {
                'title': 'Run Temperature Extraction for All Metros',
                'description': '''Execute the temperature extraction script for all ~50 metros in the dataset.

**Acceptance Criteria:**
- [ ] Script runs successfully for all metros
- [ ] No metros missing data
- [ ] Output file size reasonable (~500KB - 2MB)
- [ ] Spot-check 5 random metros for data quality

**Technical Notes:**
- Run overnight due to Earth Engine API rate limits
- Log any metros with missing model data''',
                'priority': 1,
                'estimate': 1
            },
            {
                'title': 'Add Temperature API Endpoint',
                'description': '''Create Flask API endpoint to serve temperature projection data.

**Acceptance Criteria:**
- [ ] Endpoint: GET /api/climate/metro-temperature/<metro_name>
- [ ] Query params: ?scenario=ssp245|ssp585 (optional)
- [ ] Returns baseline + projections
- [ ] Handles 404 for unknown metros
- [ ] Response time < 50ms

**Files:**
- `qgis-processing/climate_server.py`''',
                'priority': 1,
                'estimate': 2
            },
            {
                'title': 'Build Temperature Chart Component',
                'description': '''Create React component to visualize temperature projections as line chart.

**Acceptance Criteria:**
- [ ] Line chart shows temperature trend 2025-2095
- [ ] Baseline displayed as dashed reference line
- [ ] Toggle between SSP2-4.5 and SSP5-8.5
- [ ] Shows temperature increase delta
- [ ] Warning indicators when temps exceed thresholds
- [ ] Responsive design

**Files:**
- `apps/climate-studio/src/components/MetroTemperatureChart.tsx`''',
                'priority': 2,
                'estimate': 3
            },
            {
                'title': 'Integrate Temperature Data into Metro Detail View',
                'description': '''Add temperature projections to metro popup/detail view.

**Acceptance Criteria:**
- [ ] Click metro circle → show temperature chart
- [ ] Display key metrics: baseline, 2050, 2095 temps
- [ ] Link to full analysis view''',
                'priority': 2,
                'estimate': 2
            }
        ]
    },
    'epic2': {
        'name': 'Epic 2: Water Security Analysis',
        'description': 'Analyze water availability, groundwater depletion, and upstream/downstream conflicts for all US metros.',
        'color': 'blue',
        'issues': [
            {
                'title': 'Research and Map Water Sources',
                'description': '''Identify primary water sources (rivers, aquifers) for each US metro area.

**Deliverables:**
- [ ] Spreadsheet: metro_name | primary_river | usgs_gage_id | primary_aquifer | river_basin
- [ ] Document major river basin compacts and conflicts
- [ ] List depleting aquifers from GRACE data

**Focus Areas:**
- Colorado River Basin (Phoenix, Las Vegas, LA)
- Ogallala Aquifer (Denver, Dallas)
- California Central Valley
- Mississippi/Missouri basins

**Output:** docs/WATER_SOURCES_BY_METRO.csv''',
                'priority': 1,
                'estimate': 5
            },
            {
                'title': 'Build USGS Stream Gage Finder Service',
                'description': '''Create service to find nearest USGS stream gage for each metro.

**Acceptance Criteria:**
- [ ] Function: find_usgs_gage_for_metro(lat, lon, radius_km=50)
- [ ] Returns gage ID, name, coordinates
- [ ] Handles metros with no nearby gages
- [ ] Validates gage has recent data

**Files:**
- `qgis-processing/services/usgs_gage_finder.py`''',
                'priority': 1,
                'estimate': 3
            },
            {
                'title': 'Implement River Network Analysis (NLDI)',
                'description': '''Use USGS NLDI API to trace upstream/downstream relationships.

**Acceptance Criteria:**
- [ ] Function: get_upstream_network(usgs_gage_id, distance_km=500)
- [ ] Returns upstream tributaries, gages, basin boundary
- [ ] Function: get_downstream_network(usgs_gage_id, distance_km=200)
- [ ] Identifies all metros on same river system
- [ ] Calculates dependency graph

**Files:**
- `qgis-processing/services/river_network_analyzer.py`''',
                'priority': 1,
                'estimate': 5
            },
            {
                'title': 'Integrate GRACE Groundwater Depletion Data',
                'description': '''Add GRACE/GRACE-FO satellite groundwater trends for major US aquifers.

**Acceptance Criteria:**
- [ ] Pull GRACE data from Earth Engine
- [ ] Calculate linear trend (depletion rate) 2003-2024
- [ ] Map metros to affected aquifers
- [ ] Classify depletion severity

**Aquifers:** Ogallala, Central Valley, Central Arizona, Mississippi Embayment

**Files:**
- `qgis-processing/services/groundwater_analysis.py`''',
                'priority': 2,
                'estimate': 5
            },
            {
                'title': 'Calculate Water Stress Scores',
                'description': '''Develop composite water stress metric (0-1 scale).

**Acceptance Criteria:**
- [ ] Algorithm considers: upstream competition, basin over-allocation, groundwater depletion, legal conflicts
- [ ] Score calculation is transparent
- [ ] Output: metro_name | water_stress_score | risk_level

**Files:**
- `qgis-processing/services/water_stress_calculator.py`''',
                'priority': 1,
                'estimate': 3
            },
            {
                'title': 'Create Water Security API Endpoint',
                'description': '''Flask endpoint serving water security analysis.

**Acceptance Criteria:**
- [ ] Endpoint: GET /api/climate/metro-water-security/<metro_name>
- [ ] Returns: stress score, risk level, sources, upstream metros, conflicts
- [ ] Response time < 100ms

**Files:**
- `qgis-processing/climate_server.py`''',
                'priority': 1,
                'estimate': 2
            },
            {
                'title': 'Build Water Security Dashboard Component',
                'description': '''React component visualizing water security metrics.

**Acceptance Criteria:**
- [ ] Water stress score gauge (0-100%)
- [ ] List of water sources with status
- [ ] River network diagram showing dependencies
- [ ] Groundwater depletion trend chart
- [ ] Warning callouts for critical conflicts

**Files:**
- `apps/climate-studio/src/components/WaterSecurityDashboard.tsx`''',
                'priority': 2,
                'estimate': 5
            }
        ]
    },
    'epic3': {
        'name': 'Epic 3: Combined Risk Analysis Dashboard',
        'description': 'Integrate temperature and water data into unified metro risk assessment.',
        'color': 'orange',
        'issues': [
            {
                'title': 'Design Composite Risk Score Algorithm',
                'description': '''Create weighted risk score combining temperature increase and water stress.

**Acceptance Criteria:**
- [ ] Algorithm: composite_risk = (temp_risk * 0.4) + (water_stress * 0.4) + (population * 0.2)
- [ ] Document methodology and assumptions
- [ ] Validate against known high-risk metros

**Files:**
- `qgis-processing/services/composite_risk_calculator.py`''',
                'priority': 2,
                'estimate': 3
            },
            {
                'title': 'Build Metro Risk Profile Component',
                'description': '''Comprehensive metro analysis view combining all risk factors.

**Acceptance Criteria:**
- [ ] Overall risk gauge/score
- [ ] Temperature projection chart
- [ ] Water security section
- [ ] Population growth trend
- [ ] Investment risk assessment (manufacturing/long-term assets)
- [ ] Phoenix gets "Manufacturing Investment Warning"

**Files:**
- `apps/climate-studio/src/components/MetroRiskProfile.tsx`''',
                'priority': 2,
                'estimate': 5
            },
            {
                'title': 'Add Risk Scoring to Map Visualization',
                'description': '''Update metro circle colors to reflect composite risk score.

**Acceptance Criteria:**
- [ ] Circle fill color based on risk: Green → Yellow → Orange → Red
- [ ] Toggle between "Population Growth" and "Climate Risk" modes
- [ ] Update legend accordingly

**Files:**
- Update DeckGLMap.tsx megaregion layer logic''',
                'priority': 2,
                'estimate': 3
            },
            {
                'title': 'Create Risk Comparison Tool',
                'description': '''Side-by-side comparison view for evaluating multiple metros.

**Acceptance Criteria:**
- [ ] Select 2-4 metros for comparison
- [ ] Show all metrics in table format
- [ ] Radar chart comparing risk dimensions
- [ ] Export comparison as PDF/image

**Use Case:** Company deciding between Phoenix vs Atlanta for factory

**Files:**
- `apps/climate-studio/src/components/MetroComparison.tsx`''',
                'priority': 3,
                'estimate': 5
            }
        ]
    },
    'epic4': {
        'name': 'Epic 4: Data Quality & Documentation',
        'description': 'Ensure data accuracy and provide methodology transparency.',
        'color': 'green',
        'issues': [
            {
                'title': 'Validate Temperature Projections Against NOAA',
                'description': '''Spot-check temperature projections against NOAA Climate Explorer data.

**Acceptance Criteria:**
- [ ] Compare 10 random metros
- [ ] Differences < 5°F (models vary)
- [ ] Document any major discrepancies
- [ ] Add data source citations to UI''',
                'priority': 2,
                'estimate': 3
            },
            {
                'title': 'Document Data Sources and Methodology',
                'description': '''Create comprehensive methodology document.

**Deliverables:**
- [ ] docs/DATA_SOURCES.md: All datasets, APIs, citations
- [ ] docs/METHODOLOGY.md: Algorithm explanations, assumptions
- [ ] docs/LIMITATIONS.md: Known issues, uncertainty ranges

**Include:** IPCC scenario definitions, model selection rationale''',
                'priority': 2,
                'estimate': 3
            },
            {
                'title': 'Add Data Freshness Indicators',
                'description': '''Show when data was last updated in the UI.

**Acceptance Criteria:**
- [ ] "Data as of: [date]" displayed on views
- [ ] Tooltip explaining update frequency
- [ ] Warning if data > 6 months old''',
                'priority': 3,
                'estimate': 2
            }
        ]
    }
}

def main():
    print("🚀 Setting up Linear project: Climate Migration Analysis\n")

    # Get team ID
    team_id = get_team_id()
    if not team_id:
        print("❌ Failed to get team ID")
        return

    print(f"✅ Using team ID: {team_id}\n")

    # Create project
    print("📦 Creating project...")
    project = create_project(
        team_id,
        "Climate Migration Analysis",
        "Add temperature projections and water security analysis to visualize 100-year climate migration patterns across US metro areas."
    )

    if not project:
        print("❌ Failed to create project")
        return

    print(f"✅ Project created: {project['name']}")
    print(f"   URL: {project['url']}\n")

    project_id = project['id']

    # Create epic labels
    print("🏷️  Creating epic labels...")
    epic_labels = {}
    for epic_key, epic_data in EPICS.items():
        label = create_label(team_id, epic_data['name'], epic_data['color'])
        if label:
            epic_labels[epic_key] = label['id']
            print(f"   ✅ {epic_data['name']}")

    print()

    # Create all issues
    print("📝 Creating issues...")
    total_issues = sum(len(epic['issues']) for epic in EPICS.values())
    created = 0

    for epic_key, epic_data in EPICS.items():
        epic_label = epic_labels.get(epic_key)

        for issue_data in epic_data['issues']:
            issue = create_issue(
                team_id=team_id,
                title=issue_data['title'],
                description=issue_data['description'],
                priority=issue_data['priority'],
                estimate=issue_data.get('estimate'),
                project_id=project_id,
                labels=[epic_label] if epic_label else None
            )

            if issue:
                created += 1
                print(f"   ✅ [{created}/{total_issues}] {issue['identifier']}: {issue['title']}")
            else:
                print(f"   ❌ Failed to create: {issue_data['title']}")

    print(f"\n🎉 Done! Created {created}/{total_issues} issues")
    print(f"   View project: {project['url']}")

if __name__ == '__main__':
    main()
