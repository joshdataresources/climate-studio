/**
 * Climate Studio Design System
 * ============================
 * 
 * A comprehensive design system for the Climate Studio application.
 * 
 * ## Usage
 * 
 * ### CSS Tokens
 * The design tokens are automatically imported via globals.css.
 * Access them using CSS variables like `var(--cs-brand-primary)`.
 * 
 * ### Design System Page
 * Visit `/design-system` to see all components and tokens in action.
 * This page is hidden from the main navigation.
 * 
 * ### Key Token Categories
 * - Colors: `--cs-neutral-*`, `--cs-brand-*`, `--cs-success-*`, etc.
 * - Typography: `--cs-text-*`, `--cs-font-*`, `--cs-leading-*`
 * - Spacing: `--cs-space-*`
 * - Borders: `--cs-radius-*`, `--cs-border-*`
 * - Shadows: `--cs-shadow-*`, `--cs-glow-*`
 * - Effects: `--cs-blur-*`, `--cs-opacity-*`
 * - Transitions: `--cs-duration-*`, `--cs-ease-*`
 * - Z-index: `--cs-z-*`
 * 
 * ### Semantic Tokens
 * - Surface colors: `--cs-surface-*`
 * - Text colors: `--cs-text-*`
 * - Border colors: `--cs-border-*`
 * - Interactive states: `--cs-interactive-*`
 * 
 * ### Data Visualization Colors
 * - Climate-themed: `--cs-data-sea`, `--cs-data-heat`, `--cs-data-drought`, etc.
 * - Chart palette: `--cs-chart-1` through `--cs-chart-8`
 */

export { default as DesignSystemPage } from './DesignSystemPage'

// Re-export common UI component utilities
export const designTokens = {
  colors: {
    brand: {
      primary: 'var(--cs-brand-primary)',
      primaryLight: 'var(--cs-brand-primary-light)',
      primaryDark: 'var(--cs-brand-primary-dark)',
    },
    semantic: {
      success: 'var(--cs-success-400)',
      warning: 'var(--cs-warning-400)',
      error: 'var(--cs-error-400)',
      info: 'var(--cs-info-400)',
    },
    data: {
      sea: 'var(--cs-data-sea)',
      heat: 'var(--cs-data-heat)',
      cold: 'var(--cs-data-cold)',
      drought: 'var(--cs-data-drought)',
      rain: 'var(--cs-data-rain)',
      growth: 'var(--cs-data-growth)',
      decline: 'var(--cs-data-decline)',
      urban: 'var(--cs-data-urban)',
    },
  },
  spacing: {
    xs: 'var(--cs-space-1)',
    sm: 'var(--cs-space-2)',
    md: 'var(--cs-space-4)',
    lg: 'var(--cs-space-6)',
    xl: 'var(--cs-space-8)',
  },
  radius: {
    sm: 'var(--cs-radius-sm)',
    md: 'var(--cs-radius-md)',
    lg: 'var(--cs-radius-lg)',
    xl: 'var(--cs-radius-xl)',
    full: 'var(--cs-radius-full)',
  },
  shadows: {
    sm: 'var(--cs-shadow-sm)',
    md: 'var(--cs-shadow-md)',
    lg: 'var(--cs-shadow-lg)',
    panel: 'var(--cs-shadow-panel)',
    glow: 'var(--cs-glow-md)',
  },
} as const



