# Factory Environmental Impact Layer - Integration Guide

This guide explains how to add the factory locations and environmental impact data to your Climate Suite map.

## Files Created

1. **`apps/climate-studio/src/data/factories.json`**
   - GeoJSON data with 10 factories in Texas and Phoenix
   - Includes coordinates, company info, water usage, and environmental impact data

2. **`apps/climate-studio/src/components/panels/FactoryDetailsPanel.tsx`**
   - Modal panel component (similar to GroundwaterDetailsPanel)
   - Shows factory details and environmental impact when clicked

3. **`apps/climate-studio/src/utils/factoryLayerSetup.ts`**
   - Helper function to add factory layer to Mapbox
   - Includes click handlers and hover effects

## Factory Data Overview

### Arizona Factories (7 locations)
- **TSMC North Phoenix** - 6 semiconductor fabs, $165B investment
  - Critical water stress: 40,000 acre-feet/year
  - 30+ year drought, 65% recycling rate

- **Nestlé Glendale** - Beverage factory, $675M investment
  - High water usage in drought region

- **LG Queen Creek** - Battery manufacturing, 1,500 employees
  - Chemical waste concerns

- **Amkor Peoria** - Chip packaging
- **Procter & Gamble Coolidge** - Fabric care, 427 acres
- Others in Mesa, Chandler

### Texas Factories (3 locations)
- **Texas Instruments Sherman** - Semiconductor fab
  - Carrizo-Wilcox Aquifer: 150+ ft depletion
  - 4.8M gallons/day water usage

- **Samsung Taylor** - Advanced semiconductor fab, $17B investment
  - Same aquifer depletion issues

- **Inventec Houston** & **Lily Harris County** - Electronics manufacturing
  - Critical air pollution zone (Houston Ship Channel)
  - Environmental justice concerns
  - 1,314 lives shortened (2016 data)

## Integration Steps

### Step 1: Import Dependencies in WaterAccessView.tsx

Add these imports at the top of the file (around line 14):

```typescript
import { SelectedFactory, FactoryDetailsPanel } from './panels/FactoryDetailsPanel'
import factoriesData from '../data/factories.json'
import { setupFactoryLayer } from '../utils/factoryLayerSetup'
```

### Step 2: Add State Variables

Add factory state alongside the aquifer state (around line 530):

```typescript
const [selectedFactory, setSelectedFactory] = useState<SelectedFactory | null>(null)
const [selectedFactoryId, setSelectedFactoryId] = useState<string | null>(null)
```

### Step 3: Add Factory Layer to Map

Inside the `map.on('load', ...)` callback (after aquifer setup, around line 2200), add:

```typescript
// Add factory layer
setupFactoryLayer(
  map,
  factoriesData,
  (factoryProperties) => {
    setSelectedFactory({
      name: factoryProperties.name,
      company: factoryProperties.company,
      city: factoryProperties.city,
      state: factoryProperties.state,
      type: factoryProperties.type,
      investment: factoryProperties.investment,
      employees: factoryProperties.employees,
      yearEstablished: factoryProperties.yearEstablished,
      facilities: factoryProperties.facilities,
      waterUsage: factoryProperties.waterUsage,
      environmental: factoryProperties.environmental
    })
  }
)
```

### Step 4: Add Factory Details Panel to Render

Add the panel component in the return statement (around line 3946, after the GroundwaterDetailsPanel):

```typescript
{/* Factory Details Panel - Bottom Right */}
{selectedFactory && (
  <div className="absolute bottom-4 right-4 z-[1000] pointer-events-auto" style={{ width: '640px' }}>
    <FactoryDetailsPanel
      selectedFactory={selectedFactory}
      onClose={() => setSelectedFactory(null)}
    />
  </div>
)}
```

## Visual Design

### Map Layer Colors (by severity)
- 🔴 **Critical** (#ef4444) - TSMC Phoenix, TI Sherman, Houston facilities
- 🟠 **Stressed** (#f97316) - Nestlé, LG, Amkor, P&G
- 🔵 **Moderate** (#3b82f6) - T1 Energy solar
- 🟢 **Stable** (#22c55e) - None currently

### Panel Layout
- **Left Column**: Facility information (company, investment, employees, facilities)
- **Right Column**: Environmental impact (water usage, pollution, health impacts)
- **Status Badge**: Color-coded severity indicator at top
- **Close Button**: X in top-right corner

## Environmental Impact Categories

### Water Stress
- **Daily water usage** (in millions of gallons)
- **Recycling rate** (percentage)
- **Aquifer depletion** (feet lost)
- **Drought duration** (years)

### Air Pollution
- **Pollutants**: PM2.5, PM10, VOCs, Sulfate, Ozone
- **Health impacts**: Lives shortened, asthma, cardiac risks
- **Air quality ranking**: National comparison

### Environmental Justice
- Facilities disproportionately affecting Black/brown communities
- Houston Ship Channel petrochemical complex impacts

## Customization Options

### Adjust Factory Point Size
Edit the `circle-radius` in `factoryLayerSetup.ts`:

```typescript
'circle-radius': [
  'interpolate',
  ['linear'],
  ['zoom'],
  5, 4,    // At zoom 5, radius 4
  10, 8,   // At zoom 10, radius 8
  15, 12   // At zoom 15, radius 12
]
```

### Change Panel Position
Modify the position in Step 4:
- `bottom-4 right-4` - Bottom right
- `bottom-4 left-4` - Bottom left
- `bottom-4 left-1/2 -translate-x-1/2` - Bottom center (like aquifer panel)

### Add/Remove Factories
Edit `factories.json` to add more locations. Required fields:
- `geometry.coordinates`: [longitude, latitude]
- `properties.id`: Unique identifier
- `properties.name`: Display name
- `properties.environmental.severity`: 'critical' | 'stressed' | 'moderate' | 'stable'

## Testing

After integration:

1. **Load the map** - factories should appear as colored circles
2. **Hover over a factory** - cursor changes to pointer, circle grows slightly
3. **Click a factory** - bottom panel appears with details
4. **Click X button** - panel closes
5. **Click another factory** - panel updates with new factory data
6. **Zoom in/out** - factory circles scale appropriately

## Data Sources

All factory and environmental data compiled from:
- Fortune, World Economic Forum, American Bar Association (TSMC water usage)
- NRDC, Environment America (Houston air quality, Texas environmental impact)
- Axios, Rise48 Equity (Phoenix pollution, manufacturing growth)
- Dallas News, Houston.org, Budwig Team (factory announcements)

## Next Steps

### Potential Enhancements
1. **Toggle layer on/off** - Add checkbox in sidebar
2. **Filter by severity** - Show only critical/stressed facilities
3. **Filter by type** - Show only semiconductor/battery/etc.
4. **Compare with aquifer data** - Overlay factory water usage on aquifer depletion
5. **Add more locations** - Expand to other states
6. **Historical timeline** - Show factory construction over time
7. **Emissions data** - Add CO2/GHG emissions metrics

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify all imports are correct
3. Ensure factories.json is in the correct path
4. Confirm Mapbox token is valid
5. Check that lucide-react icons are installed

## Contact

Created by Claude for Climate Suite project integration.
