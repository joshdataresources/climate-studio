---
name: Climate Studio

colors:
  # ── Neutral scale (dark theme) ──────────────────────────────────────────────
  neutral-0:    "#000000"   # extreme black
  neutral-50:   "#0a0a0a"   # sunken surface
  neutral-100:  "#141414"   # app background
  neutral-150:  "#1e1e1e"   # elevated surface / card behind glass
  neutral-200:  "#282828"   # input background
  neutral-300:  "#3f3f3f"   # default border
  neutral-400:  "#525252"   # strong border / disabled text
  neutral-500:  "#737373"   # tertiary text / no-data map fill
  neutral-600:  "#a3a3a3"   # secondary text
  neutral-700:  "#d4d4d4"   # inverted body text
  neutral-800:  "#e5e5e5"   # inverted heading text
  neutral-900:  "#f5f5f5"   # primary text
  neutral-950:  "#fafafa"   # near-white
  neutral-1000: "#ffffff"   # pure white

  # ── Brand ───────────────────────────────────────────────────────────────────
  brand-primary:       "#437efc"
  brand-primary-light: "#6b9bff"
  brand-primary-dark:  "#2a5fd4"
  brand-primary-muted: "rgba(67, 126, 252, 0.25)"

  # ── Semantic: Success (Emerald) ──────────────────────────────────────────────
  success-text:   "#10b981"
  success-bg:     "rgba(16, 185, 129, 0.15)"
  success-border: "rgba(16, 185, 129, 0.30)"

  # ── Semantic: Warning (Amber) ────────────────────────────────────────────────
  warning-text:   "#fbbf24"
  warning-bg:     "rgba(251, 191, 36, 0.15)"
  warning-border: "rgba(251, 191, 36, 0.30)"

  # ── Semantic: Error (Red) ────────────────────────────────────────────────────
  error-text:   "#ef4444"
  error-bg:     "rgba(239, 68, 68, 0.15)"
  error-border: "rgba(239, 68, 68, 0.30)"

  # ── Semantic: Info (Blue) ────────────────────────────────────────────────────
  info-text:   "#3b82f6"
  info-bg:     "rgba(59, 130, 246, 0.15)"
  info-border: "rgba(59, 130, 246, 0.30)"

  # ── Data-visualization palette (climate-themed) ──────────────────────────────
  data-sea:     "#0ea5e9"   # sea level / coastal
  data-heat:    "#f97316"   # heat / hot anomaly
  data-cold:    "#3b82f6"   # cold / cool anomaly
  data-drought: "#eab308"   # drought / dry conditions
  data-rain:    "#06b6d4"   # precipitation
  data-growth:  "#10b981"   # vegetation / positive growth
  data-decline: "#ef4444"   # loss / negative trend
  data-urban:   "#8b5cf6"   # urban / built environment
  data-forest:  "#22c55e"   # forest cover
  data-terrain: "#78716c"   # topographic / bare earth

  # ── Chart series (accessibility-ordered) ────────────────────────────────────
  chart-1: "#437efc"   # primary blue
  chart-2: "#10b981"   # emerald
  chart-3: "#f59e0b"   # amber
  chart-4: "#8b5cf6"   # violet
  chart-5: "#ef4444"   # red
  chart-6: "#06b6d4"   # cyan
  chart-7: "#f97316"   # orange
  chart-8: "#84cc16"   # lime

  # ── Light theme surface / text / border overrides ───────────────────────────
  light-surface-base:     "#f8fafc"
  light-surface-elevated: "#ffffff"
  light-surface-overlay:  "rgba(255, 255, 255, 0.92)"
  light-surface-sunken:   "#f1f5f9"
  light-text-primary:     "#0f172a"
  light-text-secondary:   "#475569"
  light-text-tertiary:    "#64748b"
  light-text-disabled:    "#94a3b8"
  light-border-default:   "#e2e8f0"
  light-border-strong:    "#cbd5e1"

typography:
  display:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "36px"
    fontWeight: 700
    lineHeight: "44px"
    letterSpacing: "-0.025em"

  h1:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: "38px"
    letterSpacing: "0"

  h2:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "32px"
    letterSpacing: "0"

  h3:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "28px"
    letterSpacing: "0"

  body-lg:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
    letterSpacing: "0"

  body:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
    letterSpacing: "0"

  caption:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
    letterSpacing: "0"

  eyebrow:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "20px"
    letterSpacing: "0.05em"
    textTransform: "uppercase"

  metric-label:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: "16px"
    letterSpacing: "0.02em"
    textTransform: "uppercase"

  micro:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: "14px"
    letterSpacing: "0"

  code:
    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
    letterSpacing: "0"

