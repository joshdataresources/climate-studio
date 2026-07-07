#!/usr/bin/env python3
"""
Build apps/climate-studio/src/data/metro-aquifers.json — the metro↔aquifer
join used by the resilience water score and the Metro Weather cards.

Method:
1. Spatial point-in-polygon join of each metro's coordinates against the
   app's own USGS principal-aquifer polygons (aquifers.json), so the score
   agrees exactly with what the map shows. Metros over no productive aquifer
   (e.g. Raleigh — Piedmont crystalline rock) get aquifer: null and no
   adjustment.
2. Stress classification per aquifer from the dataset's own recharge_rate vs
   consumption_factor fields, refined by depletion-rate data where
   aquifer-projections.json has real numbers, plus a small set of documented
   overrides (saltwater intrusion, subsidence) with notes.
3. Municipal dependence per metro from a small curated table (how much the
   city actually drinks from the aquifer — being over one ≠ depending on it),
   defaulting to "partial" when an aquifer is present.
4. adjust = stress effect × dependence multiplier. Healthy aquifers are a
   small resilience BUFFER (positive); stressed ones a penalty (negative).

Usage: python3 scripts/build-metro-aquifers.py
"""
import json
from datetime import date
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / 'apps/climate-studio/src/data'

RECHARGE = {'very low': 0, 'low': 1, 'moderate': 2, 'high': 3, 'very high': 4, 'variable': 2}
CONSUMPTION = {'very low': 0, 'low': 1, 'moderate': 2, 'high': 3, 'very high': 4, 'extreme': 4}

# Documented stress overrides (dataset fields under-represent these).
STRESS_OVERRIDE = {
    'Biscayne aquifer': ('high', 'sole-source for Miami-Dade; saltwater intrusion pressure (USGS/SFWMD)'),
    'Coastal Lowlands aquifer system': ('high', 'Houston-area land subsidence drove regulatory pumping cutbacks (HGSD)'),
    'Edwards-Trinity aquifer system': ('high', 'karst; extreme drought sensitivity, pumping capped by Edwards Aquifer Authority'),
    'Mississippi Embayment aquifer system': ('high', 'Memphis Sand cone of depression; declining heads (USGS)'),
    'High Plains Aquifer (Ogallala)': ('severe', 'classic structural depletion, ~0.26%/yr of storage (dataset + Konikow USGS)'),
    'Central Valley Aquifer System': ('severe', '~0.73%/yr storage loss (dataset + Konikow USGS)'),
    'Basin and Range basin-fill aquifers': ('severe', 'arid, very low recharge, urban + ag overdraft (USGS/ADWR)'),
    'Rio Grande aquifer system': ('severe', 'dataset status "High Stress"; river-linked declines (USGS/NM OSE)'),
    'Long Island - Magothy Aquifer': ('moderate', 'primary Nassau supply; contamination plumes + saltwater risk, actively managed (NYSDEC)'),
    'Cambrian-Ordovician aquifer system': ('low', 'dataset status "Stable / Recovering" after Chicago-era drawdown'),
    'Northern Atlantic Coastal Plain': ('moderate', 'dataset status "Moderate / Recovering"'),
    'California Coastal Basin aquifers': ('moderate', 'dataset status "Managed" — SGMA-managed basins'),
}

# Primary-aquifer pick when a metro sits over several polygons.
PRIMARY_OVERRIDE = {
    'Memphis': 'Mississippi Embayment aquifer system',   # Memphis Sand = municipal source, not the MRVA ag alluvium
    'Merrick': 'Long Island - Magothy Aquifer',          # primary municipal supply for Nassau County
    'Jacksonville': 'Floridan Aquifer System',
    'Austin': 'Edwards-Trinity aquifer system',
    'Nashville': 'Ordovician aquifers',
}

# Where what's underfoot ≠ what the city drinks (documented corrections).
AQUIFER_OVERRIDE = {
    # San Antonio's point lands in the Carrizo-Wilcox polygon, but the city's
    # dominant source is the Edwards (Balcones fault zone) system (SAWS).
    'San Antonio': 'Edwards-Trinity aquifer system',
}

# Municipal dependence: primary (≈sole/dominant source), partial (meaningful
# share), minimal (small share). Default 'partial' when an aquifer is present.
DEPENDENCE = {
    'Memphis': ('primary', '~100% groundwater (Memphis Light Gas & Water)'),
    'Miami': ('primary', '~100% Biscayne (Miami-Dade WASD)'),
    'Merrick': ('primary', 'Nassau County is 100% groundwater'),
    'San Antonio': ('primary', 'Edwards is the dominant SAWS source'),
    'Jacksonville': ('primary', 'JEA supply is Floridan groundwater'),
    'Orlando': ('primary', 'OUC supply is Floridan groundwater'),
    'Tampa': ('partial', 'Tampa Bay Water blends Floridan wells, river, desal'),
    'Houston': ('partial', 'subsidence rules shifted Houston toward surface water; GW still meaningful'),
    'Phoenix': ('partial', '~40% groundwater (ADWR); SRP/CAP surface the rest'),
    'Tucson': ('primary', 'historically ~100% GW, now CAP-recharged basin supply'),
    'Albuquerque': ('partial', 'ABCWUA shifted to San Juan-Chama surface + GW'),
    'Las Vegas': ('minimal', '~10% groundwater (SNWA); Colorado River dominant'),
    'Oklahoma City': ('minimal', 'OKC supply is surface reservoirs; Garber-Wellington serves suburbs'),
    'Denver': ('minimal', 'Denver Water is surface-fed; Denver Basin serves suburbs'),
    'Austin': ('minimal', 'Austin Water is Colorado River surface supply'),
    'Boston': ('minimal', 'MWRA Quabbin surface supply'),
    'New York': ('minimal', 'NYC upstate surface supply'),
    'Philadelphia': ('minimal', 'river surface supply'),
    'New Orleans': ('minimal', 'Mississippi River supply'),
}

