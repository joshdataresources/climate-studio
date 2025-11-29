# Manual Testing Checklist for DeckGL Layers

## Test Date: 2025-11-24
## Application URL: http://localhost:8082/

---

## Pre-Test Setup

1. [ ] Open http://localhost:8082/ in browser
2. [ ] Open DevTools Console (Cmd+Option+J)
3. [ ] Open DevTools Network tab
4. [ ] Clear Console and Network history
5. [ ] Locate Layer Panel on the left side of the screen

---

## Layer 1: Sea Level Rise 🌊

### Expected Behavior:
- Tile-based raster layer showing coastal flooding
- Blue colored water overlay
- URL pattern: `/api/tiles/noaa-slr/{feet}/{z}/{x}/{y}.png`

### Test Steps:
1. [ ] **Find layer in panel:** Look for "Sea Level Rise"
2. [ ] **Toggle ON:** Click to enable layer
3. [ ] **Visual check:** Blue flooding areas appear on coast
4. [ ] **Opacity slider:** Should appear below layer toggle
5. [ ] **Test slider at 10%:** Layer barely visible
6. [ ] **Test slider at 50%:** Layer moderately visible
7. [ ] **Test slider at 100%:** Layer fully opaque
8. [ ] **Console check:** No errors
9. [ ] **Network check:** Multiple tile PNG requests visible

### Results:
- Status: [ ] Working [ ] Broken [ ] Stuck
- Opacity slider: [ ] Works [ ] Doesn't work [ ] Partially works
- Visual rendering: [ ] Good [ ] Dim [ ] Invisible
- Notes: _______________________________________________

---

## Layer 2: Topographic Relief 🏔️

### Expected Behavior:
- Hillshade terrain visualization
- Gray/brown colored terrain shadows
- Should be enabled by default (defaultActive: true)
- URL pattern: Earth Engine tile URL

### Test Steps:
1. [ ] **Check if already enabled:** Should be ON by default
2. [ ] **Visual check:** 3D-looking terrain shadows visible
3. [ ] **Toggle OFF then ON:** Verify it can be controlled
4. [ ] **Opacity slider:** Should appear in controls
5. [ ] **Test slider at 10%:** Very faint shadows
6. [ ] **Test slider at 50%:** Moderate shadows
7. [ ] **Test slider at 100%:** Strong shadows
8. [ ] **Relief Style dropdown:** Try different styles (classic, dark, depth, dramatic)
9. [ ] **Console check:** No errors
10. [ ] **Network check:** Earth Engine tile requests

### Results:
- Status: [ ] Working [ ] Broken [ ] Stuck
- Opacity slider: [ ] Works [ ] Doesn't work [ ] Partially works
- Visual rendering: [ ] Good [ ] Dim [ ] Invisible
- Relief styles: [ ] All work [ ] Some work [ ] None work
- Notes: _______________________________________________

---

## Layer 3: Temperature Projection 🌡️

### Expected Behavior:
- Raster layer showing temperature anomalies
- Orange/red colored heat overlay
- URL pattern: Earth Engine tile URL

### Test Steps:
1. [ ] **Find layer:** "Future Temperature Anomaly"
2. [ ] **Toggle ON:** Enable layer
3. [ ] **Visual check:** Orange/red heat overlay appears
4. [ ] **Opacity slider:** Should appear
5. [ ] **Test slider at 10%:** Barely visible heat
6. [ ] **Test slider at 50%:** Moderate heat overlay
7. [ ] **Test slider at 100%:** Strong heat overlay
8. [ ] **Temperature Mode toggle:** Try "Anomaly" vs "Actual"
9. [ ] **Year slider:** Change projection year (2025-2100)
10. [ ] **Console check:** No errors
11. [ ] **Network check:** New tiles load when year changes

### Results:
- Status: [ ] Working [ ] Broken [ ] Stuck
- Opacity slider: [ ] Works [ ] Doesn't work [ ] Partially works
- Visual rendering: [ ] Good [ ] Dim [ ] Invisible
- Year changes: [ ] Update layer [ ] Don't update [ ] Partially update
- Notes: _______________________________________________

---

## Layer 4: Precipitation & Drought 💧