rounded:
  none:    "0"
  sm:      "0.25rem"    # 4px  — chips, icon pills
  md:      "0.375rem"   # 6px  — buttons, inputs, selects, map controls
  DEFAULT: "0.5rem"     # 8px  — feature-card, shadcn base
  lg:      "0.75rem"    # 12px — layer-card, larger cards
  xl:      "1rem"       # 16px — widget-container panels
  2xl:     "1.5rem"     # 24px — hero badges
  full:    "9999px"     # pill badges, slider thumb, toggle

spacing:
  unit:    "8px"        # base grid unit
  0:       "0"
  px:      "1px"
  0-5:     "2px"
  1:       "4px"
  1-5:     "6px"
  2:       "8px"
  2-5:     "10px"
  3:       "12px"
  3-5:     "14px"
  4:       "16px"       # widget-padding / card gutter
  5:       "20px"
  6:       "24px"       # section margin
  7:       "28px"
  8:       "32px"
  9:       "36px"
  10:      "40px"
  12:      "48px"       # section separation
  14:      "56px"
  16:      "64px"
  20:      "80px"
  sidebar-collapsed: "72px"
  sidebar-expanded:  "240px"

shadows:
  sm:       "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
  DEFAULT:  "0 1px 3px 0 rgba(0, 0, 0, 0.10), 0 1px 2px -1px rgba(0, 0, 0, 0.10)"
  md:       "0 4px 6px -1px rgba(0, 0, 0, 0.10), 0 2px 4px -2px rgba(0, 0, 0, 0.10)"
  lg:       "0 10px 15px -3px rgba(0, 0, 0, 0.10), 0 4px 6px -4px rgba(0, 0, 0, 0.10)"
  xl:       "0 20px 25px -5px rgba(0, 0, 0, 0.10), 0 8px 10px -6px rgba(0, 0, 0, 0.10)"
  2xl:      "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
  panel:    "0 8px 32px rgba(0, 0, 0, 0.40)"    # glass widget — dark
  panel-lg: "0 16px 48px rgba(0, 0, 0, 0.50)"
  glow-sm:  "0 0 10px rgba(67, 126, 252, 0.30)"  # active state / focus halo
  glow-md:  "0 0 20px rgba(67, 126, 252, 0.40)"
  glow-lg:  "0 0 40px rgba(67, 126, 252, 0.50)"

motion:
  duration-75:    "75ms"
  duration-100:   "100ms"
  duration-150:   "150ms"
  duration-200:   "200ms"    # standard transition
  duration-300:   "300ms"    # slow / accordion open
  duration-500:   "500ms"
  duration-700:   "700ms"
  duration-1000:  "1000ms"
  ease-linear:    "linear"
  ease-in:        "cubic-bezier(0.4, 0, 1, 1)"
  ease-out:       "cubic-bezier(0, 0, 0.2, 1)"
  ease-in-out:    "cubic-bezier(0.4, 0, 0.2, 1)"
  ease-bounce:    "cubic-bezier(0.68, -0.55, 0.265, 1.55)"
  standard-transition-properties: "color, background-color, border-color, box-shadow, transform, opacity"
  standard-transition-duration: "200ms"
  standard-transition-easing: "cubic-bezier(0, 0, 0.2, 1)"

z-index:
  base:     0
  dropdown: 1000
  sticky:   1100
  overlay:  1200
  modal:    1300
  popover:  1400
  tooltip:  1500
  toast:    1600
  max:      9999

