import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { IconTile, type IconTileTone } from '../ui/icon-tile'
import { cn } from '../../lib/utils'

interface DashboardMetricCardProps {
  title: string
  description?: string
  value: React.ReactNode
  unit?: string
  caption?: string
  icon: React.ReactNode
  tone?: IconTileTone
  valueClassName?: string
}

export function DashboardMetricCard({
  title,
  description,
  value,
  unit,
  caption,
  icon,
  tone = 'sky',
  valueClassName,
}: DashboardMetricCardProps) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-xs font-semibold">
          <IconTile tone={tone} size="sm">
            {icon}
          </IconTile>
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className={cn('text-3xl font-bold tracking-tight', valueClassName)}>
          {value}
          {unit && (
            <span className="ml-1 text-base font-medium text-[var(--cs-text-tertiary)]">
              {unit}
            </span>
          )}
        </div>
        {caption && (
          <p className="mt-1 text-xs text-[var(--cs-text-tertiary)]">{caption}</p>
        )}
      </CardContent>
    </Card>
  )
}
