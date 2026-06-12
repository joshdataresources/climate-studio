/**
 * Climate Studio Design System
 * ============================
 * A comprehensive showcase of all design tokens, components, and patterns.
 * Mirrors design-demo.html 1:1 — both are generated from tokens.css and
 * the components/ui primitives. Access this page at /design-system.
 */

import React, { useState } from 'react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Slider } from '../components/ui/slider'
import { AccordionItem } from '../components/ui/accordion'
import { Badge } from '../components/ui/badge'
import { Switch } from '../components/ui/switch'
import { Callout } from '../components/ui/callout'
import { Spinner } from '../components/ui/spinner'
import { Progress } from '../components/ui/progress'
import { IconTile, type IconTileTone } from '../components/ui/icon-tile'
import { FeatureCard } from '../components/ui/feature-card'
import { LayerToggleCard } from '../components/ui/layer-toggle-card'
import { LayerRow } from '../components/ui/layer-row'
import { GradientBar, LegendRow, climateGradients } from '../components/ui/legend'
import { LayerStatus } from '../components/ui/layer-status'
import { ImpactGrid, ImpactMetric } from '../components/ui/impact-grid'
import { ErrorOverlay } from '../components/ui/error-overlay'
import { ThemeToggle } from '../components/ui/theme-toggle'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import {
  WaveIcon,
  HeatIcon,
  MountainIcon,
  WeatherIcon,
  DropIcon,
  PopulationIcon,
} from '../components/LayerIcons'
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Palette,
  Type,
  Box,
  Layers,
  Sparkles,
  Sun,
  Moon,
  Copy,
  Check,
  ChevronDown,
} from 'lucide-react'

/* ─────────────────────────── Page chrome helpers ─────────────────────────── */

const eyebrowClass =
  'text-xs font-semibold uppercase tracking-wider text-[var(--cs-text-tertiary)] mb-3'

function Eyebrow({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`${eyebrowClass} ${className}`}>{children}</h3>
}

function FieldLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <label className={`block text-xs font-medium text-[var(--cs-text-tertiary)] mb-1 ${className}`}>
      {children}
    </label>
  )
}

function ControlLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--cs-text-tertiary)]">
      {children}
    </label>
  )
}

interface SectionProps {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}

function Section({ title, icon, children }: SectionProps) {
  return (
    <section className="mb-12">
      <div className="flex items-center gap-3 mb-6 pb-3 border-b border-[var(--widget-border)]">
        <div className="p-2 rounded-lg bg-[#437efc]/20 text-[#437efc]">{icon}</div>
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  )
}

interface ColorSwatchProps {
  name: string
  variable: string
  value: string
}

function ColorSwatch({ name, variable, value }: ColorSwatchProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(variable)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group flex items-center gap-3 p-2 rounded-lg transition-colors hover:bg-[var(--cs-interactive-hover)]">
      <div
        className="w-12 h-12 rounded-lg shadow-sm flex-shrink-0 border border-[var(--cs-swatch-chip-border)]"
        style={{ backgroundColor: value }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{name}</div>
        <div className="text-xs font-mono truncate text-[var(--cs-text-tertiary)]">
          {variable}  {value}
        </div>
      </div>
      <button
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-md hover:bg-[var(--cs-interactive-hover)]"
      >
        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  )
}

/* ──────────────────────────────── Sections ──────────────────────────────── */

const neutralColors = [
  { name: 'Neutral 0', variable: '--cs-neutral-0', value: '#000000' },
  { name: 'Neutral 100', variable: '--cs-neutral-100', value: '#141414' },
  { name: 'Neutral 200', variable: '--cs-neutral-200', value: '#282828' },
  { name: 'Neutral 300', variable: '--cs-neutral-300', value: '#3f3f3f' },
  { name: 'Neutral 500', variable: '--cs-neutral-500', value: '#737373' },
  { name: 'Neutral 700', variable: '--cs-neutral-700', value: '#d4d4d4' },
  { name: 'Neutral 900', variable: '--cs-neutral-900', value: '#f5f5f5' },
  { name: 'Neutral 1000', variable: '--cs-neutral-1000', value: '#ffffff' },
]

const brandColors = [
  { name: 'Brand Primary', variable: '--cs-brand-primary', value: '#437efc' },
  { name: 'Brand Light', variable: '--cs-brand-primary-light', value: '#6b9bff' },
  { name: 'Brand Dark', variable: '--cs-brand-primary-dark', value: '#2a5fd4' },
]

const semanticColors = [
  { name: 'Success', variable: '--cs-success-text', value: '#10b981' },
  { name: 'Warning', variable: '--cs-warning-text', value: '#fbbf24' },
  { name: 'Error', variable: '--cs-error-text', value: '#ef4444' },
  { name: 'Info', variable: '--cs-info-text', value: '#3b82f6' },
]

