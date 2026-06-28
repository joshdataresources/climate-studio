import { useEffect, useState } from 'react'

/**
 * useStreamflow — live USGS river discharge for the current viewport.
 *
 * Backed by the `/api/usgs/streamflow` endpoint (backend/server.js), which
 * proxies the USGS NWIS Instantaneous Values service. This is genuinely
 * real-time public data — no API key or Earth Engine required.
 *
 * Returns a GeoJSON FeatureCollection of gauges, each with `dischargeCfs`
 * (latest reading, cubic feet per second) and `dateTime`.
 */

const BACKEND_BASE_URL =
  (import.meta as any).env?.VITE_NODE_BACKEND_URL?.replace(/\/$/, '') || 'http://localhost:3001'

export interface StreamflowBounds {
  west: number
  south: number
  east: number
  north: number
}

export interface StreamflowState {
  data: GeoJSON.FeatureCollection | null
  loading: boolean
  error: string | null
}

/**
 * @param bounds  current map bounds; pass null to skip fetching
 * @param enabled gate fetching on a layer toggle so we don't hammer USGS
 */
export function useStreamflow(
  bounds: StreamflowBounds | null,
  enabled: boolean
): StreamflowState {
  const [state, setState] = useState<StreamflowState>({
    data: null,
    loading: false,
    error: null,
  })

  // Round bounds so small pans don't trigger a refetch.
  const key =
    enabled && bounds
      ? [bounds.west, bounds.south, bounds.east, bounds.north]
          .map((n) => n.toFixed(2))
          .join(',')
      : null

  useEffect(() => {
    if (!enabled || !bounds || !key) return

    let cancelled = false
    const controller = new AbortController()

    async function load() {
      setState((s) => ({ ...s, loading: true, error: null }))
      try {
        // USGS limits bBox area, so only query at city/metro scale.
        const bbox = `${bounds.west.toFixed(4)},${bounds.south.toFixed(4)},${bounds.east.toFixed(4)},${bounds.north.toFixed(4)}`
        const url = `${BACKEND_BASE_URL}/api/usgs/streamflow?bbox=${encodeURIComponent(bbox)}`
        const res = await fetch(url, { signal: controller.signal })
        if (!res.ok) throw new Error(`Streamflow request failed: ${res.status}`)
        const json = await res.json()
        if (cancelled) return
        setState({
          data: json?.data ?? null,
          loading: false,
          error: json?.success === false ? json.error : null,
        })
      } catch (err: any) {
        if (cancelled || err?.name === 'AbortError') return
        setState({ data: null, loading: false, error: err?.message ?? 'Unknown error' })
      }
    }

    load()
    return () => {
      cancelled = true
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled])

  return state
}
