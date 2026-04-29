# Implementation

This document describes the architecture, data flow, and source files of Gradient Histogram.

## Reusable Packages

Three modules are extracted into independently publishable npm packages under `packages/`. See each package's README for usage documentation.

| Package                           | Path                              | Contents                                                                                  |
| --------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------- |
| `@gradhist/elevation-cursor-sync` | `packages/elevation-cursor-sync/` | `TrackPoint`, `CursorSync`, `useCursorSync`, `cursorToInterval`                           |
| `@gradhist/elevation-chart`       | `packages/elevation-chart/`       | `ElevationChart.vue`, `ZoomPanState`, `stretchInterval`, chart plugins and event handlers |
| `@gradhist/track-map-utils`       | `packages/track-map-utils/`       | GeoJSON converters, `zoomToTrack`                                                         |

The app consumes all three via npm workspace symlinks. `vite.config.ts` and `tsconfig.app.json` both carry path aliases that resolve package names directly to their TypeScript source, so no pre-build step is needed during development.

## Data Flow

```
GPX/FIT file (user upload)
       |
       v
  readSingleFile()  — detects FIT vs GPX, parses, returns FeatureCollection<LineString>
       |
       v
  GeoJSON FeatureCollection  ← stored in trackSources[] (raw data retained for live re-processing)
       |
       v
  GeoJsonLoader → TrackData (lat/lon/elevation points)
       |
       v
  extractFirstSegmentFirstTrack → first segment
       |
       v
  [interpolate ON]  makeEquidistantTrackAkima (Akima spline, 10 m spacing)
  [interpolate OFF] addDistancesToSegment (haversine distances, raw GPS spacing)
       |
       v
  TrackSegmentIndexed (distance metadata attached)
       |
       v
  computeGradients()  — per-segment { gradient %, distance m }, length = N-1
       |
       v
  TrackEntry { id, name, color, lineStringFeature, trackPoints, gradients }
       |
       v
  tracks: ComputedRef<TrackEntry[]>   (derived from trackSources + interpolate flag in App.vue)
       |
       ├── MapView              — one colored line per track on OpenLayers map
       ├── MultiElevationChart  — one elevation dataset per track (Chart.js, linear km axis)
       └── GradientHistogramChart — gradient survival curve per track (Chart.js, linear % axis)
```

## Application Structure

**App.vue** is the central orchestrator. It holds `trackSources` (raw FeatureCollections) and an `interpolate` flag. `tracks` is a `computed` derived from both — toggling `interpolate` immediately reprocesses all loaded tracks without re-uploading files. Child components receive `tracks: TrackEntry[]` as a prop and redraw reactively.

```
App.vue
  ├── DropPanel / DropField       — file upload (drag-and-drop + multi-file picker)
  ├── MapView                     — OpenLayers map, one colored track line per TrackEntry
  ├── MultiElevationChart         — elevation profile(s) with wheel/drag zoom+pan
  └── GradientHistogramChart      — gradient survival curve(s), one per track
```

State flows top-down via props. All components receive `tracks: TrackEntry[]`. There is no cursor sync between components in the multi-track view.

## Central Data Model: `TrackEntry`

```typescript
interface TrackEntry {
  id: string // crypto.randomUUID()
  name: string // filename without extension
  color: string // hex from TRACK_COLORS palette
  lineStringFeature: Feature<LineString> // for MapView
  trackPoints: TrackPoint[] // points with cumulative distance (10 m spacing when interpolated)
  gradients: GradientSegment[] // per-segment { gradient: %, distance: m }; length = trackPoints.length - 1
}
```

`gradients` stores raw per-segment values (gradient % + actual segment distance in metres) rather than a pre-computed curve. This lets `GradientHistogramChart` derive a global x-axis range across all loaded tracks before computing each curve, and correctly weights km by actual distance for both interpolated and raw tracks.

## Source File Reference

### Entry Points