STRESS_EFFECT = {'severe': -14, 'high': -8, 'moderate': -3, 'low': +4}
DEP_MULT = {'primary': 1.0, 'partial': 0.6, 'minimal': 0.25}


def norm(s, table):
    key = str(s or '').split('(')[0].strip().lower()
    return table.get(key, 2)


def point_in_ring(x, y, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def point_in_poly(x, y, geom):
    if geom['type'] == 'Polygon':
        rings = geom['coordinates']
        return bool(rings) and point_in_ring(x, y, rings[0]) and not any(
            point_in_ring(x, y, h) for h in rings[1:])
    if geom['type'] == 'MultiPolygon':
        return any(point_in_poly(x, y, {'type': 'Polygon', 'coordinates': p}) for p in geom['coordinates'])
    return False


def classify(props):
    name = props.get('name')
    if name in STRESS_OVERRIDE:
        return STRESS_OVERRIDE[name]
    diff = norm(props.get('consumption_factor'), CONSUMPTION) - norm(props.get('recharge_rate'), RECHARGE)
    if diff >= 2:
        return 'severe', 'consumption far exceeds recharge (dataset fields)'
    if diff == 1:
        return 'high', 'consumption exceeds recharge (dataset fields)'
    if diff == 0:
        return 'moderate', 'consumption ≈ recharge (dataset fields)'
    return 'low', 'recharge exceeds consumption (dataset fields)'


def main():
    aquifers = json.load(open(DATA / 'aquifers.json'))['features']
    wb = json.load(open(DATA / 'expanded_wet_bulb_projections.json'))
    by_name = {f['properties'].get('name'): f['properties'] for f in aquifers}

    metros = {}
    for key, v in wb.items():
        hits = []
        for f in aquifers:
            if f.get('geometry') and point_in_poly(v['lon'], v['lat'], f['geometry']):
                nm = f['properties'].get('name')
                if nm and nm not in hits:
                    hits.append(nm)
        # crystalline/low-yield rock is not a usable municipal aquifer
        hits = [h for h in hits if 'crystalline' not in h.lower()]

        chosen = AQUIFER_OVERRIDE.get(key) or PRIMARY_OVERRIDE.get(key) or (hits[0] if hits else None)
        if chosen and chosen not in by_name:
            raise SystemExit(f'{key}: override aquifer {chosen!r} not in aquifers.json')

        if not chosen:
            metros[key] = {
                'aquifer': None, 'stress': None, 'dependence': None, 'adjust': 0,
                'note': 'no productive principal aquifer underfoot — surface-water dependent',
                'all_hits': hits,
            }
            continue

        stress, why = classify(by_name[chosen])
        dep, dep_note = DEPENDENCE.get(key, ('partial', 'default: aquifer present, dependence unverified'))
        adjust = round(STRESS_EFFECT[stress] * DEP_MULT[dep])
        metros[key] = {
            'aquifer': chosen,
            'rock_type': by_name[chosen].get('rock_type'),
            'stress': stress,
            'stress_basis': why,
            'dependence': dep,
            'dependence_note': dep_note,
            'adjust': adjust,
            'all_hits': hits,
        }

    out = {
        '_meta': {
            'generated': str(date.today()),
            'method': 'point-in-polygon join against src/data/aquifers.json (USGS principal aquifers); '
                      'stress from dataset recharge/consumption fields + documented overrides; '
                      'municipal dependence curated (utility sources). Regenerate: python3 scripts/build-metro-aquifers.py',
            'adjust_semantics': 'signed points applied to the water sub-score: healthy aquifer = small buffer bonus, '
                                'stressed aquifer = penalty, scaled by municipal dependence '
                                f'(effects {STRESS_EFFECT}, multipliers {DEP_MULT})',
            'caveats': 'polygons are simplified; dependence table covers documented cases and defaults to partial elsewhere; '
                       'stress classes are coarse (dataset-field heuristic + literature overrides), not modeled head declines',
        },
        'metros': dict(sorted(metros.items())),
    }
    dest = DATA / 'metro-aquifers.json'
    dest.write_text(json.dumps(out, indent=2) + '\n')
    n_none = sum(1 for m in metros.values() if m['aquifer'] is None)
    print(f'wrote {dest} — {len(metros)} metros, {n_none} with no productive aquifer')
    for k in ['Raleigh', 'Memphis', 'Miami', 'San Antonio', 'Phoenix', 'Las Vegas', 'Merrick', 'Oklahoma City']:
        m = metros[k]
        print(f"{k:15} {m['aquifer'] or 'NONE':40} stress={m['stress']} dep={m['dependence']} adjust={m['adjust']:+d}"
              if m['aquifer'] else f"{k:15} NONE  adjust=+0")


if __name__ == '__main__':
    main()
