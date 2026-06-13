export interface GeocodeResult {
  display_name: string
  lat: string
  lon: string
  boundingbox?: [string, string, string, string]
}

export async function geocodeQuery(
  query: string,
  signal?: AbortSignal
): Promise<GeocodeResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(trimmed)}`,
    {
      headers: { Accept: 'application/json' },
      signal,
    }
  )

  if (!response.ok) {
    throw new Error(`Geocoding failed with status ${response.status}`)
  }

  return response.json()
}