| File          | Description                                                                                                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/main.ts` | Application bootstrap — creates Vue app with Pinia, imports Bootstrap CSS                                                                                                           |
| `src/App.vue` | Root component — holds `trackSources[]` (raw GeoJSON) and `interpolate` flag; `tracks` is a `computed` ref that re-derives `TrackEntry[]` on toggle; handles file loading and clear |

### Components (`src/components/`)

| File                         | Description                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| `MapView.vue`                | OpenLayers map; one vector feature per `TrackEntry`, styled by `track.color`; auto-zooms on update     |
| `MultiElevationChart.vue`    | Chart.js line chart with linear km x-axis; one dataset per track; wheel/drag/pinch zoom+pan            |
| `GradientHistogramChart.vue` | Chart.js line chart showing gradient survival curves; x-axis = gradient %, y-axis = km above threshold |
| `DropPanel.vue`              | File upload button wrapper (multi-file input)                                                          |
| `DropField.vue`              | Drag-and-drop file handler, emits `files-dropped` event                                                |

### Core Library (`src/lib/`)

> **Note on `TrackPoint` naming:** Two distinct types share this name. `TrackData.ts` exports `TrackPoint { lat, lon, elevation }` (raw GPS point). `@gradhist/elevation-cursor-sync` exports `TrackPoint { distance, elevation, lon, lat }` (resampled point with cumulative distance). Components use the elevation-cursor-sync version.

| File                    | Description                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TrackData.ts`          | Core data model. Types: `TrackPoint` (lat/lon/elevation), `TrackPointWithDistance` (adds distanceFromStart), `TrackSegment`, `TrackSegmentWithDistance`. `TrackData` manages multiple segments. `TrackSegmentIndexed` wraps a fixed-distance segment with virtual/internal index distinction, `slice`/`sliceSegment` for range extraction, and a `zoom(midpoint, factor)` function. |
| `InterpolateSegment.ts` | `makeEquidistantTrackAkima` — resamples a track to equidistant 10 m points using Akima spline interpolation. `addDistancesToSegment` — attaches cumulative haversine distances to raw GPS points without resampling (used when interpolation is disabled).                                                                                                                          |
| `GeoJsonLoader.ts`      | Converts GeoJSON FeatureCollections into internal `TrackData` objects                                                                                                                                                                                                                                                                                                               |
| `Gpx2Track.ts`          | Parses GPX XML into track data using `xpath` and `@xmldom/xmldom`                                                                                                                                                                                                                                                                                                                   |
| `Track2GeoJson.ts`      | Converts `TrackSegment` back to GeoJSON `LineString` features                                                                                                                                                                                                                                                                                                                       |
| `haversine.ts`          | Great-circle distance calculation between coordinates                                                                                                                                                                                                                                                                                                                               |
| `computeGradients.ts`   | Pure function — computes per-segment `GradientSegment[]` (`{ gradient: %, distance: m }`) from `TrackPoint[]` using actual inter-point distances; skips zero-distance segments                                                                                                                                                                                                      |
| `typeHelpers.ts`        | TypeScript utility type definitions                                                                                                                                                                                                                                                                                                                                                 |

### Application Helpers (`src/lib/app/`)

