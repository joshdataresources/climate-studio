import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Search, Loader2, MapPin } from 'lucide-react'
import { Input } from '../ui/input'
import { resolveNearestMetro, resolveMetroByName, type MetroMatch } from '../../utils/metroResolver'
import { cn } from '../../lib/utils'

export interface GeoSearchResult {
  display_name: string
  lat: string
  lon: string
}

export interface LocationSelection {
  metroKey: string
  metroName: string
  searchLabel?: string
  distanceKm?: number
}

interface LocationSearchBarProps {
  onSelect: (selection: LocationSelection) => void
  existingMetroKeys?: string[]
  className?: string
}

export function LocationSearchBar({
  onSelect,
  existingMetroKeys = [],
  className,
}: LocationSearchBarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeoSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const controllerRef = useRef<AbortController | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleSelectMetro = useCallback(
    (match: MetroMatch) => {
      if (existingMetroKeys.includes(match.key)) return
      onSelect({
        metroKey: match.key,
        metroName: match.name,
        searchLabel: match.resolvedFrom,
        distanceKm: match.distanceKm,
      })
      setQuery('')
      setResults([])
      setIsOpen(false)
    },
    [existingMetroKeys, onSelect]
  )

  const search = useCallback(async (term: string) => {
    const trimmed = term.trim()
    if (!trimmed) {
      setResults([])
      return
    }

    const nameMatch = resolveMetroByName(trimmed)
    if (nameMatch && !existingMetroKeys.includes(nameMatch.key)) {
      handleSelectMetro(nameMatch)
      return
    }

    try {
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller
      setIsSearching(true)

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(trimmed)}`,
        { headers: { Accept: 'application/json' }, signal: controller.signal }
      )
      if (!response.ok) throw new Error(`Geocoding failed: ${response.status}`)

      const data: GeoSearchResult[] = await response.json()
      if (data.length > 0) {
        const first = data[0]
        const lat = parseFloat(first.lat)
        const lon = parseFloat(first.lon)
        const match = resolveNearestMetro(lat, lon, first.display_name)
        if (match && !existingMetroKeys.includes(match.key)) {
          handleSelectMetro(match)
          return
        }
      }
      setResults(data)
      setIsOpen(data.length > 0)
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Geocoding error:', error)
      }
    } finally {
      setIsSearching(false)
    }
  }, [existingMetroKeys, handleSelectMetro])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setIsOpen(false)
      return
    }
    const timer = setTimeout(() => search(query), 400)
    return () => clearTimeout(timer)
  }, [query, search])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleResultClick = (result: GeoSearchResult) => {
    const lat = parseFloat(result.lat)
    const lon = parseFloat(result.lon)
    const match = resolveNearestMetro(lat, lon, result.display_name)
    if (match) handleSelectMetro(match)
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cs-text-tertiary)]" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Search for a city or address…"
          className="pl-9 pr-9"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--cs-text-tertiary)]" />
        )}
      </div>

      {isOpen && results.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-[var(--cs-border-default)] bg-[var(--cs-surface-elevated)] shadow-[var(--cs-shadow-md)]">
          {results.map((result, i) => {
            const lat = parseFloat(result.lat)
            const lon = parseFloat(result.lon)
            const match = resolveNearestMetro(lat, lon, result.display_name)
            const alreadyAdded = match ? existingMetroKeys.includes(match.key) : false

            return (
              <li key={`${result.lat}-${result.lon}-${i}`}>
                <button
                  type="button"
                  disabled={alreadyAdded}
                  onClick={() => handleResultClick(result)}
                  className={cn(
                    'flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm transition-colors',
                    alreadyAdded
                      ? 'cursor-not-allowed opacity-50'
                      : 'hover:bg-[var(--cs-interactive-hover)]'
                  )}
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cs-brand-primary)]" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[var(--cs-text-primary)]">{result.display_name}</div>
                    {match && (
                      <div className="text-xs text-[var(--cs-text-tertiary)]">
                        → {match.name}
                        {match.distanceKm != null && match.distanceKm > 0
                          ? ` (${match.distanceKm} km)`
                          : ''}
                        {alreadyAdded ? ' · already added' : ''}
                      </div>
                    )}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