const dataVizColors = [
  { name: 'Sea Level', variable: '--cs-data-sea', value: '#0ea5e9' },
  { name: 'Heat', variable: '--cs-data-heat', value: '#f97316' },
  { name: 'Cold', variable: '--cs-data-cold', value: '#3b82f6' },
  { name: 'Drought', variable: '--cs-data-drought', value: '#eab308' },
  { name: 'Rain', variable: '--cs-data-rain', value: '#06b6d4' },
  { name: 'Growth', variable: '--cs-data-growth', value: '#10b981' },
  { name: 'Decline', variable: '--cs-data-decline', value: '#ef4444' },
  { name: 'Urban', variable: '--cs-data-urban', value: '#8b5cf6' },
]

function ColorPalette() {
  return (
    <Section title="Color System" icon={<Palette className="h-5 w-5" />}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <Eyebrow>Neutral Scale</Eyebrow>
            <div className="widget-container space-y-1">
              {neutralColors.map(color => (
                <ColorSwatch key={color.variable} {...color} />
              ))}
            </div>
          </div>
          <div>
            <Eyebrow>Brand</Eyebrow>
            <div className="widget-container space-y-1">
              {brandColors.map(color => (
                <ColorSwatch key={color.variable} {...color} />
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div>
            <Eyebrow>Semantic</Eyebrow>
            <div className="widget-container space-y-1">
              {semanticColors.map(color => (
                <ColorSwatch key={color.variable} {...color} />
              ))}
            </div>
          </div>
          <div>
            <Eyebrow>Data Visualization</Eyebrow>
            <div className="widget-container space-y-1">
              {dataVizColors.map(color => (
                <ColorSwatch key={color.variable} {...color} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Section>
  )
}

function Typography() {
  const rowLabelClass = `${eyebrowClass} mb-1`
  return (
    <Section title="Typography" icon={<Type className="h-5 w-5" />}>
      <div className="widget-container space-y-5">
        <div>
          <span className={rowLabelClass}>Display</span>
          <p className="text-4xl font-bold tracking-tight">Climate Studio</p>
        </div>
        <div>
          <span className={rowLabelClass}>Heading 1</span>
          <p className="text-3xl font-bold">Sea Level Rise Analysis</p>
        </div>
        <div>
          <span className={rowLabelClass}>Heading 2</span>
          <p className="text-2xl font-semibold">Temperature Projections</p>
        </div>
        <div>
          <span className={rowLabelClass}>Heading 3</span>
          <p className="text-xl font-semibold">Urban Heat Island</p>
        </div>
        <div>
          <span className={rowLabelClass}>Body Large</span>
          <p className="text-base">
            Analyze climate data across multiple dimensions with real-time NASA Earth Engine integration.
          </p>
        </div>
        <div>
          <span className={rowLabelClass}>Body</span>
          <p className="text-sm">
            The projected temperature anomaly for RCP 8.5 scenario shows significant warming trends in urban centers.
          </p>
        </div>
        <div>
          <span className={rowLabelClass}>Caption</span>
          <p className="text-xs text-[var(--cs-text-tertiary)]">
            Source: NASA Global Climate Modeling • Last updated: Dec 2025
          </p>
        </div>
        <div>
          <span className={rowLabelClass}>Code</span>
          <code className="inline-block text-sm font-mono px-2 py-1 rounded bg-[var(--cs-surface-sunken)] text-[var(--cs-text-primary)]">
            const projection = getClimateData(2050, 'rcp85')
          </code>
        </div>
      </div>
    </Section>
  )
}

function Buttons() {
  return (
    <Section title="Buttons" icon={<Box className="h-5 w-5" />}>
      <div className="space-y-8">
        <div>
          <Eyebrow>Variants</Eyebrow>
          <div className="widget-container">
            <div className="flex flex-wrap items-center gap-4">
              <Button>Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="text">Text</Button>
              <Button variant="link">Link</Button>
            </div>
          </div>
        </div>
        <div>
          <Eyebrow>Sizes</Eyebrow>
          <div className="widget-container">
            <div className="flex flex-wrap items-center gap-4">
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
              <Button size="icon" aria-label="Sun"><Sun className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
        <div>
          <Eyebrow>States</Eyebrow>
          <div className="widget-container">
            <div className="flex flex-wrap items-center gap-4">
              <Button>Normal</Button>
              <Button disabled>Disabled</Button>
              <Button variant="primary">Primary Action</Button>
              <Button variant="success">
                <CheckCircle2 className="h-4 w-4" />
                Success
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Section>
  )
}

function FormElements() {
  const [yearValue, setYearValue] = useState([50])
  const [opacityValue, setOpacityValue] = useState([70])

  return (
    <Section title="Form Elements" icon={<Layers className="h-5 w-5" />}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <Eyebrow>Text Inputs</Eyebrow>
            <div className="widget-container space-y-4">
              <div>
                <FieldLabel>Default Input</FieldLabel>
                <Input placeholder="Enter location..." />
              </div>
              <div>
                <FieldLabel>With Value</FieldLabel>
                <Input defaultValue="New York City" />
              </div>
              <div>
                <FieldLabel>Disabled</FieldLabel>
                <Input disabled placeholder="Disabled input" />
              </div>
            </div>
          </div>

          <div>
            <Eyebrow>Select</Eyebrow>
            <div className="widget-container">
              <FieldLabel>Climate Scenario</FieldLabel>
              <Select defaultValue="rcp45">
                <SelectTrigger>
                  <SelectValue placeholder="Select scenario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rcp26">RCP 2.6 (Low)</SelectItem>
                  <SelectItem value="rcp45">RCP 4.5 (Moderate)</SelectItem>
                  <SelectItem value="rcp85">RCP 8.5 (High)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <Eyebrow>Slider</Eyebrow>
            <div className="widget-container space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <FieldLabel className="mb-0">Projection Year</FieldLabel>
                  <span className="text-sm font-medium text-[var(--cs-tone-orange-text)]">
                    {2025 + Math.round(yearValue[0] * 0.75)}
                  </span>
                </div>
                <Slider value={yearValue} onValueChange={setYearValue} min={0} max={100} step={1} />
                <div className="flex justify-between text-xs mt-1 text-[var(--cs-text-tertiary)]">
                  <span>2025</span>
                  <span>2100</span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <FieldLabel className="mb-0">Layer Opacity</FieldLabel>
                  <span className="text-sm font-medium">{Math.round(opacityValue[0])}%</span>
                </div>
                <Slider value={opacityValue} onValueChange={setOpacityValue} min={0} max={100} step={5} />
              </div>
            </div>
          </div>

          <div>
            <Eyebrow>Checkbox &amp; Radio</Eyebrow>
            <div className="widget-container space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="h-4 w-4 accent-blue-500" defaultChecked />
                <span className="text-sm">Show temperature anomaly</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="h-4 w-4 accent-blue-500" />
                <span className="text-sm">Enable auto-animation</span>
              </label>
              <div className="h-px bg-[var(--cs-divider-color)] my-2" />
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="radio" name="mode" className="h-4 w-4 accent-blue-500" defaultChecked />
                <span className="text-sm">Temperature Anomaly</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="radio" name="mode" className="h-4 w-4 accent-blue-500" />
                <span className="text-sm">Actual Temperature</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </Section>
  )
}

function Cards() {
  return (
    <Section title="Cards & Panels" icon={<Sparkles className="h-5 w-5" />}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconTile tone="sky" className="h-7 w-7 [&_svg]:h-4 [&_svg]:w-4">
                <Sun />
              </IconTile>
              Sea Level Rise
            </CardTitle>
            <CardDescription>NOAA Coastal Flood Projection</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[var(--cs-tone-sky-text)]">+3.2 ft</div>
            <p className="text-xs mt-1 text-[var(--cs-text-tertiary)]">Projected by 2100 (RCP 8.5)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconTile tone="orange" className="h-7 w-7 [&_svg]:h-4 [&_svg]:w-4">
                <AlertTriangle />
              </IconTile>
              Temperature
            </CardTitle>
            <CardDescription>Global Anomaly Projection</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[var(--cs-tone-orange-text)]">+4.8°C</div>
            <p className="text-xs mt-1 text-[var(--cs-text-tertiary)]">Above pre-industrial baseline</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconTile tone="emerald" className="h-7 w-7 [&_svg]:h-4 [&_svg]:w-4">
                <CheckCircle2 />
              </IconTile>
              Data Status
            </CardTitle>
            <CardDescription>Earth Engine Connection</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold text-[var(--cs-tone-emerald-text)]">Connected</div>
            <p className="text-xs mt-1 text-[var(--cs-text-tertiary)]">Real NASA climate data active</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <Eyebrow>Widget Container (with layer cards)</Eyebrow>
        <div className="widget-container max-w-md">
          <h4 className="text-sm font-semibold tracking-[-0.01em] mb-3">Climate Layers</h4>
          <div className="space-y-2">
            <LayerToggleCard label="Sea Level Rise" defaultChecked />
            <LayerToggleCard label="Temperature Projection" />
            <LayerToggleCard label="Precipitation" />
          </div>
        </div>
      </div>

      <div className="mt-8">
        <Eyebrow>Feature Cards (inset)</Eyebrow>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <FeatureCard title="Earth Engine">
            <p className="text-xs text-[var(--cs-text-tertiary)]">NASA Earth Engine v2.34 — 1.2s last query</p>
          </FeatureCard>
          <FeatureCard title="Tile Cache">
            <p className="text-xs text-[var(--cs-text-tertiary)]">98% hit rate · 14k tiles</p>
          </FeatureCard>
          <FeatureCard title="Region">
            <p className="text-xs text-[var(--cs-text-tertiary)]">North Atlantic Megaregion</p>
          </FeatureCard>
        </div>
      </div>
    </Section>
  )
}

function AccordionSection() {
  const [opacity, setOpacity] = useState([70])

  return (
    <Section title="Accordions" icon={<Layers className="h-5 w-5" />}>
      <div className="max-w-md space-y-3">
        <AccordionItem title="Climate Projections" defaultOpen={true}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--cs-text-tertiary)]">Scenario</span>
              <span className="text-sm font-medium">RCP 4.5</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--cs-text-tertiary)]">Year</span>
              <span className="text-sm font-medium text-[var(--cs-tone-orange-text)]">2050</span>
            </div>
          </div>
        </AccordionItem>

        <AccordionItem title="Sea Level Rise" defaultOpen={false}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--cs-text-tertiary)]">Layer Opacity</span>
              <span className="text-sm font-medium">{opacity[0]}%</span>
            </div>
            <Slider value={opacity} onValueChange={setOpacity} min={10} max={100} step={5} />
          </div>
        </AccordionItem>

        <AccordionItem title="Temperature" defaultOpen={false}>
          <p className="text-xs text-[var(--cs-text-tertiary)]">Temperature layer controls will appear here.</p>
        </AccordionItem>
      </div>
    </Section>
  )
}

