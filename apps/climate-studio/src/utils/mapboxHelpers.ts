import type mapboxgl from 'mapbox-gl'

/** True when the map instance can safely accept style/layer API calls. */
export function isMapUsable(map: mapboxgl.Map | null | undefined): map is mapboxgl.Map {
  if (!map || map._removed) return false
  try {
    return Boolean(map.getStyle())
  } catch {
    return false
  }
}

export function safeGetLayer(
  map: mapboxgl.Map | null | undefined,
  layerId: string
): ReturnType<mapboxgl.Map['getLayer']> | undefined {
  if (!isMapUsable(map)) return undefined
  try {
    return map.getLayer(layerId)
  } catch {
    return undefined
  }
}

export function safeRemoveLayer(map: mapboxgl.Map | null | undefined, layerId: string) {
  if (!safeGetLayer(map, layerId)) return
  try {
    map!.removeLayer(layerId)
  } catch {
    // Style may be mid-teardown during route changes
  }
}

export function safeRemoveSource(map: mapboxgl.Map | null | undefined, sourceId: string) {
  if (!isMapUsable(map)) return
  try {
    if (map.getSource(sourceId)) map.removeSource(sourceId)
  } catch {
    // ignore
  }
}

export function destroyMap(map: mapboxgl.Map | null | undefined) {
  if (!map || map._removed) return
  try {
    map.remove()
  } catch {
    // ignore
  }
}