### Expected Behavior:
- Raster layer showing precipitation/drought data
- Blue colored precipitation overlay
- URL pattern: Earth Engine tile URL

### Test Steps:
1. [ ] **Find layer:** "Precipitation & Drought"
2. [ ] **Toggle ON:** Enable layer
3. [ ] **Visual check:** Blue precipitation overlay appears
4. [ ] **Opacity slider:** Should appear
5. [ ] **Test slider at 10%:** Faint overlay
6. [ ] **Test slider at 50%:** Moderate overlay
7. [ ] **Test slider at 100%:** Strong overlay
8. [ ] **Drought Metric dropdown:** Try all options (precipitation, drought_index, soil_moisture)
9. [ ] **Year slider:** Change projection year
10. [ ] **Console check:** No errors
11. [ ] **Network check:** Tiles load, updates on metric change

### Results:
- Status: [ ] Working [ ] Broken [ ] Stuck
- Opacity slider: [ ] Works [ ] Doesn't work [ ] Partially works
- Visual rendering: [ ] Good [ ] Dim [ ] Invisible
- Metric changes: [ ] Update layer [ ] Don't update [ ] Partially update
- Notes: _______________________________________________

---

## Layer 5: Urban Heat Island 🔥

### Expected Behavior:
- Raster layer showing urban heat island intensity
- Yellow/orange colored heat in urban areas
- URL pattern: Earth Engine tile URL

### Test Steps:
1. [ ] **Find layer:** "Urban Heat Island"
2. [ ] **Toggle ON:** Enable layer
3. [ ] **Visual check:** Yellow/orange heat in cities appears
4. [ ] **Opacity slider:** Should appear
5. [ ] **Test slider at 10%:** Faint city heat
6. [ ] **Test slider at 50%:** Moderate city heat
7. [ ] **Test slider at 100%:** Strong city heat
8. [ ] **Season dropdown:** Try "Summer" vs "Winter"
9. [ ] **Color Scheme dropdown:** Try all 3 options
10. [ ] **Console check:** No errors
11. [ ] **Network check:** Tiles load, updates on season/color change

### Results:
- Status: [ ] Working [ ] Broken [ ] Stuck
- Opacity slider: [ ] Works [ ] Doesn't work [ ] Partially works
- Visual rendering: [ ] Good [ ] Dim [ ] Invisible
- Season/color changes: [ ] Update layer [ ] Don't update [ ] Partially update
- Notes: _______________________________________________

---

## Layer 6: Urban Expansion 🏙️

### Expected Behavior:
- GeoJSON polygons (circles) showing urban growth
- Orange colored circles around cities
- Circles grow larger as you move year slider forward
- **KNOWN BUG:** Double opacity (layer + fill alpha) makes it very dim

### Test Steps:
1. [ ] **Find layer:** "Conceptual Urban Growth"
2. [ ] **Toggle ON:** Enable layer
3. [ ] **Visual check:** Orange circles around cities
   - ⚠️ **Expected issue:** May be nearly invisible due to double opacity bug
4. [ ] **Opacity slider:** Should appear
5. [ ] **Test slider at 10%:** Almost invisible (if bug present)
6. [ ] **Test slider at 50%:** Faint orange circles
7. [ ] **Test slider at 100%:** More visible but still dim (if bug present)
8. [ ] **Year slider:** Move from 2025 to 2100
   - Circles should grow larger
9. [ ] **Console check:** No errors
10. [ ] **Network check:** Single GeoJSON request (not tiles)

### Results:
- Status: [ ] Working [ ] Broken [ ] Stuck [ ] VERY DIM (bug confirmed)
- Opacity slider: [ ] Works [ ] Doesn't work [ ] Partially works [ ] Works but too dim
- Visual rendering: [ ] Good [ ] Dim [ ] Invisible [ ] Nearly invisible
- Year changes: [ ] Circles grow [ ] No change [ ] Partially work
- **Bug confirmed?** [ ] Yes - circles are nearly invisible [ ] No - circles are visible
- Notes: _______________________________________________

---

## Layer 7: Population Migration 🚶

