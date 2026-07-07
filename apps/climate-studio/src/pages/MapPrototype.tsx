import React, { useMemo, useState } from 'react'
import Map, { useControl } from 'react-map-gl'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { ScatterplotLayer } from '@deck.gl/layers'
import 'mapbox-gl/dist/mapbox-gl.css'
import { rankMetros, resilienceColorRGBA, RESILIENCE_DECADES } from '../utils/resilienceScore'
import wetBulbData from '../data/expanded_wet_bulb_projections.json'
import { MetroPanel } from '../components/prototype/MetroPanel'

/**
 * PROTOTYPE ROUTE (/prototype) — proposed merge of the Metro Weather views
 * and the resilience index on the map page:
 *
 *   - ONE metro bubble layer with display modes (resilience is the new
 *     default; peak wet-bulb / humidity / heat days replace the three old
 *     Metro Weather checkboxes)
 *   - hover = real stored fields (no estimatedSummerTempF reverse-engineering)
 *   - click = MetroPanel (score summary + expandable evidence)
 *
 * Self-contained on purpose: touches nothing in ClimateStudioView/DeckGLMap.
 * If adopted, the bubble modes fold into the main map's megaregion layer and
 * MetroPanel replaces the four Metro* popup components.
 */

const MAPBOX_ACCESS_TOKEN =
  import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ||
  'pk.eyJ1Ijoiam9zaHVhYmJ1dGxlciIsImEiOiJjbWcwNXpyNXUwYTdrMmtva2tiZ2NjcGxhIn0.Fc3d_CloJGiw9-BE4nI_Kw'

const wetBulb = wetBulbData as Record<string, any>

type Mode = 'resilience' | 'wetbulb' | 'humidity' | 'heatdays'

const MODES: Array<{ id: Mode; label: string }> = [
  { id: 'resilience', label: 'Resilience' },
  { id: 'wetbulb', label: 'Peak wet-bulb' },
  { id: 'humidity', label: 'Humidity' },
  { id: 'heatdays', label: 'Days >95°F' },
]

function lerpColor(a: [number, number, number], b: [number, number, number], t: number): [number, number, number, number] {
  const c = Math.max(0, Math.min(1, t))
  return [
    Math.round(a[0] + (b[0] - a[0]) * c),
    Math.round(a[1] + (b[1] - a[1]) * c),
    Math.round(a[2] + (b[2] - a[2]) * c),
    210,
  ]
}

function DeckGLOverlay(props: { layers: any[] }) {
  const overlay = useControl<any>(() => new MapboxOverlay({ layers: props.layers }))
  overlay.setProps({ layers: props.layers })
  return null
}

interface Hover {
  x: number
  y: number
  metroKey: string
}

