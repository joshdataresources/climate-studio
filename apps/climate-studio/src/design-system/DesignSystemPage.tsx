/**
 * Climate Studio Design System
 * ============================
 * A comprehensive showcase of all design tokens, components, and patterns.
 * Access this page at /design-system (hidden from main navigation).
 */

import React, { useState } from 'react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Slider } from '../components/ui/slider'
import { AccordionItem } from '../components/ui/accordion'
import { 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  AlertTriangle,
  Palette,
  Type,
  Box,
  Layers,
  Sparkles,
  Sun,
  Moon,
  Copy,
  Check
} from 'lucide-react'

interface ColorSwatchProps {
  name: string
  variable: string
  value: string
  theme?: 'dark' | 'light'
}

function ColorSwatch({ name, variable, value, theme = 'dark' }: ColorSwatchProps) {
  const [copied, setCopied] = useState(false)
  
  const handleCopy = () => {
    navigator.clipboard.writeText(variable)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  return (
    <div className={`group flex items-center gap-3 p-2 rounded-lg transition-colors ${
      theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/5'
    }`}>
      <div 
        className={`w-12 h-12 rounded-lg shadow-sm flex-shrink-0 ${
          theme === 'light' ? 'border border-slate-200' : 'border border-white/20'
        }`}
        style={{ backgroundColor: value }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{name}</div>
        <div className={`text-xs font-mono truncate ${
          theme === 'light' ? 'text-slate-500' : 'text-muted-foreground'
        }`}>{variable}</div>
      </div>
      <button
        onClick={handleCopy}
        className={`opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-md ${
          theme === 'light' ? 'hover:bg-slate-200' : 'hover:bg-white/10'
        }`}
      >
        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  )
}

interface SectionProps {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  theme?: 'dark' | 'light'
}

function Section({ title, icon, children, theme = 'dark' }: SectionProps) {
  return (
    <section className="mb-12">
      <div className={`flex items-center gap-3 mb-6 pb-3 border-b ${
        theme === 'light' ? 'border-slate-200' : 'border-white/10'
      }`}>
        <div className={`p-2 rounded-lg ${
          theme === 'light' 
            ? 'bg-[#437efc]/10 text-[#437efc]' 
            : 'bg-[#437efc]/20 text-[#437efc]'
        }`}>
          {icon}
        </div>
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  )
}

interface LayerCheckboxProps {
  label: string
  defaultChecked?: boolean
  theme?: 'dark' | 'light'
}

function LayerCheckbox({ label, defaultChecked = false, theme = 'dark' }: LayerCheckboxProps) {
  const [checked, setChecked] = useState(defaultChecked)
  
  const getClassName = () => {
    if (theme === 'light') {
      return checked 
        ? 'border-blue-500 bg-blue-50' 
        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
    }
    return checked 
      ? 'border-blue-500/60 bg-blue-500/10' 
      : 'border-border/60 bg-muted/20 hover:bg-muted/40'
  }
  
  return (
    <label className={`
      flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all duration-200
      ${getClassName()}
    `}>
      <input 
        type="checkbox" 
        className="h-4 w-4 accent-blue-500" 
        checked={checked}
        onChange={(e) => setChecked(e.target.checked)}
      />
      <span className="text-sm font-medium">{label}</span>
    </label>
  )
}

function ColorPalette({ theme = 'dark' }: { theme?: 'dark' | 'light' }) {
  const neutralColors = theme === 'light' ? [
    { name: 'Neutral 1000', variable: '--cs-surface-elevated', value: '#ffffff' },
    { name: 'Neutral 950', variable: '--cs-surface-base', value: '#f8fafc' },
    { name: 'Neutral 900', variable: '--cs-surface-sunken', value: '#f1f5f9' },
    { name: 'Neutral 800', variable: '--cs-border-default', value: '#e2e8f0' },
    { name: 'Neutral 600', variable: '--cs-text-disabled', value: '#94a3b8' },
    { name: 'Neutral 500', variable: '--cs-text-tertiary', value: '#64748b' },
    { name: 'Neutral 400', variable: '--cs-text-secondary', value: '#475569' },
    { name: 'Neutral 100', variable: '--cs-text-primary', value: '#0f172a' },
  ] : [
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
    { name: 'Success', variable: '--cs-success-400', value: theme === 'light' ? '#059669' : '#10b981' },
    { name: 'Warning', variable: '--cs-warning-400', value: theme === 'light' ? '#d97706' : '#f59e0b' },
    { name: 'Error', variable: '--cs-error-400', value: theme === 'light' ? '#dc2626' : '#ef4444' },
    { name: 'Info', variable: '--cs-info-400', value: theme === 'light' ? '#2563eb' : '#3b82f6' },
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
  
  const widgetClass = theme === 'light' 
    ? 'bg-white rounded-xl border border-slate-200 p-4 shadow-sm' 
    : 'widget-container'
  const labelClass = theme === 'light' 
    ? 'text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3' 
    : 'text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3'
  
  return (
    <Section title="Color System" icon={<Palette className="h-5 w-5" />} theme={theme}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <h3 className={labelClass}>Neutral Scale</h3>
            <div className={`${widgetClass} space-y-1`}>
              {neutralColors.map(color => (
                <ColorSwatch key={color.variable} {...color} theme={theme} />
              ))}
            </div>
          </div>
          
          <div>
            <h3 className={labelClass}>Brand Colors</h3>
            <div className={`${widgetClass} space-y-1`}>
              {brandColors.map(color => (
                <ColorSwatch key={color.variable} {...color} theme={theme} />
              ))}
            </div>
          </div>
        </div>
        
        <div className="space-y-6">
          <div>
            <h3 className={labelClass}>Semantic Colors</h3>
            <div className={`${widgetClass} space-y-1`}>
              {semanticColors.map(color => (
                <ColorSwatch key={color.variable} {...color} theme={theme} />
              ))}
            </div>
          </div>
          
          <div>
            <h3 className={labelClass}>Data Visualization</h3>
            <div className={`${widgetClass} space-y-1`}>
              {dataVizColors.map(color => (
                <ColorSwatch key={color.variable} {...color} theme={theme} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Section>
  )
}

function Typography({ theme = 'dark' }: { theme?: 'dark' | 'light' }) {
  const widgetClass = theme === 'light' 
    ? 'bg-white rounded-xl border border-slate-200 p-6 shadow-sm' 
    : 'widget-container'
  const labelClass = theme === 'light' 
    ? 'text-xs text-slate-500 uppercase tracking-wider' 
    : 'text-xs text-muted-foreground uppercase tracking-wider'
  const captionClass = theme === 'light'
    ? 'text-xs text-slate-500'
    : 'text-xs text-muted-foreground'
  const codeClass = theme === 'light'
    ? 'text-sm font-mono bg-slate-100 px-2 py-1 rounded text-slate-800'
    : 'text-sm font-mono bg-neutral-800 px-2 py-1 rounded'
    
  return (
    <Section title="Typography" icon={<Type className="h-5 w-5" />} theme={theme}>
      <div className={`${widgetClass} space-y-6`}>
        <div>
          <span className={labelClass}>Display</span>
          <p className="text-4xl font-bold tracking-tight">Climate Studio</p>
        </div>
        <div>
          <span className={labelClass}>Heading 1</span>
          <p className="text-3xl font-bold">Sea Level Rise Analysis</p>
        </div>
        <div>
          <span className={labelClass}>Heading 2</span>
          <p className="text-2xl font-semibold">Temperature Projections</p>
        </div>
        <div>
          <span className={labelClass}>Heading 3</span>
          <p className="text-xl font-semibold">Urban Heat Island</p>
        </div>
        <div>
          <span className={labelClass}>Body Large</span>
          <p className="text-base">Analyze climate data across multiple dimensions with real-time NASA Earth Engine integration.</p>
        </div>
        <div>
          <span className={labelClass}>Body</span>
          <p className="text-sm">The projected temperature anomaly for RCP 8.5 scenario shows significant warming trends in urban centers.</p>
        </div>
        <div>
          <span className={labelClass}>Caption</span>
          <p className={captionClass}>Source: NASA Global Climate Modeling • Last updated: Dec 2025</p>
        </div>
        <div>
          <span className={labelClass}>Code</span>
          <code className={codeClass}>const projection = getClimateData(2050, 'rcp85')</code>
        </div>
      </div>
    </Section>
  )
}

function Buttons({ theme = 'dark' }: { theme?: 'dark' | 'light' }) {
  const widgetClass = theme === 'light' 
    ? 'bg-white rounded-xl border border-slate-200 p-4 shadow-sm' 
    : 'widget-container'
  const labelClass = theme === 'light' 
    ? 'text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4' 
    : 'text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4'
    
  return (
    <Section title="Buttons" icon={<Box className="h-5 w-5" />} theme={theme}>
      <div className="space-y-8">
        <div>
          <h3 className={labelClass}>Variants</h3>
          <div className={widgetClass}>
            <div className="flex flex-wrap gap-4">
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
          <h3 className={labelClass}>Sizes</h3>
          <div className={widgetClass}>
            <div className="flex flex-wrap items-center gap-4">
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
              <Button size="icon"><Sun className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
        
        <div>
          <h3 className={labelClass}>States</h3>
          <div className={widgetClass}>
            <div className="flex flex-wrap gap-4">
              <Button>Normal</Button>
              <Button disabled>Disabled</Button>
              <Button className="bg-blue-500 hover:bg-blue-600 text-white">Primary Action</Button>
              <Button className="bg-green-600 hover:bg-green-700 text-white">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Success
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Section>
  )
}

function FormElements({ theme = 'dark' }: { theme?: 'dark' | 'light' }) {
  const [sliderValue, setSliderValue] = useState([50])
  
  const widgetClass = theme === 'light' 
    ? 'bg-white rounded-xl border border-slate-200 p-4 shadow-sm' 
    : 'widget-container'
  const labelClass = theme === 'light' 
    ? 'text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4' 
    : 'text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4'
  const inputLabelClass = theme === 'light'
    ? 'text-xs font-medium text-slate-500 mb-1 block'
    : 'text-xs font-medium text-muted-foreground mb-1 block'
  const dividerClass = theme === 'light' ? 'h-px bg-slate-200 my-2' : 'h-px bg-white/10 my-2'
  
  return (
    <Section title="Form Elements" icon={<Layers className="h-5 w-5" />} theme={theme}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <h3 className={labelClass}>Text Inputs</h3>
            <div className={`${widgetClass} space-y-4`}>
              <div>
                <label className={inputLabelClass}>Default Input</label>
                <Input placeholder="Enter location..." className={theme === 'light' ? 'bg-slate-50 border-slate-200' : ''} />
              </div>
              <div>
                <label className={inputLabelClass}>With Value</label>
                <Input defaultValue="New York City" className={theme === 'light' ? 'bg-slate-50 border-slate-200' : ''} />
              </div>
              <div>
                <label className={inputLabelClass}>Disabled</label>
                <Input disabled placeholder="Disabled input" className={theme === 'light' ? 'bg-slate-100 border-slate-200' : ''} />
              </div>
            </div>
          </div>
          
          <div>
            <h3 className={labelClass}>Select</h3>
            <div className={`${widgetClass} space-y-4`}>
              <div>
                <label className={inputLabelClass}>Climate Scenario</label>
                <Select defaultValue="rcp45">
                  <SelectTrigger className={theme === 'light' ? 'bg-slate-50 border-slate-200' : ''}>
                    <SelectValue placeholder="Select scenario" />
                  </SelectTrigger>
                  <SelectContent className={theme === 'light' ? 'bg-white border-slate-200' : ''}>
                    <SelectItem value="rcp26">RCP 2.6 (Low)</SelectItem>
                    <SelectItem value="rcp45">RCP 4.5 (Moderate)</SelectItem>
                    <SelectItem value="rcp85">RCP 8.5 (High)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
        
        <div className="space-y-6">
          <div>
            <h3 className={labelClass}>Slider</h3>
            <div className={`${widgetClass} space-y-4`}>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={inputLabelClass}>Projection Year</label>
                  <span className={`text-sm font-medium ${theme === 'light' ? 'text-orange-600' : 'text-orange-400'}`}>
                    {2025 + Math.round(sliderValue[0] * 0.75)}
                  </span>
                </div>
                <Slider 
                  value={sliderValue} 
                  onValueChange={setSliderValue}
                  min={0}
                  max={100}
                  step={1}
                />
                <div className={`flex justify-between text-xs mt-1 ${theme === 'light' ? 'text-slate-500' : 'text-muted-foreground'}`}>
                  <span>2025</span>
                  <span>2100</span>
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={inputLabelClass}>Layer Opacity</label>
                  <span className="text-sm font-medium">{Math.round(sliderValue[0])}%</span>
                </div>
                <Slider 
                  value={sliderValue} 
                  onValueChange={setSliderValue}
                  min={0}
                  max={100}
                  step={5}
                />
              </div>
            </div>
          </div>
          
          <div>
            <h3 className={labelClass}>Checkbox & Radio</h3>
            <div className={`${widgetClass} space-y-3`}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="h-4 w-4 accent-blue-500 rounded" defaultChecked />
                <span className="text-sm">Show temperature anomaly</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="h-4 w-4 accent-blue-500 rounded" />
                <span className="text-sm">Enable auto-animation</span>
              </label>
              <div className={dividerClass} />
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

function Cards({ theme = 'dark' }: { theme?: 'dark' | 'light' }) {
  const cardClass = theme === 'light' 
    ? 'bg-white border border-slate-200 shadow-sm' 
    : 'bg-card/50 backdrop-blur'
  const descClass = theme === 'light' ? 'text-slate-500' : ''
  const labelClass = theme === 'light' 
    ? 'text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4' 
    : 'text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4'
  const widgetClass = theme === 'light' 
    ? 'bg-white rounded-xl border border-slate-200 p-4 shadow-sm max-w-md' 
    : 'widget-container max-w-md'
    
  return (
    <Section title="Cards & Panels" icon={<Sparkles className="h-5 w-5" />} theme={theme}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className={cardClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-sky-500/20">
                <Sun className={`h-4 w-4 ${theme === 'light' ? 'text-sky-600' : 'text-sky-400'}`} />
              </div>
              Sea Level Rise
            </CardTitle>
            <CardDescription className={descClass}>NOAA Coastal Flood Projection</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${theme === 'light' ? 'text-sky-600' : 'text-sky-400'}`}>+3.2 ft</div>
            <p className={`text-xs mt-1 ${theme === 'light' ? 'text-slate-500' : 'text-muted-foreground'}`}>Projected by 2100 (RCP 8.5)</p>
          </CardContent>
        </Card>
        
        <Card className={cardClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-orange-500/20">
                <AlertTriangle className={`h-4 w-4 ${theme === 'light' ? 'text-orange-600' : 'text-orange-400'}`} />
              </div>
              Temperature
            </CardTitle>
            <CardDescription className={descClass}>Global Anomaly Projection</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${theme === 'light' ? 'text-orange-600' : 'text-orange-400'}`}>+4.8°C</div>
            <p className={`text-xs mt-1 ${theme === 'light' ? 'text-slate-500' : 'text-muted-foreground'}`}>Above pre-industrial baseline</p>
          </CardContent>
        </Card>
        
        <Card className={cardClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-emerald-500/20">
                <CheckCircle2 className={`h-4 w-4 ${theme === 'light' ? 'text-emerald-600' : 'text-emerald-400'}`} />
              </div>
              Data Status
            </CardTitle>
            <CardDescription className={descClass}>Earth Engine Connection</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-lg font-semibold ${theme === 'light' ? 'text-emerald-600' : 'text-emerald-400'}`}>Connected</div>
            <p className={`text-xs mt-1 ${theme === 'light' ? 'text-slate-500' : 'text-muted-foreground'}`}>Real NASA climate data active</p>
          </CardContent>
        </Card>
      </div>
      
      <div className="mt-8">
        <h3 className={labelClass}>Widget Container</h3>
        <div className={widgetClass}>
          <h4 className="text-sm font-semibold mb-3">Climate Layers</h4>
          <div className="space-y-2">
            <LayerCheckbox label="Sea Level Rise" defaultChecked theme={theme} />
            <LayerCheckbox label="Temperature Projection" theme={theme} />
          </div>
        </div>
      </div>
    </Section>
  )
}

function StatusIndicators({ theme = 'dark' }: { theme?: 'dark' | 'light' }) {
  const widgetClass = theme === 'light' 
    ? 'bg-white rounded-xl border border-slate-200 p-4 shadow-sm' 
    : 'widget-container'
  const labelClass = theme === 'light' 
    ? 'text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4' 
    : 'text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4'
  const mutedClass = theme === 'light' ? 'text-slate-500' : 'text-muted-foreground'
  const progressBgClass = theme === 'light' ? 'bg-slate-200' : 'bg-white/10'
  
  return (
    <Section title="Status & Feedback" icon={<AlertCircle className="h-5 w-5" />} theme={theme}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h3 className={labelClass}>Status Badges</h3>
          <div className={`${widgetClass} space-y-4`}>
            <div className={`flex items-center gap-3 p-3 rounded-lg border ${theme === 'light' ? 'border-green-200 bg-green-50' : 'border-green-500/30 bg-green-500/10'}`}>
              <div className="p-1 rounded-full bg-green-500">
                <CheckCircle2 className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className={`text-sm font-medium ${theme === 'light' ? 'text-green-700' : 'text-green-400'}`}>Success</p>
                <p className={`text-xs ${mutedClass}`}>Operation completed successfully</p>
              </div>
            </div>
            
            <div className={`flex items-center gap-3 p-3 rounded-lg border ${theme === 'light' ? 'border-yellow-200 bg-yellow-50' : 'border-yellow-500/30 bg-yellow-500/10'}`}>
              <div className="p-1 rounded-full bg-yellow-500">
                <AlertTriangle className="h-4 w-4 text-black" />
              </div>
              <div>
                <p className={`text-sm font-medium ${theme === 'light' ? 'text-yellow-700' : 'text-yellow-400'}`}>Warning</p>
                <p className={`text-xs ${mutedClass}`}>Data may be outdated</p>
              </div>
            </div>
            
            <div className={`flex items-center gap-3 p-3 rounded-lg border ${theme === 'light' ? 'border-red-200 bg-red-50' : 'border-red-500/30 bg-red-500/10'}`}>
              <div className="p-1 rounded-full bg-red-500">
                <AlertCircle className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className={`text-sm font-medium ${theme === 'light' ? 'text-red-700' : 'text-red-400'}`}>Error</p>
                <p className={`text-xs ${mutedClass}`}>Failed to load climate data</p>
              </div>
            </div>
            
            <div className={`flex items-center gap-3 p-3 rounded-lg border ${theme === 'light' ? 'border-blue-200 bg-blue-50' : 'border-blue-500/30 bg-blue-500/10'}`}>
              <div className="p-1 rounded-full bg-blue-500">
                <Info className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className={`text-sm font-medium ${theme === 'light' ? 'text-blue-700' : 'text-blue-400'}`}>Info</p>
                <p className={`text-xs ${mutedClass}`}>Zoom in for detailed data</p>
              </div>
            </div>
          </div>
        </div>
        
        <div>
          <h3 className={labelClass}>Loading States</h3>
          <div className={`${widgetClass} space-y-4`}>
            <div className={`flex items-center gap-3 p-3 rounded-lg border ${theme === 'light' ? 'border-blue-200 bg-blue-50' : 'border-blue-500/30 bg-blue-500/10'}`}>
              <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <div>
                <p className="text-sm font-medium">Loading NASA data...</p>
                <p className={`text-xs ${mutedClass}`}>Connecting to Earth Engine</p>
              </div>
            </div>
            
            <div className={`flex items-center gap-3 p-3 rounded-lg border ${theme === 'light' ? 'border-purple-200 bg-purple-50' : 'border-purple-500/30 bg-purple-500/10'}`}>
              <div className="h-5 w-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <div>
                <p className="text-sm font-medium">Waking Render Instance...</p>
                <p className={`text-xs ${mutedClass}`}>This can take up to 60s</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className={mutedClass}>Processing tiles</span>
                <span className="font-medium">67%</span>
              </div>
              <div className={`h-2 ${progressBgClass} rounded-full overflow-hidden`}>
                <div className="h-full w-2/3 bg-blue-500 rounded-full transition-all duration-300" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  )
}

function AccordionSection({ theme = 'dark' }: { theme?: 'dark' | 'light' }) {
  const widgetClass = theme === 'light' 
    ? 'widget-container-no-padding overflow-hidden bg-white border border-slate-200 shadow-sm' 
    : 'widget-container widget-container-no-padding overflow-hidden'
  const mutedClass = theme === 'light' ? 'text-slate-500' : 'text-muted-foreground'
  
  return (
    <Section title="Accordions" icon={<Layers className="h-5 w-5" />} theme={theme}>
      <div className={`max-w-md space-y-3 ${widgetClass} rounded-xl`}>
        <AccordionItem title="Climate Projections" defaultOpen={true}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className={`text-xs ${mutedClass}`}>Scenario</span>
              <span className="text-sm font-medium">RCP 4.5</span>
            </div>
            <div className="flex items-center justify-between">
              <span className={`text-xs ${mutedClass}`}>Year</span>
              <span className={`text-sm font-medium ${theme === 'light' ? 'text-orange-600' : 'text-orange-400'}`}>2050</span>
            </div>
          </div>
        </AccordionItem>
        
        <AccordionItem title="Sea Level Rise" defaultOpen={false}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className={`text-xs ${mutedClass}`}>Layer Opacity</span>
              <span className="text-sm font-medium">70%</span>
            </div>
            <Slider value={[70]} min={10} max={100} step={5} />
          </div>
        </AccordionItem>
        
        <AccordionItem title="Temperature" defaultOpen={false}>
          <p className={`text-xs ${mutedClass}`}>Temperature layer controls will appear here.</p>
        </AccordionItem>
      </div>
    </Section>
  )
}

function DataVizGradients({ theme = 'dark' }: { theme?: 'dark' | 'light' }) {
  const widgetClass = theme === 'light' 
    ? 'bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4' 
    : 'widget-container space-y-4'
  const mutedClass = theme === 'light' ? 'text-slate-500' : 'text-muted-foreground'
  
  return (
    <Section title="Data Visualization Gradients" icon={<Palette className="h-5 w-5" />} theme={theme}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={widgetClass}>
          <h4 className="text-sm font-semibold">Temperature Anomaly</h4>
          <div className="h-4 w-full rounded-full bg-gradient-to-r from-white via-[#fef9c3] via-[#fde047] via-[#facc15] via-[#f59e0b] via-[#fb923c] via-[#f97316] via-[#ea580c] via-[#dc2626] to-[#7f1d1d]" />
          <div className={`flex justify-between text-xs ${mutedClass}`}>
            <span>0°C</span>
            <span>2°C</span>
            <span>4°C</span>
            <span>6°C</span>
            <span>8°C+</span>
          </div>
        </div>
        
        <div className={widgetClass}>
          <h4 className="text-sm font-semibold">Actual Temperature</h4>
          <div className="h-4 w-full rounded-full bg-gradient-to-r from-[#1e3a8a] via-[#3b82f6] via-[#fef08a] via-[#fb923c] via-[#ef4444] to-[#7f1d1d]" />
          <div className={`flex justify-between text-xs ${mutedClass}`}>
            <span>10°</span>
            <span>20°</span>
            <span>30°</span>
            <span>40°+</span>
          </div>
        </div>
        
        <div className={widgetClass}>
          <h4 className="text-sm font-semibold">Precipitation</h4>
          <div className={`h-4 w-full rounded-full bg-gradient-to-r ${theme === 'light' ? 'from-[#f1f5f9]' : 'from-[#ffffff]'} via-[#e3f2fd] via-[#90caf9] via-[#42a5f5] via-[#1e88e5] to-[#0d47a1]`} />
          <div className={`flex justify-between text-xs ${mutedClass}`}>
            <span>0</span>
            <span>2</span>
            <span>4</span>
            <span>6</span>
            <span>10 mm/day</span>
          </div>
        </div>
        
        <div className={widgetClass}>
          <h4 className="text-sm font-semibold">Population Growth</h4>
          <div className="h-4 w-full rounded-full" style={{
            background: 'linear-gradient(to right, #dc2626 0%, #ef4444 10%, #f97316 20%, #eab308 30%, #a855f7 40%, #8b5cf6 50%, #3b82f6 60%, #0ea5e9 70%, #06b6d4 85%, #10b981 100%)'
          }} />
          <div className={`flex justify-between text-xs ${mutedClass}`}>
            <span>-5%</span>
            <span>0%</span>
            <span>+5%</span>
            <span>+10%</span>
          </div>
        </div>
      </div>
    </Section>
  )
}

export default function DesignSystemPage() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  
  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }
  
  return (
    <div 
      className={`min-h-screen transition-colors duration-300 ${
        theme === 'light' 
          ? 'bg-[#f8fafc] text-[#0f172a]' 
          : 'bg-background text-foreground'
      }`}
      data-theme={theme}
    >
      {/* Header */}
      <header className={`sticky top-0 z-50 backdrop-blur-xl border-b transition-colors duration-300 ${
        theme === 'light'
          ? 'bg-white/80 border-slate-200'
          : 'bg-background/80 border-white/10'
      }`}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-xl bg-[#437efc]">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.36 17.36 0 01-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Climate Studio</h1>
                <p className={`text-sm ${theme === 'light' ? 'text-slate-500' : 'text-muted-foreground'}`}>
                  Design System v1.0
                </p>
              </div>
            </div>
            
            {/* Theme Toggle */}
            <div className="flex items-center gap-3">
              <span className={`text-xs font-medium ${theme === 'light' ? 'text-slate-500' : 'text-muted-foreground'}`}>
                {theme === 'light' ? 'Light' : 'Dark'}
              </span>
              <button
                onClick={toggleTheme}
                className={`
                  relative w-14 h-7 rounded-full transition-all duration-300 border
                  ${theme === 'light' 
                    ? 'bg-transparent border-slate-300 hover:border-slate-400' 
                    : 'bg-transparent border-neutral-600 hover:border-neutral-500'
                  }
                `}
              >
                <div className={`
                  absolute top-0.5 w-6 h-6 rounded-full 
                  flex items-center justify-center
                  transition-all duration-300 ease-out
                  ${theme === 'light'
                    ? 'left-0.5 bg-amber-100 border border-amber-200'
                    : 'left-[30px] bg-blue-500/20 border border-blue-500/40'
                  }
                `}>
                  {theme === 'light' 
                    ? <Sun className="h-3.5 w-3.5 text-amber-500" />
                    : <Moon className="h-3.5 w-3.5 text-blue-400" />
                  }
                </div>
              </button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Intro */}
        <div className="mb-16">
          <div className="max-w-2xl">
            <h2 className="text-4xl font-bold tracking-tight mb-4">
              Design System
            </h2>
            <p className={`text-lg leading-relaxed ${theme === 'light' ? 'text-slate-600' : 'text-muted-foreground'}`}>
              A comprehensive collection of design tokens, components, and patterns that power the 
              Climate Studio interface. Built for consistency, accessibility, and beautiful data visualization.
            </p>
          </div>
          
          {/* Theme indicator badge */}
          <div className={`
            mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
            ${theme === 'light' 
              ? 'bg-amber-100 text-amber-800' 
              : 'bg-blue-500/20 text-blue-300'
            }
          `}>
            {theme === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            Currently viewing: {theme === 'light' ? 'Light Theme' : 'Dark Theme'}
          </div>
        </div>
        
        <ColorPalette theme={theme} />
        <Typography theme={theme} />
        <Buttons theme={theme} />
        <FormElements theme={theme} />
        <Cards theme={theme} />
        <AccordionSection theme={theme} />
        <StatusIndicators theme={theme} />
        <DataVizGradients theme={theme} />
        
        {/* Footer */}
        <footer className={`mt-16 pt-8 border-t text-center ${
          theme === 'light' ? 'border-slate-200' : 'border-white/10'
        }`}>
          <p className={`text-sm ${theme === 'light' ? 'text-slate-500' : 'text-muted-foreground'}`}>
            Climate Studio Design System • Built with React, Tailwind CSS, and Radix UI
          </p>
        </footer>
      </main>
    </div>
  )
}

