# Climate Suite Navigation

The navigation shell that wraps all Climate Suite applications.

## Structure

```
apps/navigation/
├── src/
│   ├── components/
│   │   ├── Header.tsx       # Top navigation bar with menu
│   │   ├── Header.css
│   │   ├── Layout.tsx       # Layout wrapper for all pages
│   │   └── Layout.css
│   ├── pages/
│   │   ├── ClimateStudio.tsx   # Climate Studio section
│   │   └── ClimateStudio.css
│   ├── App.tsx              # Main app with routing
│   ├── main.tsx             # Entry point
│   └── index.css            # Global styles
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Features

- **Header Navigation**: Menu bar with links to all sections
- **Routing**: React Router for navigation between apps
- **Layout**: Consistent layout wrapper for all sections
- **Responsive**: Mobile-friendly design

## Development

```bash
# Install dependencies
cd apps/navigation
npm install

# Run dev server
npm run dev

# Build for production
npm run build
```

## Adding New Sections

1. Create a new page component in `src/pages/`
2. Add route in `src/App.tsx`
3. Add menu item in `src/components/Header.tsx`

## Next Steps

- Embed the actual climate-studio app (via iframe or component import)
- Add more menu sections as needed
- Implement authentication/state sharing between apps
- Add loading states and error boundaries