function StatusIndicators() {
  return (
    <Section title="Status & Feedback" icon={<AlertCircle className="h-5 w-5" />}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <Eyebrow>Status Callouts</Eyebrow>
            <div className="widget-container space-y-4">
              <Callout status="success" title="Success" description="Operation completed successfully" />
              <Callout status="warning" title="Warning" description="Data may be outdated" />
              <Callout status="error" title="Error" description="Failed to load climate data" />
              <Callout status="info" title="Info" description="Zoom in for detailed data" />
            </div>
          </div>

          <div>
            <Eyebrow>Metric Badges</Eyebrow>
            <div className="widget-container">
              <div className="flex flex-wrap items-center gap-4">
                <Badge variant="success">+24%</Badge>
                <Badge variant="warning">RCP 4.5</Badge>
                <Badge variant="error">-7°C</Badge>
                <Badge variant="info">2050</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <Eyebrow>Loading States</Eyebrow>
            <div className="widget-container space-y-4">
              <Callout
                status="info"
                icon={<Spinner />}
                title="Loading NASA data..."
                titleClassName="text-[var(--cs-text-primary)]"
                description="Connecting to Earth Engine"
              />
              <Callout
                status="info"
                icon={<Spinner className="border-purple-500 border-t-transparent" />}
                title="Waking Render Instance..."
                titleClassName="text-[var(--cs-text-primary)]"
                description="This can take up to 60s"
                className="border-purple-500/30 bg-purple-500/10"
              />
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--cs-text-tertiary)]">Processing tiles</span>
                  <span className="font-medium">67%</span>
                </div>
                <Progress value={67} />
              </div>
            </div>
          </div>

          <div>
            <Eyebrow>Shadow Scale</Eyebrow>
            <div className="widget-container">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-[var(--cs-surface-elevated)] p-4 font-mono text-xs text-[var(--cs-text-tertiary)] shadow-[var(--cs-shadow-sm)]">--cs-shadow-sm</div>
                <div className="rounded-lg bg-[var(--cs-surface-elevated)] p-4 font-mono text-xs text-[var(--cs-text-tertiary)] shadow-[var(--cs-shadow-DEFAULT)]">--cs-shadow-DEFAULT</div>
                <div className="rounded-lg bg-[var(--cs-surface-elevated)] p-4 font-mono text-xs text-[var(--cs-text-tertiary)] shadow-[var(--cs-shadow-md)]">--cs-shadow-md</div>
                <div className="rounded-lg bg-[var(--cs-surface-elevated)] p-4 font-mono text-xs text-[var(--cs-text-tertiary)] shadow-[var(--cs-shadow-lg)]">--cs-shadow-lg</div>
                <div className="rounded-lg bg-[var(--cs-surface-elevated)] p-4 font-mono text-xs text-[var(--cs-text-tertiary)] shadow-[var(--cs-shadow-panel)]">--cs-shadow-panel</div>
                <div className="rounded-lg bg-[var(--cs-surface-elevated)] p-4 font-mono text-xs text-[var(--cs-text-tertiary)] shadow-[var(--cs-glow-md)] border border-[rgba(67,126,252,0.3)]">--cs-glow-md</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  )
}

