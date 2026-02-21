# ECM Explorer

An interactive visual explorer for the ECM Records catalog (~1,700 albums). Browse the complete discography through a canvas-rendered timeline with physics-based animations, filter by artist, and discover musical connections.

## Features

- **Canvas-Rendered Timeline** - Smooth scrolling through 50+ years of albums with physics-based animations
- **Scroll-Driven Year Labels** - Large typography that animates to sticky headers as you scroll
- **Minimap Navigation** - Histogram showing album counts per year with draggable scrubber
- **Artist Filtering** - Search and filter by artist with expanded header showing bio, photo, and collaborators
- **Collaborator Discovery** - Click through musician relationships to explore connections

## Getting Started

```bash
npm install
npm run dev
```

The dev server runs on port 5175.

## Data

The catalog data is sourced from:
- **ecmreviews.com** - Canonical catalog and album reviews
- **Discogs API** - Credits, artwork, artist images, and bios

See `.claude/CLAUDE.md` for full documentation on the data pipeline and architecture.

## Tech Stack

- SvelteKit
- Canvas API for rendering
- Physics-based animations (spring + friction)
- SCSS for styling

## License

MIT
