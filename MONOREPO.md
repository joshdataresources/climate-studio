# Climate Projects Monorepo

This repository has been restructured as a monorepo to support multiple climate visualization projects while sharing common components and utilities.

## Directory Structure

```
climate-studio/
├── apps/                          # Application projects
│   └── climate-studio/            # Original Climate Studio app
│       ├── src/
│       ├── package.json
│       └── vite.config.ts
│
├── packages/                      # Shared packages
│   └── shared/                    # @climate/shared - Core components
│       ├── components/            # Reusable UI components
│       │   ├── MapboxGlobe.tsx
│       │   ├── accordion.tsx
│       │   └── layer-panel.tsx
│       ├── hooks/                 # Custom React hooks
│       │   └── useClimateLayerData.ts
│       ├── contexts/              # React contexts
│       │   └── ClimateContext.tsx
│       ├── config/                # Configuration files
│       │   └── climateLayers.ts
│       ├── types/                 # TypeScript type definitions
│       │   └── geography.ts
│       ├── services/              # API clients and services
│       └── package.json
│
├── qgis-processing/               # Backend Python services
│   └── services/                  # Climate data services
│
├── package.json                   # Root workspace configuration
└── README.md
```

## Getting Started

### Installation

Install all dependencies for all workspaces:

```bash
npm install
```

### Development

Run the Climate Studio app in development mode:

```bash
npm run dev:studio
```

Or navigate to the specific app:

```bash
cd apps/climate-studio
npm run dev
```

### Building

Build Climate Studio for production:

```bash
npm run build:studio
```

## Creating a New Project

### 1. Create a New App

```bash
# Create new app directory
mkdir apps/your-new-app
cd apps/your-new-app

# Initialize package.json
npm init -y
```

### 2. Configure package.json

Update your new app's `package.json`:

```json
{
  "name": "your-new-app",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "@climate/shared": "*",
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  }
}
```

### 3. Import Shared Components

In your new app, import from the shared package:

```typescript
// Import specific components
import { MapboxGlobe, LayerPanel } from '@climate/shared/components'
import { useClimateLayerData } from '@climate/shared/hooks'
import { ClimateProvider, useClimate } from '@climate/shared/contexts'
import { climateLayers } from '@climate/shared/config'

// Or import everything
import { MapboxGlobe, useClimate, climateLayers } from '@climate/shared'
```

### 4. Update Root package.json

Add scripts for your new app in the root `package.json`:

```json
{
  "scripts": {
    "dev:your-app": "npm run dev --workspace=your-new-app",
    "build:your-app": "npm run build --workspace=your-new-app"
  }
}
```

### 5. Run Your New App

```bash
npm run dev:your-app
```

## Shared Package (@climate/shared)

The shared package contains reusable components and utilities that can be used across all apps.

### Components

- **MapboxGlobe** - Interactive globe map with climate layers
- **LayerPanel** - Layer control panel with sliders and toggles
- **AccordionItem** - Collapsible panel component

### Hooks

- **useClimateLayerData** - Hook for fetching and managing climate layer data

### Contexts

- **ClimateProvider** - Global climate state management
- **useClimate** - Hook to access climate context

### Config

- **climateLayers** - Climate layer definitions and configurations

### Types

- Shared TypeScript types for geography, climate data, etc.

## Modifying Shared Components

When you modify components in `packages/shared/`, the changes are automatically available to all apps that import them.

1. Edit the component in `packages/shared/`
2. The change is immediately reflected in all apps using that component
3. No rebuild or republish needed (in development)

## Best Practices

### 1. Keep Shared Package Generic

Only add components to `@climate/shared` if they are truly reusable across multiple projects. App-specific components should stay in the app directory.

### 2. Version Control

- Commit shared package changes separately from app changes
- Tag releases when making breaking changes to shared components
- Document API changes in shared package

### 3. Dependencies

- Add common dependencies to the shared package
- Add app-specific dependencies to individual apps
- Use peer dependencies in shared package for React, etc.

### 4. TypeScript

- Export all types from shared package
- Use path aliases for clean imports
- Keep types colocated with their implementations

## Workspace Scripts

The root `package.json` includes convenient scripts:

```bash
# Development
npm run dev:studio              # Run Climate Studio app
npm run dev:shared              # Watch shared package for changes

# Building
npm run build:studio            # Build Climate Studio
npm run build:shared            # Build shared package

# All workspaces
npm install                     # Install all dependencies
```

## Troubleshooting

### Module Not Found

If you get "Module not found" errors for `@climate/shared`:

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Changes Not Reflecting

If changes to shared package aren't showing up:

```bash
# Restart the dev server
# Or rebuild the shared package
npm run build:shared
```

### TypeScript Errors

Ensure your `tsconfig.json` includes workspace paths:

```json
{
  "compilerOptions": {
    "paths": {
      "@climate/shared": ["../../packages/shared"]
    }
  }
}
```

## Backend Services

The `qgis-processing` directory contains the Python backend services that provide climate data through Earth Engine APIs. These services are shared across all frontend apps.

### Starting Backend

```bash
cd qgis-processing
PORT=5001 EARTHENGINE_PROJECT='your-project' python3 climate_server.py
```

## Contributing

When adding new features:

1. Consider if the feature should be in shared package or app-specific
2. Update this documentation when adding new shared components
3. Add examples for complex shared components
4. Keep backwards compatibility when modifying shared package

## Migration Notes

The repository was converted from a single app to a monorepo:

- Original `frontend/` → `apps/climate-studio/`
- Reusable components → `packages/shared/`
- Backend remains in `qgis-processing/`

Existing functionality remains unchanged, but import paths have been updated to use `@climate/shared`.