function DataVizGradients() {
  return (
    <Section title="Data Visualization Gradients" icon={<Palette className="h-5 w-5" />}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="widget-container space-y-3">
          <h4 className="text-sm font-semibold tracking-[-0.01em]">Temperature Anomaly</h4>
          <GradientBar gradient={climateGradients.tempAnomaly} />
          <div className="flex justify-between text-xs text-[var(--cs-text-tertiary)]">
            <span>0°C</span><span>2°C</span><span>4°C</span><span>6°C</span><span>8°C+</span>
          </div>
        </div>
        <div className="widget-container space-y-3">
          <h4 className="text-sm font-semibold tracking-[-0.01em]">Actual Temperature</h4>
          <GradientBar gradient={climateGradients.tempActual} />
          <div className="flex justify-between text-xs text-[var(--cs-text-tertiary)]">
            <span>10°</span><span>20°</span><span>30°</span><span>40°+</span>
          </div>
        </div>
        <div className="widget-container space-y-3">
          <h4 className="text-sm font-semibold tracking-[-0.01em]">Precipitation</h4>
          <GradientBar gradient={climateGradients.precip} />
          <div className="flex justify-between text-xs text-[var(--cs-text-tertiary)]">
            <span>0</span><span>2</span><span>4</span><span>6</span><span>10 mm/day</span>
          </div>
        </div>
        <div className="widget-container space-y-3">
          <h4 className="text-sm font-semibold tracking-[-0.01em]">Population Growth</h4>
          <GradientBar gradient={climateGradients.population} />
          <div className="flex justify-between text-xs text-[var(--cs-text-tertiary)]">
            <span>-5%</span><span>0%</span><span>+5%</span><span>+10%</span>
          </div>
        </div>
      </div>
    </Section>
  )
}

