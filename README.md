# Gradient Histogram — Multi-Track Gradient Analyzer

Gradient Histogram is a Progressive Web App for cyclists who want to analyze the gradient distribution of their recorded routes. Load one or more GPX or Garmin FIT files and inspect them together on an interactive map, an elevation profile chart, and a gradient histogram.

## Features

- **GPX and Garmin FIT file support** — drag-and-drop or file picker; select multiple files at once
- **Multi-track view** — upload several routes and compare them side by side in all views
- **Interactive map** — all tracks displayed on OpenStreetMap (via OpenLayers), each in a distinct color
- **Elevation profile chart** — zoomable and pannable distance/elevation diagram showing all loaded tracks
- **Gradient histogram** — for each track, a curve showing how many km have a gradient at or above a given threshold; multiple curves on one chart for easy comparison
- **Clear button** — remove all loaded tracks in one click

## Gradient Histogram Explained

The gradient histogram answers: _"How much of this route is at least X% steep (or steep downhill)?"_

- **X-axis**: gradient threshold in percent (e.g. −10 % to +15 %)
- **Y-axis**: total kilometers of the track that meet the threshold criterion

The Y-value is computed differently depending on the sign of the threshold:

- **Threshold ≥ 0 %** — counts segments where `gradient ≥ threshold` (uphill at least as steep as the threshold)
- **Threshold < 0 %** — counts segments where `gradient ≤ threshold` (downhill at least as steep as the threshold)

The curve is monotonically non-increasing: at threshold 0 % you see the total uphill + flat km; at 10 % only the steep climbs remain. For negative thresholds, at −5 % you see all segments descending at 5 % or more. Comparing multiple tracks on the same chart immediately shows which route has more climbing or descending.

## Getting Started

**Prerequisites:** Node.js 20.19+ or 22.12+

```bash
# Install dependencies (includes local workspace packages)
npm install

# Start development server
npm run dev

# Run tests
npm test

# Type-check and build for production
npm run build
```

The production build is output to `dist/` with base path `/gradhist/`.

## Tech Stack

- [Vue 3](https://vuejs.org/) with Composition API and TypeScript
- [Vite](https://vitejs.dev/) for build tooling
- [OpenLayers](https://openlayers.org/) for map rendering
- [Chart.js](https://www.chartjs.org/) for the elevation profile and gradient histogram
- [Pinia](https://pinia.vuejs.org/) for state management
- [@garmin/fitsdk](https://www.npmjs.com/package/@garmin/fitsdk) for Garmin FIT file parsing
- [@tmcw/togeojson](https://www.npmjs.com/package/@tmcw/togeojson) for GPX parsing
- [Bootstrap 5](https://getbootstrap.com/) for UI styling

## Architecture

See [IMPLEMENTATION.md](IMPLEMENTATION.md) for a detailed description of the application architecture, data flow, and source file reference.

## Reusable Packages

Three modules from this project are published as independent npm packages under the `@gradhist` scope. Other projects can install them without taking a dependency on the full application.

| Package                                                                       | Description                                                                         | Peer deps                   |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------- |
| [`@gradhist/elevation-cursor-sync`](packages/elevation-cursor-sync/README.md) | Distance-based cursor sync composable (`useCursorSync`, `CursorSync`, `TrackPoint`) | `vue`                       |
| [`@gradhist/elevation-chart`](packages/elevation-chart/README.md)             | Interactive Vue 3 elevation profile chart with zoom, pan, and touch gestures        | `vue`, `chart.js`           |
| [`@gradhist/track-map-utils`](packages/track-map-utils/README.md)             | OpenLayers utilities: GeoJSON converters, `zoomToTrack`                             | `ol`, `kdbush`, `geokdbush` |

### Package development (monorepo)

The packages live under `packages/` and are linked into the app via npm workspaces. Running `npm install` from the project root sets up the symlinks automatically.

```
packages/
  elevation-cursor-sync/   ← @gradhist/elevation-cursor-sync
  elevation-chart/         ← @gradhist/elevation-chart
  track-map-utils/         ← @gradhist/track-map-utils
```

To build an individual package for publishing:

```bash
cd packages/elevation-cursor-sync && npm run build
```