| File                               | Description                                                                                                                                                                         |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gpx2GeoJson.ts`                   | Wrapper — converts a GPX string to a GeoJSON FeatureCollection                                                                                                                      |
| `extractFirstSegmentFirstTrack.ts` | Extracts the first segment from the first track in a `TrackData` array                                                                                                              |
| `loadSingleFile.ts`                | Full pipeline: `File → TrackEntry`. Exports `featureCollectionToTrackEntry` (accepts `interpolate` flag) and `readFileToSource` (returns raw FC + name for App.vue's source store). |
| `transformHelpers.ts`              | `SegmentTransformManager` — manages zoom/pan viewport state (used by elevation chart package)                                                                                       |

### Types (`src/types/`)

| File            | Description                                                |
| --------------- | ---------------------------------------------------------- |
| `TrackEntry.ts` | `TrackEntry` interface and `TRACK_COLORS` palette constant |

### Elevation Sync Module (`packages/elevation-cursor-sync/src/`)

| File                  | Description                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `types.ts`            | `TrackPoint` interface (distance, elevation, lon, lat) and `CursorSync` interface                                                                |
| `useCursorSync.ts`    | Composable — single source of truth for hover position; `distance` ref + `nearestIndex` computed (binary search) + `setByDistance()` / `clear()` |
| `cursorToInterval.ts` | Helper — maps `cursor.nearestIndex` to a 1-based interval ID                                                                                     |
| `index.ts`            | Barrel export                                                                                                                                    |

### Elevation Chart Package (`packages/elevation-chart/src/`)

| File                                    | Description                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `ElevationChart.vue`                    | Vue 3 component — single-track elevation chart (not used by app, available for pkg consumers)     |
| `lib/ZoomState.ts`                      | `ZoomPanState` — tracks zoom level and pan offset, enforces min/max bounds                        |
| `lib/VerticalLinePlugin.ts`             | Chart.js plugin that draws a vertical cursor line                                                 |
| `lib/TransformPixelScale2ChartScale.ts` | Converts pixel pinch coordinates to chart data coordinates                                        |
| `lib/eventHandlers.ts`                  | `wheelEventHandler`, `panEventHandler`, `touchEventHandler` — reused by `MultiElevationChart.vue` |
| `lib/stretchInterval.ts`                | Pure math utility: stretches an interval around a midpoint by a factor                            |

### Map Utilities Package (`packages/track-map-utils/src/`)

| File                    | Description                                                                 |
| ----------------------- | --------------------------------------------------------------------------- |
| `geoJson2MapFeature.ts` | Converts GeoJSON features to OpenLayers features with coordinate projection |
| `zoomToTrack.ts`        | Auto-zooms the map to fit the track bounds                                  |

### File Reader (`src/lib/fileReader/`)

| File                 | Description                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| `readDroppedFile.ts` | Exports `readSingleFile(file)` and `readDroppedFile(files)` — detects FIT vs GPX, parses, returns GeoJSON |

### Garmin FIT File Support (`src/lib/fileReader/fit/`)

| File              | Description                                                                           |
| ----------------- | ------------------------------------------------------------------------------------- |
| `FitFile.ts`      | Decoder wrapper using `@garmin/fitsdk` — validates and decodes binary FIT files       |
| `Messages.ts`     | `RecordMessageList` and `StartStopList` classes for structured access to FIT messages |
| `types.ts`        | TypeScript type definitions for FIT file structures                                   |
| `fitsdk.d.ts`     | TypeScript declarations for the Garmin FIT SDK                                        |
| `intersect.ts`    | Filters record messages to active recording intervals (between start/stop events)     |
| `joinSegments.ts` | Joins nearby track segments into a single continuous track                            |

### State (`src/stores/`)

| File            | Description                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------- |
| `trackStore.ts` | Pinia store holding the current track segment (minimal usage — most state lives in App.vue) |

### Tests (`src/__tests__/`)

| File                          | Description                                     |
| ----------------------------- | ----------------------------------------------- |
| `App.spec.ts`                 | App component smoke test                        |
| `TrackData.spec.ts`           | TrackData and TrackSegmentIndexed unit tests    |
| `Track2GeoJson.spec.ts`       | GeoJSON conversion tests                        |
| `TpIndex.spec.ts`             | TrackPointIndex spatial query tests             |
| `ZoomState.spec.ts`           | Zoom state calculation tests                    |
| `transformHelpers.spec.ts`    | Segment transformation tests                    |
| `detectEqualElements.spec.ts` | Array duplicate detection tests                 |
| `computeGradients.spec.ts`    | Gradient computation unit tests                 |
| `appRendering.spec.ts`        | App multi-track rendering and UI behavior tests |

## Key Algorithms

### Gradient Histogram (`computeGradients.ts` + `GradientHistogramChart.vue`)

`computeGradients` calculates per-segment gradient using the actual distance between consecutive track points:

```
gradient_i = (elevation[i+1] - elevation[i]) / (distance[i+1] - distance[i]) * 100   (percent)
```

Segments with zero distance (duplicate GPS points) are skipped. Each segment carries its actual length in metres as `GradientSegment.distance`.

`GradientHistogramChart` builds a _gradient survival curve_ across all loaded tracks:

1. Collect all gradient values; derive global `gMin` and `gMax`.
2. Generate x-axis values from `gMin` to `gMax` in 0.5 % steps.
3. For each track and each threshold `g`, sum the actual segment distances:
   - `g >= 0`: `km = Σ distance of segments where gradient ≥ g / 1000`
   - `g < 0`: `km = Σ distance of segments where gradient ≤ g / 1000`
4. Plot each track as a line on a shared axis.

Weighting by actual distance (rather than counting segments × fixed interval) ensures the chart is correct whether interpolation is on or off.

### Akima Spline Interpolation (`InterpolateSegment.ts`)

Raw GPS tracks have unevenly spaced points. When interpolation is enabled (default), the app resamples tracks to equidistant 10 m intervals using Akima cubic spline interpolation (via `commons-math-interpolation`). Three separate splines are created for latitude, longitude, and elevation as functions of cumulative distance. This produces smooth elevation curves and consistent point spacing.

When interpolation is disabled, `addDistancesToSegment` attaches cumulative haversine distances to the raw GPS points without resampling. Gradients are then computed from the actual GPS spacing, which may be noisier but reflects the original recorded data.

### Multi-Track Color Assignment

`TRACK_COLORS` in `src/types/TrackEntry.ts` defines a palette of six colors. Each new `TrackEntry` is assigned `TRACK_COLORS[tracks.length % 6]` so colors cycle predictably and are consistent across the map, elevation chart, and histogram.