/* ──────────────────── Climate Layer Composition section ──────────────────── */

interface PaletteLayer {
  id: string
  title: string
  source: string
  tone: IconTileTone
  icon: React.ReactNode
}

const paletteLayers: PaletteLayer[] = [
  { id: 'sea_level_rise', title: 'Sea Level Rise', source: 'Source: NOAA Sea Level Rise Viewer', tone: 'sky', icon: <WaveIcon /> },
  { id: 'urban_heat_island', title: 'Urban Heat Island', source: 'Source: Yale YCEO Summer UHI v4', tone: 'orange', icon: <HeatIcon /> },
  { id: 'temperature_projection', title: 'Future Temperature Anomaly', source: 'Source: NASA NEX-GDDP-CMIP6', tone: 'amber', icon: <WeatherIcon /> },
  { id: 'precipitation_drought', title: 'Precipitation & Drought', source: 'Source: CHIRPS via Earth Engine', tone: 'violet', icon: <DropIcon /> },
  { id: 'topographic_relief', title: 'Topographic Relief', source: 'Source: Copernicus DEM', tone: 'stone', icon: <MountainIcon /> },
  { id: 'megaregion_timeseries', title: 'Metro Data Statistics', source: 'Source: US Census + NASA', tone: 'emerald', icon: <PopulationIcon /> },
  { id: 'wet_bulb', title: 'Wet Bulb Temperature', source: 'Source: NASA NEX-GDDP-CMIP6', tone: 'orange', icon: <HeatIcon /> },
]