components:
  widget-container:
    background:       "rgba(30, 30, 30, 0.75)"
    border:           "rgba(255, 255, 255, 0.06)"
    border-hover:     "rgba(255, 255, 255, 0.12)"
    blur:             "blur(10px)"
    shadow:           "0 4px 25px 0 rgba(0, 0, 0, 0.10)"
    radius:           "{rounded.xl}"
    padding:          "{spacing.4}"
    transition:       "border-color 0.2s ease, box-shadow 0.2s ease"

  button-default:
    height:           "36px"
    padding:          "0 16px"
    radius:           "{rounded.md}"
    fontSize:         "14px"
    fontWeight:       500
    background:       "rgba(40, 40, 40, 0.80)"
    border:           "rgba(0, 0, 0, 0.15)"
    background-hover: "rgba(255, 255, 255, 0.10)"
    focus-ring:       "rgba(59, 130, 246, 0.50)"

  button-primary:
    background:       "{colors.brand-primary}"
    background-hover: "{colors.brand-primary-dark}"
    textColor:        "{colors.neutral-1000}"
    radius:           "{rounded.md}"
    height:           "36px"

  button-sm:
    height:           "32px"
    padding:          "0 12px"
    fontSize:         "12px"

  button-lg:
    height:           "40px"
    padding:          "0 32px"

  button-icon:
    height:           "36px"
    width:            "36px"
    radius:           "{rounded.md}"

  input:
    height:           "36px"
    radius:           "{rounded.md}"
    padding:          "0 12px"
    background:       "rgba(40, 40, 40, 0.80)"
    border:           "rgba(0, 0, 0, 0.15)"
    background-hover: "rgba(255, 255, 255, 0.10)"
    border-focus:     "#3b82f6"
    focus-ring:       "rgba(59, 130, 246, 0.50)"

  layer-card:
    background:        "rgba(255, 255, 255, 0.02)"
    background-hover:  "rgba(255, 255, 255, 0.05)"
    background-active: "linear-gradient(135deg, rgba(59,130,246,0.12), rgba(59,130,246,0.06))"
    border:            "rgba(255, 255, 255, 0.08)"
    border-hover:      "rgba(255, 255, 255, 0.12)"
    border-active:     "rgba(59, 130, 246, 0.40)"
    shadow-active:     "0 0 20px rgba(59, 130, 246, 0.10)"
    radius:            "{rounded.lg}"
    padding:           "14px"

  feature-card:
    background:        "rgba(255, 255, 255, 0.04)"
    border:            "rgba(255, 255, 255, 0.08)"
    radius:            "{rounded.DEFAULT}"
    padding:           "12px"

  metric-badge:
    radius:            "{rounded.full}"
    padding:           "4px 10px"
    fontSize:          "11px"
    fontWeight:        600
    letterSpacing:     "0.02em"
    textTransform:     "uppercase"
    success-background: "{colors.success-bg}"
    success-textColor:  "#34d399"
    warning-background: "{colors.warning-bg}"
    warning-textColor:  "{colors.warning-text}"
    error-background:   "{colors.error-bg}"
    error-textColor:    "#f87171"
    info-background:    "{colors.info-bg}"
    info-textColor:     "#60a5fa"

  slider:
    track-height:      "6px"
    track-background:  "rgba(67, 126, 252, 0.25)"
    range-background:  "linear-gradient(to right, #3b82f6, #60a5fa)"
    thumb-size:        "16px"
    thumb-background:  "{colors.neutral-900}"
    thumb-border:      "2px solid #60a5fa"
    thumb-shadow:      "0 0 10px rgba(59, 130, 246, 0.20)"
    thumb-scale-hover: "1.10"
    thumb-scale-active: "0.95"

  map-control:
    size:              "29px"
    radius:            "{rounded.md}"
    background:        "rgba(30, 30, 30, 0.75)"
    border:            "rgba(255, 255, 255, 0.06)"

  sidebar:
    width-collapsed:   "{spacing.sidebar-collapsed}"
    width-expanded:    "{spacing.sidebar-expanded}"
    background:        "{colors.neutral-150}"
    background-light:  "{colors.light-surface-base}"

  theme-toggle:
    width:             "56px"
    height:            "28px"
    radius:            "{rounded.full}"
    knob-size:         "24px"
    dark-knob-background: "rgba(59, 130, 246, 0.20)"
    dark-knob-border:     "rgba(59, 130, 246, 0.40)"
    light-knob-background: "#fef3c7"
    light-knob-border:     "#fde68a"
    transition-duration: "{motion.duration-300}"
---

# Climate Studio — Design System

## Brand & Style

Climate Studio is a professional geospatial intelligence platform for exploring and analyzing climate data — sea-level rise, urban heat, temperature anomalies, precipitation, drought, and aquifer stress. The visual identity is built around two core ideas: **scientific credibility** and **legible dark-mode glass**.

