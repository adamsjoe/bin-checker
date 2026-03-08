# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server with HMR
npm run build     # Production build
npm run preview   # Preview production build
npm run lint      # Run ESLint
```

## Architecture

Single-page React app (Vite + React 19) that scrapes North Lanarkshire Council bin collection dates and displays which bins are due today or tomorrow.

**Core flow (`src/App.jsx`):**
1. On load (and when address changes), fetches the council's bin collection page via `https://corsproxy.io/` (CORS proxy required since it's a third-party HTML page)
2. Parses the HTML with `DOMParser`, finding `.waste-type-container` elements
3. Matches each container's `<h3>` text against `BIN_DEFINITIONS` labels to canonicalize bin types
4. Highlights bins with collection today or tomorrow; shows next collection date for others

**Key constants in `src/App.jsx`:**
- `BIN_DEFINITIONS` — maps bin types to display names, label aliases, and colors
- `ADDRESSES` — maps short address keys to council page URLs; switching address re-fetches

**Test mode:** Append `?test=true` to the URL to show all bins as due (bypasses the fetch).

**Deployment:** `vite.config.js` uses `base: "./"` for relative-path deployment (e.g. serving from a subdirectory). No backend — purely client-side.

All styles are inline JS objects at the bottom of `App.jsx` (no CSS modules or Tailwind).