function LayerPaletteDemo() {
  const [visibleIds, setVisibleIds] = useState<Set<string>>(
    () => new Set(['sea_level_rise', 'urban_heat_island', 'topographic_relief', 'precipitation_drought'])
  )
  const [activeIds, setActiveIds] = useState<Set<string>>(
    () => new Set(['sea_level_rise', 'urban_heat_island'])
  )
  const [showSources, setShowSources] = useState(true)

  const displayedLayers = paletteLayers.filter(l => visibleIds.has(l.id))
  const allActive = displayedLayers.length > 0 && displayedLayers.every(l => activeIds.has(l.id))

  const toggleVisible = (id: string) => {
    setVisibleIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleActive = (id: string) => {
    setActiveIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAll = (checked: boolean) => {
    setActiveIds(checked ? new Set(displayedLayers.map(l => l.id)) : new Set())
  }

  return (
    <div className="widget-container widget-container-no-padding max-w-[480px]">
      <div className="flex items-center justify-between px-4 pt-4">
        <h3 className="text-sm font-semibold text-[var(--cs-text-primary)]">Layers</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex h-7 items-center gap-0.5 rounded-md border-0 bg-transparent px-2 text-xs text-[var(--cs-text-secondary)] transition-colors hover:bg-[var(--cs-interactive-hover)]">
              Manage Layers
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            {paletteLayers.map(layer => (
              <DropdownMenuCheckboxItem
                key={layer.id}
                checked={visibleIds.has(layer.id)}
                onCheckedChange={() => toggleVisible(layer.id)}
              >
                {layer.title}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-col gap-2 border-b border-[var(--widget-border)] px-4 pb-3 pt-3">
        {displayedLayers.map(layer => (
          <LayerRow
            key={layer.id}
            icon={<IconTile tone={layer.tone} size="md">{layer.icon}</IconTile>}
            title={layer.title}
            source={layer.source}
            showSource={showSources}
            active={activeIds.has(layer.id)}
            onClick={() => toggleActive(layer.id)}
            onSettings={() => {}}
            onRemove={() => toggleVisible(layer.id)}
          />
        ))}
      </div>

      <div className="flex items-center justify-between px-4 pb-4 pt-3">
        <label className="flex cursor-pointer items-center gap-3 text-xs font-medium">
          <input
            type="checkbox"
            className="h-4 w-4 accent-blue-500"
            checked={allActive}
            onChange={e => handleSelectAll(e.target.checked)}
          />
          Select All
        </label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--cs-text-tertiary)]">Sources</span>
          <Switch checked={showSources} onCheckedChange={setShowSources} />
        </div>
      </div>
    </div>
  )
}

type Scenario = 'rcp26' | 'rcp45' | 'rcp85'

const tempBands: Record<Scenario, [number, number]> = { rcp26: [1.0, 1.0], rcp45: [1.5, 1.7], rcp85: [2.0, 2.8] }
const precipBands: Record<Scenario, number> = { rcp26: 20, rcp45: 50, rcp85: 100 }
const droughtBands: Record<Scenario, number> = { rcp26: 0.1, rcp45: 0.3, rcp85: 0.5 }
const soilBands: Record<Scenario, number> = { rcp26: 5, rcp45: 10, rcp85: 15 }

function GlobalControlsDemo() {
  const [scenario, setScenario] = useState<Scenario>('rcp45')
  const [year, setYear] = useState([2050])

  const y = year[0]
  const yp = (y - 2025) / (2100 - 2025)
  const feet = y <= 2025 ? 1 : y >= 2100 ? 10 : Math.round(1 + yp * 9)
  const [t0, dt] = tempBands[scenario]
  const anomaly = t0 + yp * dt
  const actual = 14.5 + anomaly
  const precip = 800 + yp * precipBands[scenario]
  const drought = 1.0 + yp * droughtBands[scenario]
  const soil = 60 - yp * soilBands[scenario]

  return (
    <div className="widget-container">
      <div className="flex flex-col gap-5">
        <div>
          <FieldLabel>Climate Scenario</FieldLabel>
          <Select value={scenario} onValueChange={v => setScenario(v as Scenario)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rcp26">RCP 2.6 (Low)</SelectItem>
              <SelectItem value="rcp45">RCP 4.5 (Moderate)</SelectItem>
              <SelectItem value="rcp85">RCP 8.5 (High)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <FieldLabel className="mb-0">Projection Year</FieldLabel>
            <span className="text-sm font-medium text-[var(--cs-tone-orange-text)]">{y}</span>
          </div>
          <Slider value={year} onValueChange={setYear} min={2025} max={2100} step={5} />
          <div className="mt-1 flex justify-between text-xs text-[var(--cs-text-tertiary)]">
            <span>2025</span>
            <span>2100</span>
          </div>

          <ImpactGrid className="mt-3.5">
            <ImpactMetric label="Sea Level Rise" value={`~${feet} ft`} tone="sky" />
            <ImpactMetric label="Temp. Anomaly" value={`+${anomaly.toFixed(1)}°C`} tone="orange" />
            <ImpactMetric label="Actual Temp." value={`${actual.toFixed(1)}°C`} tone="red" />
            <ImpactMetric label="Precipitation" value={`${precip.toFixed(0)} mm`} tone="blue" />
            <ImpactMetric label="Drought Index" value={drought.toFixed(1)} tone="yellow" />
            <ImpactMetric label="Soil Moisture" value={`${soil.toFixed(0)}%`} tone="green" />
          </ImpactGrid>
        </div>
      </div>
    </div>
  )
}

function OpacityControl({ defaultValue }: { defaultValue: number }) {
  const [value, setValue] = useState([defaultValue])
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between">
        <ControlLabel>Layer Opacity</ControlLabel>
        <span className="text-[11px] font-medium text-[var(--cs-text-primary)]">{value[0]}%</span>
      </div>
      <Slider value={value} onValueChange={setValue} min={10} max={100} step={5} />
    </div>
  )
}

function PerLayerControls() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <AccordionItem
        title="Urban Heat Island"
        defaultOpen={true}
        icon={<IconTile tone="orange" size="sm"><HeatIcon /></IconTile>}
      >
        <div className="flex flex-col gap-2">
          <ControlLabel>Season</ControlLabel>
          <Select defaultValue="summer">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="summer">Summer (Jun-Aug)</SelectItem>
              <SelectItem value="winter">Winter (Dec-Feb)</SelectItem>
              <SelectItem value="annual">Annual Average</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <ControlLabel>Color Scheme</ControlLabel>
          <Select defaultValue="temp">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="temp">Temperature (Blue-Red)</SelectItem>
              <SelectItem value="heat">Heat Intensity</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <OpacityControl defaultValue={70} />
      </AccordionItem>

      <AccordionItem
        title="Topographic Relief"
        defaultOpen={true}
        icon={<IconTile tone="stone" size="sm"><MountainIcon /></IconTile>}
      >
        <div className="flex flex-col gap-2">
          <ControlLabel>Hillshade Style</ControlLabel>
          <Select defaultValue="dramatic">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dramatic">Dramatic Shadows</SelectItem>
              <SelectItem value="subtle">Subtle Shading</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <OpacityControl defaultValue={60} />
      </AccordionItem>

      <AccordionItem
        title="Future Temperature Anomaly"
        defaultOpen={false}
        icon={<IconTile tone="orange" size="sm"><WeatherIcon /></IconTile>}
      >
        <div className="flex flex-col gap-2">
          <ControlLabel>Temperature Display</ControlLabel>
          <div className="flex flex-col gap-2">
            <label className="flex cursor-pointer items-center gap-3 text-xs">
              <input type="radio" name="tempMode" className="h-4 w-4 accent-blue-500" defaultChecked />
              Temperature Anomaly (Change)
            </label>
            <label className="flex cursor-pointer items-center gap-3 text-xs">
              <input type="radio" name="tempMode" className="h-4 w-4 accent-blue-500" />
              Actual Temperature
            </label>
          </div>
        </div>
        <OpacityControl defaultValue={60} />
      </AccordionItem>

      <AccordionItem
        title="Precipitation & Drought"
        defaultOpen={false}
        icon={<IconTile tone="violet" size="sm"><DropIcon /></IconTile>}
      >
        <div className="flex flex-col gap-2">
          <ControlLabel>Metric Type</ControlLabel>
          <Select defaultValue="drought">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="drought">Drought Index</SelectItem>
              <SelectItem value="precip">Precipitation</SelectItem>
              <SelectItem value="soil">Soil Moisture</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <OpacityControl defaultValue={75} />
      </AccordionItem>
    </div>
  )
}

const iconSet = [
  { label: 'WaveIcon', use: 'sea level · precipitation', tone: 'sky' as const, icon: <WaveIcon /> },
  { label: 'HeatIcon', use: 'urban heat · wet bulb', tone: 'orange' as const, icon: <HeatIcon /> },
  { label: 'MountainIcon', use: 'topographic relief', tone: 'stone' as const, icon: <MountainIcon /> },
  { label: 'WeatherIcon', use: 'temperature projection', tone: 'amber' as const, icon: <WeatherIcon /> },
  { label: 'DropIcon', use: 'groundwater (hidden)', tone: 'violet' as const, icon: <DropIcon /> },
  { label: 'PopulationIcon', use: 'metro / megaregion', tone: 'emerald' as const, icon: <PopulationIcon /> },
]

function LayerComposition() {
  return (
    <Section title="Climate Layer Composition" icon={<Layers className="h-5 w-5" />}>
      <p className="mb-6 max-w-3xl text-[15px] leading-relaxed text-[var(--cs-text-secondary)]">
        Everything above is the foundation. The Studio's real layer UI is composed from a registry of 7
        climate layers, each declaring its own control set, that resolves through a switch to the
        primitives above.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <Eyebrow>Layer Palette</Eyebrow>
          <LayerPaletteDemo />
        </div>
        <div>
          <Eyebrow>Global Controls + Climate Impact Metrics</Eyebrow>
          <GlobalControlsDemo />
        </div>
      </div>

      <Eyebrow className="mt-10">Per-Layer Control Matrix (Accordion Stack)</Eyebrow>
      <PerLayerControls />

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <Eyebrow>Legend / Colorbar (4 variants)</Eyebrow>
          <div className="widget-container space-y-3.5">
            <LegendRow title="Precipitation" gradient={climateGradients.precipLegend} range="0 – 10 mm/day" />
            <LegendRow title="Drought Index" gradient={climateGradients.drought} range="−2 (dry) to +2 (wet)" />
            <LegendRow title="Soil Moisture" gradient={climateGradients.soil} range="0 – 10 mm" />
            <LegendRow title="Population Growth Rate" gradient={climateGradients.population} range="−5% (decline) to +10% (growth)" />
          </div>
        </div>

        <div>
          <Eyebrow>Layer Status States</Eyebrow>
          <div className="widget-container space-y-2.5">
            <LayerStatus status="loading" title="Loading…" sub="Sea Level Rise — Connecting to NOAA" />
            <LayerStatus status="success" title="Real NASA data (1,248 features)" sub="Future Temperature Anomaly · NEX-GDDP-CMIP6" />
            <LayerStatus status="fallback" title="Fallback data (Earth Engine timeout)" sub="Precipitation & Drought · CHIRPS" />
            <LayerStatus status="error" title="Error: HTTP 503 — service unavailable" sub="Urban Heat Island · Yale YCEO" />
          </div>

          <Eyebrow className="mt-6">Error Overlay (modal)</Eyebrow>
          <ErrorOverlay
            layerName="Sea Level Rise"
            message="Network timeout after 30s — try again or dismiss for this session."
            onRefresh={() => {}}
            onDismiss={() => {}}
          />
        </div>
      </div>

      <Eyebrow className="mt-10">Layer Icon Set</Eyebrow>
      <div className="widget-container">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3.5">
          {iconSet.map(item => (
            <div
              key={item.label}
              className="flex flex-col items-center gap-1.5 rounded-lg border border-[var(--cs-feature-card-border)] bg-[var(--cs-feature-card-background)] p-2.5 text-center [backdrop-filter:var(--cs-feature-card-blur)] [-webkit-backdrop-filter:var(--cs-feature-card-blur)]"
            >
              <IconTile tone={item.tone} size="lg">{item.icon}</IconTile>
              <div className="font-mono text-xs font-semibold">{item.label}</div>
              <div className="text-[11px] text-[var(--cs-text-tertiary)]">{item.use}</div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}

/* ────────────────────────────────── Page ────────────────────────────────── */

export default function DesignSystemPage() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))
  }

  return (
    <div
      className="cs-canvas h-full w-full overflow-y-auto text-[var(--cs-text-primary)]"
      data-theme={theme}
    >
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[var(--widget-border)] bg-[color-mix(in_srgb,var(--cs-surface-base)_80%,transparent)] backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--cs-brand-primary)]">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.36 17.36 0 01-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Climate Studio</h1>
                <p className="text-sm text-[var(--cs-text-tertiary)]">Design System Demo • v1.0</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-[var(--cs-text-tertiary)]">
                {theme === 'light' ? 'Light' : 'Dark'}
              </span>
              <ThemeToggle theme={theme} onToggle={toggleTheme} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 py-12">
        {/* Intro */}
        <div className="mb-16">
          <div className="max-w-2xl">
            <h2 className="mb-4 text-4xl font-bold tracking-tight">Design System</h2>
            <p className="text-lg leading-relaxed text-[var(--cs-text-secondary)]">
              A comprehensive collection of design tokens, components, and patterns that power the
              Climate Studio interface. Built for consistency, accessibility, and beautiful data visualization.
            </p>
          </div>

          {/* Theme indicator badge — content is theme-dependent by definition */}
          <div
            className={`mt-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
              theme === 'light' ? 'bg-amber-100 text-amber-800' : 'bg-blue-500/20 text-blue-300'
            }`}
          >
            {theme === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            Currently viewing: {theme === 'light' ? 'Light Theme' : 'Dark Theme'}
          </div>
        </div>

        <ColorPalette />
        <Typography />
        <Buttons />
        <FormElements />
        <Cards />
        <AccordionSection />
        <StatusIndicators />
        <DataVizGradients />
        <LayerComposition />

        {/* Footer */}
        <footer className="mt-16 border-t border-[var(--widget-border)] pt-8 text-center">
          <p className="text-sm text-[var(--cs-text-tertiary)]">
            Climate Studio Design System • Generated from{' '}
            <code className="font-mono">tokens.css</code> and the{' '}
            <code className="font-mono">components/ui</code> primitives
          </p>
        </footer>
      </main>
    </div>
  )
}
