/**
 * run_pipeline.ts
 * Main orchestrator for the Hempstead Resilience Analysis pipeline
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { generateProjectGeoJSON } from './parse_projects.js';
import { fetchAndSaveNOAAData } from './fetch_noaa_data.js';
import { fetchAndSaveFEMAData } from './fetch_fema_data.js';
import { fetchAndSaveElevationData } from './fetch_elevation_data.js';
import { computeAndSaveNeedIndex } from './compute_need_index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface PipelineStats {
  startTime: Date;
  endTime?: Date;
  duration?: number;
  steps: Array<{
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    startTime?: Date;
    endTime?: Date;
    duration?: number;
    error?: string;
  }>;
}

class ResiliencePipeline {
  private stats: PipelineStats;

  constructor() {
    this.stats = {
      startTime: new Date(),
      steps: [
        { name: 'Parse Projects', status: 'pending' },
        { name: 'Fetch NOAA Data', status: 'pending' },
        { name: 'Fetch FEMA Data', status: 'pending' },
        { name: 'Fetch Elevation Data', status: 'pending' },
        { name: 'Compute Need Index', status: 'pending' },
        { name: 'Generate Reports', status: 'pending' }
      ]
    };
  }

  private updateStepStatus(stepName: string, status: 'running' | 'completed' | 'failed', error?: string) {
    const step = this.stats.steps.find(s => s.name === stepName);
    if (!step) return;

    step.status = status;

    if (status === 'running') {
      step.startTime = new Date();
    } else if (status === 'completed' || status === 'failed') {
      step.endTime = new Date();
      if (step.startTime) {
        step.duration = step.endTime.getTime() - step.startTime.getTime();
      }
      if (error) {
        step.error = error;
      }
    }
  }

  private printProgress() {
    console.log('\n' + '='.repeat(70));
    console.log('HEMPSTEAD RESILIENCE ANALYSIS PIPELINE');
    console.log('='.repeat(70));

    this.stats.steps.forEach((step, i) => {
      const icon = step.status === 'completed' ? '✓' :
                   step.status === 'running' ? '⏳' :
                   step.status === 'failed' ? '✗' : '○';

      const duration = step.duration ? ` (${(step.duration / 1000).toFixed(1)}s)` : '';
      console.log(`${i + 1}. [${icon}] ${step.name}${duration}`);

      if (step.error) {
        console.log(`   Error: ${step.error}`);
      }
    });

    console.log('='.repeat(70) + '\n');
  }

  async run(): Promise<void> {
    console.log('\n🚀 Starting Hempstead Resilience Analysis Pipeline...\n');

    try {
      // Step 1: Parse projects
      this.updateStepStatus('Parse Projects', 'running');
      this.printProgress();
      await generateProjectGeoJSON();
      this.updateStepStatus('Parse Projects', 'completed');

      // Step 2: Fetch NOAA data
      this.updateStepStatus('Fetch NOAA Data', 'running');
      this.printProgress();
      await fetchAndSaveNOAAData();
      this.updateStepStatus('Fetch NOAA Data', 'completed');

      // Step 3: Fetch FEMA data
      this.updateStepStatus('Fetch FEMA Data', 'running');
      this.printProgress();
      await fetchAndSaveFEMAData();
      this.updateStepStatus('Fetch FEMA Data', 'completed');

      // Step 4: Fetch elevation data
      this.updateStepStatus('Fetch Elevation Data', 'running');
      this.printProgress();
      await fetchAndSaveElevationData();
      this.updateStepStatus('Fetch Elevation Data', 'completed');

      // Step 5: Compute need index
      this.updateStepStatus('Compute Need Index', 'running');
      this.printProgress();
      await computeAndSaveNeedIndex();
      this.updateStepStatus('Compute Need Index', 'completed');

      // Step 6: Generate reports
      this.updateStepStatus('Generate Reports', 'running');
      this.printProgress();
      await this.generateReports();
      this.updateStepStatus('Generate Reports', 'completed');

      // Finalize
      this.stats.endTime = new Date();
      this.stats.duration = this.stats.endTime.getTime() - this.stats.startTime.getTime();

      this.printProgress();
      this.printFinalSummary();

    } catch (error) {
      const currentStep = this.stats.steps.find(s => s.status === 'running');
      if (currentStep) {
        this.updateStepStatus(currentStep.name, 'failed', (error as Error).message);
      }

      this.printProgress();
      console.error('\n❌ Pipeline failed:', error);
      throw error;
    }
  }

  private async generateReports(): Promise<void> {
    // Load data
    const needsPath = path.join(__dirname, '../data/resilience_needs.geojson');
    const projectsPath = path.join(__dirname, '../data/resilience_projects.geojson');

    const needsData = JSON.parse(fs.readFileSync(needsPath, 'utf-8'));
    const projectsData = JSON.parse(fs.readFileSync(projectsPath, 'utf-8'));

    // Generate summary report
    const report = this.generateSummaryReport(needsData, projectsData);

    const reportPath = path.join(__dirname, '../output/analysis_summary.md');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, report);

    console.log(`✓ Generated summary report: ${reportPath}`);
  }

  private generateSummaryReport(needsData: any, projectsData: any): string {
    const needs = needsData.features;
    const projects = projectsData.features;

    // Calculate statistics
    const totalPoints = needs.length;
    const highRisk = needs.filter((f: any) => f.properties.risk_category === 'High').length;
    const mediumRisk = needs.filter((f: any) => f.properties.risk_category === 'Medium').length;
    const lowRisk = needs.filter((f: any) => f.properties.risk_category === 'Low').length;
    const withProjects = needs.filter((f: any) => f.properties.has_project).length;
    const withoutProjects = totalPoints - withProjects;

    const highRiskNoProject = needs
      .filter((f: any) => f.properties.risk_category === 'High' && !f.properties.has_project)
      .length;

    // Neighborhood analysis
    const neighborhoodProjects = projects.reduce((acc: any, f: any) => {
      const n = f.properties.neighborhood;
      acc[n] = (acc[n] || 0) + 1;
      return acc;
    }, {});

    // Get top 10 high-risk zones
    const top10HighRisk = needs
      .filter((f: any) => f.properties.risk_category === 'High' && !f.properties.has_project)
      .sort((a: any, b: any) => b.properties.need_index - a.properties.need_index)
      .slice(0, 10);

    // Generate markdown report
    const report = `# Town of Hempstead Coastal Resilience Analysis
## Summary Report

**Generated:** ${new Date().toISOString()}

---

## Executive Summary

This analysis assesses coastal resilience needs for the Town of Hempstead's South Shore communities from **Rockville Centre to Massapequa**. The analysis integrates:

- NOAA Sea Level Rise projections (+1ft to +6ft scenarios)
- FEMA flood hazard zones
- Digital elevation model (DEM) data
- Existing resilience project inventory

### Key Findings

- **${totalPoints.toLocaleString()}** total sampling points analyzed
- **${highRisk.toLocaleString()} (${((highRisk/totalPoints)*100).toFixed(1)}%)** high-risk zones identified
- **${highRiskNoProject.toLocaleString()}** high-risk zones **without existing protection**
- **${projects.length}** existing resilience projects documented

---

## Risk Distribution

| Risk Category | Count | Percentage |
|--------------|-------|------------|
| **High** | ${highRisk.toLocaleString()} | ${((highRisk/totalPoints)*100).toFixed(1)}% |
| **Medium** | ${mediumRisk.toLocaleString()} | ${((mediumRisk/totalPoints)*100).toFixed(1)}% |
| **Low** | ${lowRisk.toLocaleString()} | ${((lowRisk/totalPoints)*100).toFixed(1)}% |

### Project Coverage

- **${withProjects.toLocaleString()} (${((withProjects/totalPoints)*100).toFixed(1)}%)** points have nearby resilience projects
- **${withoutProjects.toLocaleString()} (${((withoutProjects/totalPoints)*100).toFixed(1)}%)** points lack nearby protection

---

## Existing Projects by Neighborhood

${Object.entries(neighborhoodProjects)
  .sort(([, a]: any, [, b]: any) => b - a)
  .map(([neighborhood, count]) => `- **${neighborhood}**: ${count} project(s)`)
  .join('\n')}

---

## Top 10 Unprotected High-Risk Zones

${top10HighRisk.map((f: any, i: number) => {
  const p = f.properties;
  const coords = f.geometry.coordinates;
  return `### ${i + 1}. Zone at ${p.lat?.toFixed(4) || coords[1].toFixed(4)}°N, ${Math.abs(p.lon || coords[0]).toFixed(4)}°W

- **Need Index:** ${p.need_index.toFixed(3)}
- **Elevation:** ${p.elevation_m.toFixed(2)}m (${(p.elevation_m * 3.28084).toFixed(1)}ft)
- **Projected Flood Depth:** ${p.flood_depth_m.toFixed(2)}m (${(p.flood_depth_m * 3.28084).toFixed(1)}ft)
- **Year of Concern:** ${p.year}
- **Recommended Action:** ${p.recommended_action}
`;
}).join('\n')}

---

## Recommendations by Town/Community

### High Priority Areas (Highest Risk)

Based on the analysis, the following areas show the **highest resilience needs**:

1. **Coastal Barrier Communities** (Point Lookout, Lido Beach, Long Beach)
   - Low elevation (<3m) + high SLR exposure
   - Continue dune maintenance and beach nourishment
   - Add living shorelines where feasible

2. **Back-Bay Communities** (Baldwin, Freeport, Oceanside)
   - Tidal flooding from Hempstead Bay and Middle Bay
   - Expand road elevation and drainage projects
   - Implement additional tidal check valves

3. **Western Bays Wetland Areas**
   - Critical marsh restoration needed for natural buffers
   - Thin-layer sediment deposition on degrading marshes
   - Living shoreline expansion

### Medium Priority Areas

- **Merrick, Bellmore, Wantagh:** Continue drainage upgrades and green infrastructure
- **Seaford, Massapequa:** Monitor and maintain existing drainage improvements

### Low Priority Areas

- **Inland communities** (>10m elevation)
   - Continue monitoring
   - Focus on stormwater management for water quality

---

## Methodology

### Resilience Need Index Formula

\`\`\`
NeedIndex = (0.5 × FloodDepthNorm) + (0.3 × ElevationInverse) + (0.2 × NoProjectFlag)
\`\`\`

Where:
- **FloodDepthNorm**: Normalized flood depth from NOAA SLR scenarios (0-1 scale)
- **ElevationInverse**: Inverse normalized elevation (low elevation = higher risk)
- **NoProjectFlag**: 1 if no nearby resilience project, 0 otherwise

### Risk Categories

- **High Risk:** Need Index ≥ 0.7
- **Medium Risk:** Need Index 0.4 - 0.7
- **Low Risk:** Need Index < 0.4

### Data Sources

- **NOAA Sea Level Rise Viewer:** https://coast.noaa.gov/slr/
- **FEMA NFHL:** https://hazards.fema.gov/gis/nfhl/
- **SRTM/Copernicus DEM:** Digital elevation model
- **Town of Hempstead:** Coastal Resilience Initiative documentation

---

## Next Steps

1. **Immediate Actions (2025-2026)**
   - Focus on top 10 unprotected high-risk zones
   - Design living shoreline projects for barrier communities
   - Expand road elevation in identified hotspots

2. **Short-term (2027-2030)**
   - Implement marsh restoration in degrading wetland areas
   - Add tidal check valves in medium-risk drainage systems
   - Monitor and maintain existing projects

3. **Long-term (2030+)**
   - Adaptive management based on observed sea level rise
   - Expand green infrastructure throughout study area
   - Regional coordination with Nassau County and adjacent municipalities

---

## File Outputs

- **GeoJSON Layers:**
  - \`data/resilience_projects.geojson\` - Existing projects
  - \`data/resilience_needs.geojson\` - Need assessment grid
  - \`data/inputs/noaa_slr_data.geojson\` - Sea level rise scenarios
  - \`data/inputs/fema_flood_hazard.geojson\` - Flood zones
  - \`data/inputs/elevation_dem.geojson\` - Elevation data

- **Reports:**
  - \`output/summary_table.csv\` - Top 10 high-risk zones
  - \`output/analysis_summary.md\` - This report

- **Visualization:**
  - \`data/layers/resilience_manifest.json\` - Layer manifest for climate-studio-v3

---

*Generated by Hempstead Resilience Analysis Pipeline*
`;

    return report;
  }

  private printFinalSummary(): void {
    console.log('\n' + '='.repeat(70));
    console.log('✅ PIPELINE COMPLETED SUCCESSFULLY');
    console.log('='.repeat(70));

    if (this.stats.duration) {
      console.log(`\nTotal duration: ${(this.stats.duration / 1000).toFixed(1)}s`);
    }

    console.log('\n📊 Generated Files:');
    console.log('  ├─ data/resilience_projects.geojson');
    console.log('  ├─ data/resilience_needs.geojson');
    console.log('  ├─ data/inputs/');
    console.log('  │   ├─ noaa_slr_data.geojson');
    console.log('  │   ├─ fema_flood_hazard.geojson');
    console.log('  │   └─ elevation_dem.geojson');
    console.log('  ├─ data/layers/resilience_manifest.json');
    console.log('  └─ output/');
    console.log('      ├─ summary_table.csv');
    console.log('      └─ analysis_summary.md');

    console.log('\n📍 Next Steps:');
    console.log('  1. Review the analysis summary: output/analysis_summary.md');
    console.log('  2. View top 10 high-risk zones: output/summary_table.csv');
    console.log('  3. Import layers into climate-studio-v3 using resilience_manifest.json');
    console.log('  4. Customize visualization colors and filters as needed');

    console.log('\n' + '='.repeat(70) + '\n');
  }
}

export { ResiliencePipeline };

// Run pipeline
async function main() {
  const pipeline = new ResiliencePipeline();
  await pipeline.run();
}

// Run if called directly
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch(error => {
    console.error('Pipeline error:', error);
    process.exit(1);
  });
}
