import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Plus } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import {
  getAllSupportedMetros,
  SUPPORTED_METRO_COUNT,
  type MetroMatch,
} from '../../utils/metroResolver'
import { cn } from '../../lib/utils'

export interface LocationSelection {
  metroKey: string
  metroName: string
  lat: number
  lon: number
  searchLabel?: string
  distanceKm?: number
}

interface LocationSearchBarProps {
  onSelect: (selection: LocationSelection) => void
  existingMetroKeys?: string[]
  className?: string
}

const ALL_METROS = getAllSupportedMetros()

interface DropdownPosition {
  top: number
  left: number
  width: number
}

function matchToSelection(match: MetroMatch): LocationSelection {
  return {
    metroKey: match.key,
    metroName: match.name,
    lat: match.lat,
    lon: match.lon,
  }
}

function filterMetros(query: string): MetroMatch[] {
  const q = query.trim().toLowerCase()
  if (!q) return ALL_METROS
  return ALL_METROS.filter(
    metro =>
      metro.key.toLowerCase().includes(q) ||
      metro.name.toLowerCase().includes(q)
  )
}

export function LocationSearchBar({
  onSelect,
  existingMetroKeys = [],
  className,
}: LocationSearchBarProps) {
  const listboxId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null)

  const filteredMetros = useMemo(() => filterMetros(query), [query])

  const updateDropdownPosition = useCallback(() => {
    const input = inputRef.current
    if (!input) return
    const rect = input.getBoundingClientRect()
    setDropdownPosition({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    })
  }, [])

  useEffect(() => {
    setHighlightIndex(0)
  }, [query, open])

  useEffect(() => {
    if (!open) return

    updateDropdownPosition()

    const handleReposition = () => updateDropdownPosition()
    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)

    return () => {
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [open, updateDropdownPosition])

  useEffect(() => {
    if (!open || !listRef.current) return
    const option = listRef.current.querySelector<HTMLElement>(
      `[data-metro-index="${highlightIndex}"]`
    )
    option?.scrollIntoView({ block: 'nearest' })
  }, [highlightIndex, open])

  const selectMetro = useCallback(
    (metro: MetroMatch) => {
      if (existingMetroKeys.includes(metro.key)) {
        setFeedback(`${metro.name} is already on the dashboard.`)
        return false
      }
      onSelect(matchToSelection(metro))
      setQuery('')
      setOpen(false)
      setFeedback(null)
      inputRef.current?.blur()
      return true
    },
    [existingMetroKeys, onSelect]
  )

  const selectHighlighted = useCallback(() => {
    const metro = filteredMetros[highlightIndex]
    if (!metro) {
      if (filteredMetros.length === 0) {
        setFeedback('No matching metros. Try another name.')
      }
      return
    }
    selectMetro(metro)
  }, [filteredMetros, highlightIndex, selectMetro])

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setOpen(true)
        setHighlightIndex(i => Math.min(i + 1, Math.max(filteredMetros.length - 1, 0)))
        break
      case 'ArrowUp':
        event.preventDefault()
        setOpen(true)
        setHighlightIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        event.preventDefault()
        selectHighlighted()
        break
      case 'Escape':
        setOpen(false)
        break
      case 'Tab':
        setOpen(false)
        break
      default:
        break
    }
  }

  const dropdown =
    open && dropdownPosition
      ? createPortal(
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label="Supported metros"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
            }}
            className="fixed z-[2500] max-h-60 overflow-y-auto rounded-md border border-[var(--cs-border-default)] bg-[var(--cs-surface-elevated)] py-1 shadow-[var(--cs-shadow-md)] [backdrop-filter:var(--cs-widget-container-blur)] [-webkit-backdrop-filter:var(--cs-widget-container-blur)]"
          >
            {filteredMetros.length === 0 ? (
              <li className="px-3 py-2 text-sm text-[var(--cs-text-tertiary)]">
                No metros match &ldquo;{query}&rdquo;
              </li>
            ) : (
              filteredMetros.map((metro, index) => {
                const alreadyAdded = existingMetroKeys.includes(metro.key)
                const highlighted = index === highlightIndex

                return (
                  <li
                    key={metro.key}
                    id={`${listboxId}-option-${index}`}
                    role="option"
                    aria-selected={highlighted}
                    aria-disabled={alreadyAdded}
                    data-metro-index={index}
                    onMouseDown={e => e.preventDefault()}
                    onMouseEnter={() => setHighlightIndex(index)}
                    onClick={() => selectMetro(metro)}
                    className={cn(
                      'cursor-pointer px-3 py-2 text-sm transition-colors',
                      highlighted && 'bg-[var(--cs-interactive-hover)]',
                      alreadyAdded
                        ? 'cursor-not-allowed text-[var(--cs-text-tertiary)]'
                        : 'text-[var(--cs-text-primary)]'
                    )}
                  >
                    <span className="font-medium">{metro.name}</span>
                    {alreadyAdded && (
                      <span className="ml-2 text-xs text-[var(--cs-text-tertiary)]">
                        Already added
                      </span>
                    )}
                  </li>
                )
              })
            )}
          </ul>,
          document.body
        )
      : null

  return (
    <div ref={rootRef} className={cn('relative space-y-0', className)}>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Input
            ref={inputRef}
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={
              open && filteredMetros[highlightIndex]
                ? `${listboxId}-option-${highlightIndex}`
                : undefined
            }
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setOpen(true)
              if (feedback) setFeedback(null)
            }}
            onFocus={() => {
              setOpen(true)
              updateDropdownPosition()
            }}
            onBlur={() => {
              window.setTimeout(() => setOpen(false), 150)
            }}
            onKeyDown={handleInputKeyDown}
            placeholder={`Filter ${SUPPORTED_METRO_COUNT} supported metros…`}
            className="pr-9"
            autoComplete="off"
          />
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cs-text-tertiary)]"
            aria-hidden
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          className="shrink-0"
          disabled={filteredMetros.length === 0}
          onMouseDown={e => e.preventDefault()}
          onClick={selectHighlighted}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add
        </Button>
      </div>

      {feedback && (
        <p className="mt-2 text-xs text-[var(--cs-tone-orange-text)]" role="status">
          {feedback}
        </p>
      )}

      {dropdown}
    </div>
  )
}