export default function MapPrototype() {
  const [mode, setMode] = useState<Mode>('resilience')
  const [year, setYear] = useState(2055)
  const [selected, setSelected] = useState<string | null>(null)
  const [hover, setHover] = useState<Hover | null>(null)

  const ranked = useMemo(() => rankMetros(year), [year])
  const rankOf = useMemo(() => {
    const m: Record<string, number> = {}
    ranked.forEach((r, i) => { m[r.metroKey] = i + 1 })
    return m
  }, [ranked])

  const dots = useMemo(() =>
    ranked.map(r => {
      const p = wetBulb[r.metroKey]?.projections?.[String(r.year)] ?? {}
      return {
        key: r.metroKey,
        name: r.name,
        lon: r.lon,
        lat: r.lat,
        composite: r.composite,
        peakWb: p.peak_wet_bulb_F ?? null,
        humidity: p.avg_summer_humidity ?? null,
        heatDays: p.days_over_95F ?? null,
        pop: wetBulb[r.metroKey]?.metro_population_2024 ?? 1000000,
      }
    }), [ranked])

  const layers = useMemo(() => [
    new ScatterplotLayer({
      id: 'metro-modes',
      data: dots,
      getPosition: (d: any) => [d.lon, d.lat],
      getRadius: (d: any) => Math.max(7, Math.min(22, Math.sqrt(d.pop) / 120)),
      radiusUnits: 'pixels',
      pickable: true,
      stroked: true,
      getLineColor: [255, 255, 255, 220],
      getLineWidth: 1.5,
      lineWidthUnits: 'pixels',
      getFillColor: (d: any) => {
        if (mode === 'resilience') return resilienceColorRGBA(d.composite, 210)
        if (mode === 'wetbulb') return lerpColor([250, 199, 117], [163, 45, 45], ((d.peakWb ?? 70) - 70) / 26)
        if (mode === 'humidity') return lerpColor([181, 212, 244], [12, 68, 124], ((d.humidity ?? 40) - 40) / 50)
        return lerpColor([250, 199, 117], [80, 19, 19], (d.heatDays ?? 0) / 150)
      },
      updateTriggers: { getFillColor: [mode, year] },
      onHover: (info: any) => setHover(info.object ? { x: info.x, y: info.y, metroKey: info.object.key } : null),
      onClick: (info: any) => { if (info.object) setSelected(info.object.key) },
    }),
  ], [dots, mode, year])

  const hoverDot = hover ? dots.find(d => d.key === hover.metroKey) : null

  return (
    <div className="relative w-full overflow-hidden" style={{ height: 'calc(100vh - 56px)' }}>
      <Map
        mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
        initialViewState={{ longitude: -96.5, latitude: 38.5, zoom: 3.6 }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        style={{ width: '100%', height: '100%' }}
      >
        <DeckGLOverlay layers={layers} />
      </Map>

      <div className="absolute left-4 top-4 z-10 w-[260px] rounded-xl border border-black/10 bg-white/95 p-3 shadow-lg backdrop-blur dark:bg-zinc-900/95">
        <p className="text-[13px] font-medium">Metro bubbles · prototype</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {MODES.map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`rounded-lg px-2 py-1 text-[11px] ${mode === m.id ? 'bg-black/80 text-white dark:bg-white/90 dark:text-black' : 'bg-black/5 hover:bg-black/10'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-[var(--cs-text-tertiary,#666)]">Year</span>
          <input
            type="range"
            min={RESILIENCE_DECADES[0]}
            max={RESILIENCE_DECADES[RESILIENCE_DECADES.length - 1]}
            step={10}
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="w-full accent-[#1D9E75]"
            aria-label="Projection year"
          />
          <span className="w-10 text-right text-xs font-medium tabular-nums">{year}</span>
        </div>
        {mode === 'resilience' && (
          <div className="mt-2 flex items-center gap-3 text-[11px] text-[var(--cs-text-tertiary,#666)]">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#1D9E75' }} />66+</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#EF9F27' }} />40–65</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#E24B4A' }} />&lt;40</span>
          </div>
        )}
        <p className="mt-2 text-[11px] leading-snug text-[var(--cs-text-tertiary,#666)]">
          One layer, four display modes — replaces the three Metro Weather checkboxes. Click a metro for the full scorecard.
        </p>
      </div>

      {hoverDot && !selected && (
        <div
          className="pointer-events-none absolute z-20 rounded-lg border border-black/10 bg-white/95 px-3 py-2 text-xs shadow-lg dark:bg-zinc-900/95"
          style={{ left: hover!.x + 12, top: hover!.y + 12 }}
        >
          <p className="font-medium">
            {hoverDot.name}
            <span className="ml-2 tabular-nums" style={{ color: resilienceColorRGBA(hoverDot.composite).slice(0, 3).join(',') === '29,158,117' ? '#1D9E75' : hoverDot.composite >= 40 ? '#BA7517' : '#E24B4A' }}>
              {Math.round(hoverDot.composite)}
            </span>
          </p>
          <p className="mt-0.5 text-[var(--cs-text-tertiary,#666)]">
            peak wet-bulb {hoverDot.peakWb != null ? `${hoverDot.peakWb}°F` : '—'} · {hoverDot.heatDays ?? '—'} days &gt;95°F
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--cs-text-tertiary,#666)]">click for full scorecard</p>
        </div>
      )}

      {selected && (
        <MetroPanel
          metroKey={selected}
          year={year}
          rank={rankOf[selected] ?? 0}
          total={ranked.length}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
