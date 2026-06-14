import { ArrowRight } from 'lucide-react'
import { Badge } from '../ui/badge'
import { FeatureCard } from '../ui/feature-card'
import {
  getMetroOutlook,
  outlookLevelLabel,
  type OutlookLevel,
} from '../../utils/metroOutlook'
import type { SspScenario } from '../../utils/scenarioMapping'
import type { LocationSelection } from './LocationSearchBar'
import { cn } from '../../lib/utils'

interface LocationOutlookPanelProps {
  location: LocationSelection
  scenario: SspScenario
  projectionYear: number
}

function levelBadgeVariant(
  level: OutlookLevel
): 'success' | 'info' | 'warning' | 'error' {
  switch (level) {
    case 'stable':
      return 'success'
    case 'manageable':
      return 'info'
    case 'watch':
      return 'warning'
    case 'stressed':
      return 'warning'
    case 'critical':
      return 'error'
  }
}

function levelAccentClass(level: OutlookLevel): string {
  switch (level) {
    case 'stable':
      return 'border-[var(--cs-tone-emerald-text)]/30 bg-[var(--cs-tone-emerald-text)]/8'
    case 'manageable':
      return 'border-[var(--cs-tone-blue-text)]/30 bg-[var(--cs-tone-blue-text)]/8'
    case 'watch':
      return 'border-[var(--cs-tone-amber-text)]/35 bg-[var(--cs-tone-amber-text)]/10'
    case 'stressed':
      return 'border-[var(--cs-tone-orange-text)]/35 bg-[var(--cs-tone-orange-text)]/10'
    case 'critical':
      return 'border-[var(--cs-tone-red-text)]/35 bg-[var(--cs-tone-red-text)]/10'
  }
}

function OutlookBadge({ level }: { level: OutlookLevel }) {
  return (
    <Badge variant={levelBadgeVariant(level)} className="normal-case tracking-normal">
      {outlookLevelLabel(level)}
    </Badge>
  )
}

export function LocationOutlookPanel({
  location,
  scenario,
  projectionYear,
}: LocationOutlookPanelProps) {
  const outlook = getMetroOutlook({
    metroKey: location.metroKey,
    metroName: location.metroName,
    lat: location.lat,
    lon: location.lon,
    scenario,
    projectionYear,
  })

  if (!outlook) return null

  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          'rounded-lg border p-4',
          levelAccentClass(outlook.futureLevel)
        )}
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--cs-text-tertiary)]">
            Future outlook
          </span>
          <OutlookBadge level={outlook.presentLevel} />
          {outlook.presentLevel !== outlook.futureLevel && (
            <>
              <ArrowRight className="h-3.5 w-3.5 text-[var(--cs-text-tertiary)]" aria-hidden />
              <OutlookBadge level={outlook.futureLevel} />
            </>
          )}
        </div>
        <h3 className="text-base font-semibold text-[var(--cs-text-primary)]">
          {outlook.headline}
        </h3>
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--cs-text-secondary)]">
          {outlook.narrative}
        </p>
        <p className="mt-2 text-[11px] text-[var(--cs-text-tertiary)]">
          Comparing {outlook.presentYear} baseline era to {outlook.futureYear} under the selected
          scenario. City Comparison tab focuses on side-by-side metrics; this view tracks how
          stress drivers evolve over time.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {outlook.domains.map(domain => (
          <FeatureCard key={domain.id} title={domain.label}>
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <OutlookBadge level={domain.present} />
              {domain.present !== domain.future && (
                <>
                  <ArrowRight className="h-3 w-3 text-[var(--cs-text-tertiary)]" aria-hidden />
                  <OutlookBadge level={domain.future} />
                </>
              )}
            </div>
            <p className="text-[11px] text-[var(--cs-text-tertiary)]">
              {outlook.presentYear}: {domain.presentDetail}
            </p>
            <p className="mt-1 text-[11px] text-[var(--cs-text-secondary)]">
              {outlook.futureYear}: {domain.futureDetail}
            </p>
          </FeatureCard>
        ))}
      </div>
    </div>
  )
}
