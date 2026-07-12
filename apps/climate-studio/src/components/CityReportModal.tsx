import React, { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { buildCityReportHtml } from '../utils/cityReport'
import { DEFAULT_WEIGHTS, type ResilienceWeights } from '../utils/resilienceScore'

interface CityReportModalProps {
  /** Metro key as used by the resilience engine (matches wet-bulb data keys). */
  metroKey: string
  year: number
  weights?: ResilienceWeights
  onClose: () => void
}

/**
 * Full-screen modal that previews a city's resilience report (in an isolated
 * iframe from the same HTML that would print) with a Download PDF action.
 *
 * "Download PDF" prints the report iframe through the browser's print pipeline
 * (Save as PDF) — no PDF library dependency, and the report's @media print
 * styles produce a clean page. Rendered via a portal to <body> so it escapes
 * any transformed / backdrop-filtered ancestor (e.g. the map card).
 */
export function CityReportModal({ metroKey, year, weights = DEFAULT_WEIGHTS, onClose }: CityReportModalProps) {
  const html = useMemo(() => buildCityReportHtml(metroKey, year, weights), [metroKey, year, weights])
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden' // lock background scroll while open
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  const downloadPdf = () => {
    const win = iframeRef.current?.contentWindow
    if (!win) return
    win.focus()
    win.print() // browser print dialog → "Save as PDF"
  }

  const overlay = (
    <div
      className="fixed inset-0 z-[3000] flex items-center justify-center p-3 sm:p-6"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Resilience report for ${metroKey}`}
    >
      <div
        className="flex h-full max-h-[95vh] w-full max-w-[1040px] flex-col overflow-hidden rounded-xl shadow-2xl"
        style={{ background: 'var(--cs-surface-elevated)', border: '1px solid var(--cs-border-default)' }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="flex shrink-0 items-center justify-between gap-3 px-4 py-3"
          style={{ borderBottom: '1px solid var(--cs-border-default)' }}
        >
          <h3 className="text-sm font-semibold" style={{ color: 'var(--cs-text-primary)' }}>
            Resilience report
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={downloadPdf}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--cs-brand-primary)' }}
            >
              Download PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close report"
              className="flex items-center justify-center rounded-lg p-2 transition-colors hover:bg-[var(--cs-surface-sunken)]"
              style={{ border: '1px solid var(--cs-border-default)', color: 'var(--cs-text-tertiary)' }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <iframe
          ref={iframeRef}
          title="City resilience report"
          srcDoc={html}
          className="w-full flex-1 border-0"
          style={{ background: '#fff', minHeight: 0 }}
          sandbox="allow-same-origin allow-modals"
        />
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}