The default dark theme casts the entire application in deep near-black (#141414), allowing full-bleed interactive maps to breathe while keeping data-dense control panels visually recessed. Over that surface, every control panel, sidebar widget, and map overlay is rendered as a **glassmorphic layer** — semi-transparent, backdrop-blurred, and bordered only with hairline alpha-white strokes. The effect reads as frosted instrument glass floating above the terrain, which suits the domain: scientists and planners are accustomed to instruments with dark faces and precise readouts.

Brand personality: authoritative but not cold, dense but not cluttered. The single accent color — a mid-register brand blue (#437efc) — threads through interactive states (active layers, slider ranges, focus rings, progress indicators) without dominating the chromatic space. That chromatic space is reserved for the data itself.

A **light mode** is fully supported and inverts the approach: the application body becomes a faintly tinted slate canvas with subtle multi-stop radial gradients in brand blue, violet, and cyan at very low opacity. Cards resolve to translucent white glass with a 1px pure-white edge highlight and soft slate drop shadows, so the color gradient "bleeds through" the frosted surface. The result is the same glass metaphor at the other end of the luminance spectrum.

---

## Colors

### Neutral Scale

The neutral palette runs from pure black (#000000) to pure white (#ffffff) in 13 stops tuned for dark-UI legibility. The critical stops:

- **#141414** — the root app background; dark enough that the map canvas behind any side panel feels uninterrupted.
- **#1e1e1e** — elevated surfaces such as sidebars, card interiors, and the backdrop of any non-glass component.
- **#282828** — input fields and select triggers, one step brighter than the card background to give form controls subtle lift without a harsh border.
- **#3f3f3f** — the default border color; used wherever a surface edge must be hinted without attracting the eye.
- **#f5f5f5** — primary text, deliberately just off pure white so it reads as ink-on-glass rather than a harsh screen glow.

### Brand Blue

The single brand hue (#437efc) is reserved for active selection rings on layer cards, slider range fills, accordion open-state chevrons, focus halos, and explicit primary CTA buttons. A muted alpha variant (rgba(67,126,252,0.25)) serves as the selected-state background tint on interactive rows. The brand blue is never used for semantic feedback — that role belongs entirely to the semantic palette.

### Data-Visualization Palette

Ten climate-domain colors serve map layers and chart series, chosen for domain legibility (orange/heat, blue/cold, cyan/rain, amber/drought, emerald/vegetation, red/decline — matching scientific convention so experts read the map immediately), dark-background contrast (all ten colors land in the medium-to-high luminance range), and accessibility ordering (the chart series sequence minimizes confusion for the most common forms of color vision deficiency).

### Continuous Gradients

Four semantic ramps drive choropleth map layers:

- **Temperature anomaly** — near-white through yellows and oranges into deep crimson, reading from "no change" to "extreme warming."
- **Actual temperature** — deep navy through bright blue and yellow into red and dark red, the full cold-to-hot meteorological convention.
- **Precipitation** — white/light slate through progressively deeper blues, dry to wet.
- **Population growth** — a diverging ramp from deep red through violet and blue to teal/emerald, decline through growth.

---

## Typography

The typeface is **Inter** for all UI text and **JetBrains Mono** for code snippets and coordinate readouts. Inter was chosen for its engineering-grade metric precision, exceptional on-screen rendering at the 12–14 px sizes where climate dashboards spend most of their time, and its wide range of weights without optical inconsistency.

Hierarchy in practice: large metric values (a temperature reading, a sea-level measurement) use the Display style at 36 px / 700 weight — numbers are the headline. Section titles inside widgets use h3 (20 px / 600). Section-group labels use the eyebrow style (14 px / 600 / 0.05 em / uppercase) — they organize, they don't carry content. Metric badges drop to 11 px / 600 / 0.02 em / uppercase — the smallest text that renders reliably on high-DPI maps.

Dark-mode legibility rules: all body text resolves to #f5f5f5, never pure white, to reduce halation. Muted text uses #a3a3a3 (≥4.5:1 contrast against #141414). Disabled states drop to #525252 and always pair with `pointer-events: none`.

---

## Layout & Spacing

Climate Studio uses an 8 px base grid. All spacing, component heights, and gutters are multiples of 8 with occasional 4 px half-steps inside dense panels.

The application shell is a two-panel layout: a collapsible sidebar (72 px collapsed / 240 px expanded) on the left and a full-bleed map canvas on the right. Floating widget panels (layer controls, legends, metric cards) are positioned absolutely over the map using the widget-container glass style.

Widget interiors follow a consistent vertical rhythm — panel headers have 12 px bottom padding and a 1px alpha-white bottom border; section breaks repeat the same hairline top border pattern; major page sections are separated by 48 px; sub-sections and their headers by 24 px. A "generous negative space" principle applies: each control has breathing room, and the frosted panels should feel like precision instruments.

---

## Elevation & Depth

Depth is signaled by three concurrent cues: **background transparency**, **backdrop blur**, and **alpha-white hairline borders**.

### The Glass Stack (dark theme)

The map canvas at level 0 is the deepest layer — unfiltered terrain or satellite imagery. Widget panels (level 1) sit at rgba(30,30,30,0.75) with blur(10px) and a rgba(255,255,255,0.06) border hairline. Layer cards inside the panel (level 2) are nearly invisible — rgba(255,255,255,0.02) background with a rgba(255,255,255,0.08) border. Feature cards inside layer cards (level 3) use rgba(255,255,255,0.04), one step up from transparent. Hover states always increment the border alpha by ~0.04–0.06. Active layer cards replace the alpha border with a solid brand-blue ring and add a soft glow shadow.

### The Glass Stack (light theme)

The body becomes a fixed multi-stop radial gradient over #f1f5f9 — brand blue at 10% opacity from the top-right, violet at 8% from the left, sky-blue at 8% from the bottom-right. Widget panels become rgba(255,255,255,0.60) with blur(20px) and a 1px solid white edge — the brightest point on the card traces the simulated light source. Drop shadows use slate rgba(15,23,42,0.10) rather than black to avoid the "pasted-on" look.

### Shadows vs. Glows

Shadows provide physical lift. Glows convey selection and focus. They are never combined — a card that is both hovered and active shows only the glow.

---

## Shapes & Radii

The radius system steps down as nesting deepens: widget panels use xl (16 px) — the largest radius, reinforcing that panels are distinct floating objects. Layer cards inside the panel use lg (12 px). Buttons, inputs, and map controls use md (6 px) — subtle, functional, not decorative. Feature cards (inset within layer cards) use DEFAULT (8 px). Pill badges, slider thumbs, and the theme toggle use full (9999 px) to signal "status" or "continuous range." The rule: never mix xl-radius panels with 2xl-radius children — always step down.

---

## Components

### Widget Container

The primary container for all floating panels and the only component using `backdrop-filter: blur(10px)`. All nested components are opaque or near-opaque relative to the panel's background. Hover adds ~2% to the border alpha. Variants (sm / lg / no-padding) scale padding while preserving radius and blur.

### Layer Card

The repeating row unit in layer-control widgets. Default state is nearly invisible — just enough to hint structure. Hover lifts background to 5% white. Active state injects a brand-blue gradient background and border plus a soft glow, converting the row into a clear focus point without disrupting the overall dark palette.

### Feature Card

An inset information tile inside panels and layer cards. Its 8 px radius and 4% white background produce a recessed-box effect that separates context from action.

### Buttons

All variants share 36 px height (default), 6 px radius, 14 px / 500-weight text, and a 200 ms ease-out transition. The `default` variant mimics the input field — translucent dark with an alpha border — so controls in dense panels feel like a family. The `primary` variant breaks to solid brand blue (#437efc → #2a5fd4 on hover), reserved for the single most-important action per screen.

### Inputs & Selects

Inputs are 36 px tall, 6 px radius, #282828 background, matching the default button family. On focus the border switches to solid brand blue (#3b82f6) and a 50%-alpha blue ring appears outside — the same focus treatment as buttons and map controls for consistent keyboard navigation.

### Slider

A 6 px track filled with 25%-alpha brand blue, a gradient range bar (blue-500 → blue-400), and a 16 px circular thumb with a 2 px blue border and brand glow shadow. The thumb scales up on hover (1.10×) and compresses on active press (0.95×) to provide tactile feedback on a 2D surface.

### Metric Badge

Status pills use fully rounded corners, uppercase 11 px text, and a 15%-opacity tinted background in the relevant semantic color. The 0.02 em letter spacing at this small size separates glyphs that would otherwise touch on high-density displays.

### Accordion

Used for collapsible sections inside widget panels. The expand/collapse chevron lives in a 24×24 px rounded pill that shifts from white/4 to blue-500/10 when open, and the icon transitions to brand blue. Content reveal uses a CSS grid-rows technique (`0fr → 1fr`) for smooth height animation without JavaScript measurement.

### Theme Toggle

A 56×28 px pill button with a sliding 24 px knob. In dark mode the knob is a blue-500/20 disc (Moon icon). In light mode it shifts to an amber #fef3c7 disc (Sun icon). The 300 ms transition is intentionally slower than micro-interactions to signal a mode-level state change.

---

## Theming

Dark is the canonical theme — all primitive tokens are defined for dark and the light theme applies targeted overrides via `data-theme="light"` on the document root. All components consuming semantic tokens re-resolve automatically. Components branching on Tailwind utility classes use a `theme` prop.

In dark mode the body is uniform #141414. In light mode it becomes a fixed multi-stop radial gradient over #f1f5f9 — giving the backdrop just enough color for the translucent white cards to read as glass rather than flat tiles.

---

## Data Display Conventions

Metric values use Display or h1 typography with the `data-*` color matching the layer category. Trend indicators appear as small semantic badges adjacent to the metric: emerald for improvement, red for worsening. Legend scales render as horizontal gradient bars with the continuous ramp described in the Colors section, capped by min/max labels in the caption style. Chart axes use the caption style (12 px / 400 / #a3a3a3) — they orient, they don't compete. Masked or no-data map areas render as #737373 (neutral-500), distinguishable from both valid-dark and valid-light data values.

---

## 13. Climate layer composition

The visual primitives above (widget, button, accordion, slider, select) are the *atoms*. The Studio's real UI is built from a **layer registry** in `packages/climate-core/src/config/climateLayers.ts` that declaratively maps each climate layer to (a) the data fetch, (b) the visual style, and (c) the controls a user sees when the layer is active. Two composing components consume that registry — `LayerPalette` (the floating list of layers) and `layer-panel` (the accordion of active-layer controls).

### 13.1 Layer registry

```ts
interface ClimateLayerDefinition {
  id: ClimateLayerId;               // discriminated union, 9 values
  title: string;
  description: string;
  category: 'coastal' | 'temperature' | 'topography';
  source:   { name: string; url?: string };
  defaultActive?: boolean;
  controls: ClimateControl[];        // which controls to render for this layer
  fetch:    { method: 'GET' | 'POST'; route: string;
              query: (ctx: ClimateFetchContext) => Record<string, …> };
  style:    { color: string; opacity: number;
              layerType: 'point' | 'polygon' | 'heat' | 'raster';
              blendMode?: string; valueProperty?: string };
}
```

Live layers (7 active, 2 hidden behind feature flags):

| ID | Title | Category | Source | Default | Style |
|---|---|---|---|---|---|
| `sea_level_rise` | Sea Level Rise | coastal | NOAA SLR Viewer | — | raster `#38bdf8` α0.8 |
| `megaregion_timeseries` | Metro Data Statistics | temperature | Climate Migration Model | ✓ | polygon `#ff8c00` α0.4 |
| `urban_heat_island` | Urban Heat Island | temperature | Yale YCEO Summer UHI v4 | — | raster `#facc15` α0.7 |
| `temperature_projection` | Future Temperature Anomaly | temperature | NASA NEX-GDDP-CMIP6 | — | raster `#fb923c` α0.6 screen |
| `precipitation_drought` | Precipitation & Drought | temperature | CHIRPS via Earth Engine | — | raster `#8b5cf6` α0.75 |
| `topographic_relief` | Topographic Relief | topography | SRTM / Copernicus DEM | ✓ | raster `#64748b` α0.7 multiply |
| `wet_bulb` | Wet Bulb Temperature | temperature | NASA NEX-GDDP-CMIP6 | — | polygon `#ff4d00` α0.6 |
| *temperature_current* | Current Surface Temperature | temperature | NASA GISTEMP | — | hidden |
| *groundwater_depletion* | Groundwater Depletion | temperature | NASA GRACE | — | hidden (awaiting GRACE access) |

### 13.2 Control vocabulary → widget mapping

Every control in `ClimateControl` resolves through one switch in `layer-panel.tsx` to a concrete primitive. This is the contract:

| Control | Widget | Notes |
|---|---|---|
| `scenario` | **Select** | RCP 2.6 (Low) · 4.5 (Moderate) · 8.5 (High) |
| `projectionYear` | **Slider** 2025–2100, step 5 | Renders the *Climate Impact Metrics* grid below it — sea level, temp anomaly, actual temp, precipitation, drought index, soil moisture, each in its own semantic tone |
| `seaLevelFeet` | derived from `projectionYear` | not a widget — read-only |
| `analysisDate` | **Input** `type=date` | full width |
| `displayStyle` | **Select** | Depth Grid · Confidence Extent |
| `resolution` | **Select** | 0.5° (High detail) · 1° · 2° (Faster) |
| `temperatureMode` | **Radio pair** (`accent-blue-500`) | Temperature Anomaly (Change) · Actual Temperature |
| `urbanHeatSeason` | **Select** | Summer (Jun–Aug) · Winter (Dec–Feb) |
| `urbanHeatColorScheme` | **Select** | Temperature (Blue–Red) · Heat (Viridis) · Urban (Blue–Orange–Red) |
| `reliefStyle` | **Select** | Classic · Dark Relief · 3D Depth · Dramatic Shadows |
| `droughtMetric` | **Select** | Precipitation · Drought Index · Soil Moisture |
| `megaregionDataMode` | **Checkbox pair** | Projected Population · Projected Average Temperature |
| `megaregionAnimating` | play/pause button | toggles timeseries animation |
| Any `*Opacity` (`seaLevelOpacity` / `projectionOpacity` / `urbanHeatOpacity` / `urbanExpansionOpacity` / `reliefOpacity` / `droughtOpacity` / `megaregionOpacity` / `groundwaterOpacity` / `wetBulbOpacity`) | **Slider** 10–100, step 5 | "Layer Opacity" label + `xx%` readout right-aligned |

All control rows share the same chrome: a 12px-semibold uppercase muted label, optional right-aligned value chip, then the widget below — wrapped in `space-y-2`.

### 13.3 Per-layer control matrix

Every layer below shows exactly the controls listed in its `controls` array (plus the two shared controls — `scenario` and `projectionYear` — that the global header always renders):

| Layer | Shared header | Layer-specific controls |
|---|---|---|
| sea_level_rise | scenario, projectionYear | seaLevelOpacity |
| megaregion_timeseries | scenario, projectionYear | megaregionDataMode · megaregionOpacity · megaregionAnimating |
| urban_heat_island | scenario, projectionYear | urbanHeatSeason · urbanHeatColorScheme · urbanHeatOpacity |
| temperature_projection | scenario, projectionYear | temperatureMode · projectionOpacity |
| precipitation_drought | scenario, projectionYear | droughtMetric · droughtOpacity |
| topographic_relief | scenario, projectionYear | reliefStyle · reliefOpacity |
| wet_bulb | scenario, projectionYear | projectionYear (re-pinned) · scenario · wetBulbOpacity |
| *groundwater_depletion (hidden)* | scenario, projectionYear | groundwaterAquifer · groundwaterOpacity |

### 13.4 Layer palette anatomy

`LayerPalette.tsx` (the floating left-rail panel). Container is `.widget-container.widget-container-no-padding` with three horizontal bands.

**Header band** — `flex justify-between mb-3 p-[16px_16px_0]`:
- Title: `<h3 class="text-sm font-semibold text-foreground">Layers</h3>`
- "Manage Layers" trigger: `Button variant="ghost" size="sm" h-7 px-2 text-xs` + `ChevronDown h-3 w-3`
- Dropdown content: `w-56`, one `DropdownMenuCheckboxItem` per registered layer — toggles palette visibility (not the layer's active state)

**List band** — scrollable when >6 layers (`max-h-[250px]` mobile, `400px` desktop), padded `p-[0_16px_12px]`, separator `border-bottom 1px hsl(var(--border))`. Each row is a `LayerItem`:

```
┌────────────────────────────────────────────────────────┐
│ ⠿  Sea Level Rise                          ⚙  ✕       │
│    Source: NOAA Sea Level Rise Viewer                  │
└────────────────────────────────────────────────────────┘
```

- Wrapper: `rounded-md border transition-colors`, padding `8px 12px`. Active row uses `hsl(var(--accent))` bg + `hsl(var(--primary))` border; idle uses `hsl(var(--background))` + `hsl(var(--border))`.
- Drag handle: `GripVertical h-4 w-4 text-muted-foreground hover:text-foreground` with `cursor-grab / active:cursor-grabbing`.
- Body: title `text-sm font-medium text-foreground truncate`, optional source caption `text-xs text-muted-foreground truncate` (gated by the Sources switch).
- Trailing actions: two `Button variant="ghost" size="sm" h-6 w-6 p-0` icons — `Settings h-3 w-3` and `X h-3 w-3`.

**Footer band** — `p-[12px_16px_16px] flex justify-between`:
- Left: shadcn `Checkbox` + label "Select All" (`text-xs font-medium cursor-pointer`) — toggles every visible layer's active state.
- Right: label "Sources" + shadcn `Switch` — hides/shows the source captions on every row.

### 13.5 Active-layer accordion stack (`layer-panel.tsx`)

Below the palette (or sometimes in place of it on mobile) sits the **control stack**: one `AccordionItem` per active layer. Each item uses the standard accordion chrome from §9.7, with the body containing only the controls listed in that layer's `controls` array. Open one, see only its controls; collapse it, the row stays in the stack as a chevron pill.

Two controls are *global* and live above the stack so they apply to every layer:
- `scenario` Select
- `projectionYear` Slider with the **Climate Impact Metrics** grid:

```
Sea Level Rise   Temp. Anomaly   Actual Temp.
~3 ft            +1.8 °C         16.3 °C
Precipitation    Drought Index   Soil Moisture
850 mm           1.2             54 %
```

Six 3-column cells; labels in `text-xs text-muted-foreground`, values in `text-xs font-semibold` with one semantic tone per metric (sea→sky, anomaly→orange, actual→red, precipitation→blue, drought→yellow, soil→green). When a layer's real data is loaded, the metric reads from `layerStates[layer].metadata`; otherwise it falls back to the IPCC interpolation in the `getProjectedValues` helper.

### 13.6 Layer icons

`LayerIcons.tsx` exports six 20×20 Material Symbols glyphs (Google Material Design "Rounded", filled, `currentColor` — viewBox `0 -960 960 960`):

| Glyph | Used by |
|---|---|
| `WaveIcon` | sea_level_rise, precipitation_drought |
| `HeatIcon` | urban_heat_island, wet_bulb |
| `MountainIcon` | topographic_relief |
| `WeatherIcon` | temperature_projection |
| `DropIcon` | (groundwater_depletion, hidden) |
| `PopulationIcon` | megaregion_timeseries |

These render inside accordion triggers and palette rows; they pick up `text-muted-foreground` by default and shift to `text-foreground` on `group-hover`, or `text-blue-400` (dark) / `text-blue-600` (light) when the layer is active.

### 13.7 Legend / colorbar

`ClimateLayerLegend.tsx` is a single floating chip that swaps its colorbar based on what's active. It only renders when `precipitation_drought` or `megaregion_timeseries` is on.

Container:

```
absolute z-10
  desktop: bottom-8 left-4
  mobile:  bottom-4 left-3 right-3
bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-3
```

The header is `text-sm font-semibold text-gray-800`. The bar is `h-6 rounded border border-gray-300`, width `w-48` desktop / `w-full` mobile. The range caption sits centered below in `text-xs text-gray-600`.

Four `LEGEND_CONFIGS`:

| Key | Label | Gradient |
|---|---|---|
| `precipitation` | Precipitation | `#F5ED53 → #F5F3CE → #6B9AF3 → #2357D2` (0–10 mm/day) |
| `drought_index` | Drought Index | `#8b4513 → #d2691e → #f4a460 → #ffffff → #90ee90 → #32cd32 → #228b22` (−2 dry to +2 wet) |
| `soil_moisture` | Soil Moisture | `#8b4513 → #daa520 → #f0e68c → #adff2f → #7cfc00 → #32cd32` (0–10 mm) |
| `megaregion_growth` | Population Growth Rate | `#dc2626 → #ef4444 → #f97316 → #eab308 → #a855f7 → #8b5cf6 → #3b82f6 → #0ea5e9 → #06b6d4 → #10b981` (−5% to +10%) |

> The legend chip uses `bg-white/90` regardless of theme — this is intentional so the colorbar reads on top of any basemap. Don't tint it with the surface tokens.

### 13.8 Layer status states

`LayerStatusIndicator.tsx` resolves an active layer's state into one of five rows. Each is an emoji + tone pair that maps cleanly onto §9.11 status callouts:

| Status | Icon | Color | Message |
|---|---|---|---|
| `loading` | ⏳ | `text-blue-500` | "Loading..." |
| `success` (real data) | ✅ | `text-green-500` | "Real NASA data (N features)" |
| `success` (fallback) | ⚠️ | `text-yellow-500` | "Fallback data ({reason})" |
| `error` | ❌ | `text-red-500` | "Error: {message}" |
| `fallback` (explicit) | ⚠️ | `text-yellow-500` + sub | "⚠️ Using simulated data" |

`LayerLoadingNotification.tsx` watches a 3-second threshold and surfaces slow layers as the long-running spinner callout (the purple "Waking Render Instance" pattern from §9.12 is the canonical shape).

`LayerErrorOverlay.tsx` is a centered modal — *not* a callout — when one or more layers hard-fail:

```
fixed inset-0 flex items-center justify-center z-[9999]
bg-red-900/95 backdrop-blur-sm
rounded-lg shadow-2xl p-6 max-w-md
border-2 border-red-500
text-white
```

Body: `AlertCircle h-6 w-6 text-red-300` next to "Layer Loading Failed" `text-lg font-semibold`. Each failing layer gets its own `bg-red-950/50 rounded p-3` block with a humanized name (`sea_level_rise` → "Sea Level Rise"), a Refresh button, and a Dismiss (X). Click Refresh to re-run the fetch; click Dismiss to hide that layer's error for the session.

### 13.9 Composition rules (in addition to §10)

1. **The registry is the source of truth.** Don't hard-code a layer-specific control in the panel — add it to the layer's `controls` array and let the switch render it.
2. **Each layer owns its identity icon (LayerIcons), but its tone follows the data, not the layer.** Sea-level metrics are sky; temperature anomaly is orange; drought is yellow; growth is green. Don't repaint the slider thumb or progress bar per-layer — keep them brand blue.
3. **One accordion per active layer** — never two control panels for the same layer. The palette can show many layers, but only enabled layers expand into the stack.
4. **Sources are a toggle, not a permanent caption.** The Sources switch in the palette footer hides every row's source line in one move.
5. **Legend lives outside the panel.** It floats over the map, independent of the panel/sidebar collapse state.
6. **Status badges sit with the layer row, not in a separate status panel.** `LayerStatusIndicator` is embedded into accordion triggers; the loading notification and error overlay are the only chrome that escapes the stack.

---

## 14. File map — layer composition

| Where | What |
|---|---|
| `packages/climate-core/src/config/climateLayers.ts` | The `climateLayers` array — single source of truth for layer ids, sources, defaults, controls, fetch and style |
| `apps/climate-studio/src/components/LayerPalette.tsx` | Floating widget — header + Manage Layers dropdown, scrollable LayerItem list, Select All + Sources footer |
| `apps/climate-studio/src/components/layer-panel.tsx` | The control switch — one `renderControl(controlId)` returning the right widget; rendered inside an Accordion stack |
| `apps/climate-studio/src/components/ClimateLayerLegend.tsx` | Floating colorbar (precipitation / drought / soil / population) |
| `apps/climate-studio/src/components/LayerIcons.tsx` | Six Material Symbols glyphs |
| `apps/climate-studio/src/components/LayerStatusIndicator.tsx` | Per-layer status emoji + label |
| `apps/climate-studio/src/components/LayerLoadingNotification.tsx` | "Waking" spinner callout (3 s threshold) |
| `apps/climate-studio/src/components/LayerErrorOverlay.tsx` | Centered red modal with per-layer refresh/dismiss |
| `apps/climate-studio/src/components/LayerDiagnostics.tsx` | Developer-mode payload inspector |
| `apps/climate-studio/src/components/MegaregionLayer.tsx` | Polygon timeseries layer with animation |
| `apps/climate-studio/src/components/layer-list.tsx` | Alternate "NOAA-only" card-style list with thumbnails (used in the secondary panel) |
