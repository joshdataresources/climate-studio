# Quick Reference: Rivers to Metro Cities

## 🎯 Goal
Show rivers that connect to metro cities in the Metro Statistics Climate layer. Focus on rivers that can limit water access upstream and impact urban prosperity (significant connecting rivers, not major or feeder).

## 📊 Current Status
- **50 metro cities** total
- **19 connected** (38%) - already in rivers.json
- **31 need connections** (62%) - priority for this feature

## 🔍 River Classification

| Tier | Flow (CFS) | Examples | Action |
|------|------------|----------|--------|
| **Major** | >10,000 | Colorado, Mississippi | ✅ Already documented |
| **Significant** | 500-10,000 | Catawba, Salt, Boise | 🎯 **Target for this feature** |
| **Feeder** | <500 | Small tributaries | ❌ Exclude |

## 📁 Key Files

### Planning
- `PLAN_RIVERS_TO_METROS.md` - Full implementation plan
- `RIVERS_TO_METROS_EXAMPLES.md` - Examples & data structures
- `IMPLEMENTATION_SUMMARY.md` - Complete guide

### Data
- `metro-connecting-rivers.json` - Starter dataset (5 rivers)
- `river-metro-curation-template.json` - Template for research
- `river-metro-summary.json` - Analysis results

### Code
- `scripts/match-rivers-to-metros.js` - Analysis tool
- `src/utils/riverMetroConnections.ts` - Utility functions

## 🚀 Quick Start

### 1. Run Analysis
```bash
node scripts/match-rivers-to-metros.js
```

### 2. Review Template
Open `river-metro-curation-template.json` to see unconnected metros

### 3. Research & Add Rivers
Add to `metro-connecting-rivers.json` using this structure:
```json
{
  "name": "River Name",
  "baseline_flow_cfs_2025": 4000,
  "metro_cities": [{
    "name": "City Name",
    "dependency_percent": 40,
    "connection_type": "primary_source",
    "water_access_risk": "high",
    "urban_prosperity_impact": "critical"
  }],
  "flow_projections": { "2025": 4000, "2050": 3200, ... }
}
```

### 4. Integrate
Use `riverMetroConnections.ts` utilities in `MegaregionLayer.tsx`

## 🎨 Visualization

### Colors (Flow Depletion)
- 🟢 Green: ≥95% baseline (Stable)
- 🔵 Blue: 80-95% (Moderate)
- 🟠 Orange: 60-80% (Significant)
- 🔴 Red: <60% (Severe)

### Connection Types
- **Primary Source**: Bold solid (3px) - >50% dependency
- **Significant Supply**: Dashed (2px) - 20-50% dependency
- **Upstream Limiting**: Dotted (1px) - Affects water access

## 📋 Top 10 Priority Metros

1. **Chicago** (9.5M) - Great Lakes (may use lake water)
2. **Houston** (7.2M) - Texas
3. **Miami** (6.2M) - Florida
4. **Boston** (4.9M) - Northeast
5. **San Francisco** (4.7M) - Northern California
6. **Detroit** (4.3M) - Great Lakes
7. **Seattle** (4.0M) - Northwest
8. **Tampa** (3.2M) - Florida
9. **Charlotte** (2.7M) - Southeast (Catawba - in template!)
10. **Orlando** (2.7M) - Florida

## ✅ Criteria for Inclusion

### Include River If:
- ✅ Flow: 500-10,000 CFS
- ✅ Supplies 1-3 metro cities
- ✅ Dependency: >20% for at least one city
- ✅ Upstream of city (water source)
- ✅ Can limit water access if depleted

### Exclude River If:
- ❌ Major river (>10k CFS) - already documented
- ❌ Feeder river (<500 CFS) - too small
- ❌ Downstream only - doesn't supply city
- ❌ <20% dependency - not significant

## 🔗 Integration Points

1. **MegaregionLayer.tsx** - Add river visualization
2. **climateLayers.ts** - Add layer controls
3. **WaterAccessView.tsx** - Optionally show metro connections

## 📚 Research Sources

- USGS Water Data: https://waterdata.usgs.gov/
- EPA Watershed Data: https://www.epa.gov/waterdata
- City Water Department Reports
- State Water Supply Plans

## 💡 Tips

1. Start with 5-10 well-researched metros
2. Focus on high-population, water-stressed cities
3. Cross-reference multiple sources
4. Test visualization with real data
5. Iterate and refine