### Expected Behavior:
- GeoJSON circles showing population centers
- Colors indicate growth (cool colors) or decline (warm colors)
- Purple/blue = growth, red/yellow = decline
- Circles size proportional to population
- Default opacity: 70% (higher than other layers)
- **KNOWN BUG:** Double opacity (layer + color alpha) makes it ~30% instead of 70%

### Test Steps:
1. [ ] **Find layer:** "Population Migration"
2. [ ] **Toggle ON:** Enable layer
3. [ ] **Visual check:** Colored circles appear at metro areas
   - ⚠️ **Expected issue:** May be dimmer than expected (should be 70%, might look like 30%)
4. [ ] **Opacity slider:** Should appear
5. [ ] **Test slider at 10%:** Faint circles
6. [ ] **Test slider at 50%:** Moderate circles
7. [ ] **Test slider at 100%:** Strong circles (but may still look ~40% due to bug)
8. [ ] **Year slider:** Move from 2025 to 2095
   - Circle sizes should change
   - Colors should change based on growth
9. [ ] **Look for color variety:**
   - [ ] Blue/purple circles (growing cities)
   - [ ] Red/yellow circles (declining cities)
10. [ ] **Console check:** No errors
11. [ ] **Network check:** No requests (local data)

### Results:
- Status: [ ] Working [ ] Broken [ ] Stuck [ ] Dimmer than expected
- Opacity slider: [ ] Works [ ] Doesn't work [ ] Partially works [ ] Works but dimmer
- Visual rendering: [ ] Good [ ] Dim [ ] Invisible [ ] Less opaque than expected
- Year changes: [ ] Circles change [ ] No change [ ] Partially work
- Color variety: [ ] See both growth and decline colors [ ] Only one color [ ] No colors
- **Bug confirmed?** [ ] Yes - layer is dimmer than 70% [ ] No - layer looks correct
- Notes: _______________________________________________

---

## Overall System Checks

### Layer Panel UI:
- [ ] All 7 layers appear in panel
- [ ] Each layer has a toggle button
- [ ] Toggles respond to clicks
- [ ] Active layers show opacity slider
- [ ] Opacity percentages display correctly
- [ ] Sliders move smoothly

### Map Performance:
- [ ] Map pans smoothly
- [ ] Map zooms smoothly
- [ ] No lag when toggling layers
- [ ] No lag when adjusting opacity

### Console Errors:
```
Record any errors here:




```

### Network Requests:
```
Tile layers making requests? [ ] Yes [ ] No
GeoJSON layers making requests? [ ] Yes [ ] No
Any 404 errors? [ ] Yes [ ] No
Any 500 errors? [ ] Yes [ ] No

Request URLs observed:




```

---

## Identified Issues Summary

### Issue #1: Double Opacity in Urban Expansion
- **Found?** [ ] Yes [ ] No
- **Severity:** If found, this is CRITICAL
- **Symptoms:** Orange circles nearly invisible, opacity slider has minimal effect
- **Fix needed:** Remove alpha channel from fill color (line 232 in DeckGLMap.tsx)

### Issue #2: Double Opacity in Megaregion
- **Found?** [ ] Yes [ ] No
- **Severity:** If found, this is MEDIUM
- **Symptoms:** Circles dimmer than expected (30% instead of 70%)
- **Fix needed:** Remove alpha channel from color array (lines 254-271 in DeckGLMap.tsx)

### Issue #3: Fallback Opacity Mismatch
- **Found?** [ ] Yes [ ] No
- **Severity:** If found, this is MEDIUM
- **Symptoms:** All layers appear dim on first load, then brighten after moving slider
- **Fix needed:** Change fallback values from 0.1 to 0.3 (lines 116, 145, 174, 203, 366)

### Other Issues Found:
```
List any unexpected issues:




```

---

## Recommendations

Based on test results, recommend:

1. [ ] Apply all 3 code fixes immediately
2. [ ] Apply only critical fixes (Urban Expansion)
3. [ ] No fixes needed - everything works
4. [ ] Further investigation required

### Priority Fixes:
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

### Notes for Developer:
```




```

---

## Test Completed By: __________________
## Date: __________________
## Time Spent: __________ minutes
