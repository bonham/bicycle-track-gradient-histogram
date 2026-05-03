# @gradhist/track-map-utils

OpenLayers utilities for GPS track visualisation: spatial indexing, GeoJSON conversion, layer factories, and zoom helpers.

These are framework-agnostic (no Vue dependency) building blocks for OpenLayers-based map components that display GPS tracks with interactive cursor sync.

## Installation

```bash
npm install @gradhist/track-map-utils
```

**Peer dependencies:** `ol ^10.6`, `kdbush ^4.0.2`, `geokdbush ^2.0.1`

## API

### `TrackPointIndex`

Spatial index for fast nearest-track-point lookup (O(log n) via KDBush).

```ts
import { TrackPointIndex } from '@gradhist/track-map-utils'

// Build index from WGS-84 points (once per track load)
const index = new TrackPointIndex(latLonPoints) // [{ lon, lat }]

// On pointer move:
const nearestIdx = index.getNearestIndex({ lon: 8.67, lat: 49.41 })
```

### `getMapElements()`

Factory that creates the three pre-configured OpenLayers vector layers needed for track display.

```ts
import { getMapElements } from '@gradhist/track-map-utils'

const {
  baseTrackVectorSource,
  baseTrackVectorLayer, // blue, 4 px
  overlayVectorSource,
  overlayVectorLayer, // red, 3 px
  markerSource,
  markerLayer, // red circle
} = getMapElements()

const map = new Map({
  layers: [tileLayer, baseTrackVectorLayer, overlayVectorLayer, markerLayer],
  // ...
})
```

Default colours: base track `#37a3eb` (blue 4 px), overlay `#dc3912` (red 3 px), marker red circle radius 6.

### `MarkerOnTrack`

Manages a single position marker on the map.

```ts
import { MarkerOnTrack } from '@gradhist/track-map-utils'

const marker = new MarkerOnTrack(markerSource)

// After track loads — supply EPSG:3857 coordinates:
marker.setCoordinates(geometry.getCoordinates())

// On cursor change:
marker.setByIndex(nearestIndex) // move marker
marker.clear() // hide marker
```

### `geojsonLineString2OpenLayersLineString(feature)`

Converts a GeoJSON LineString (EPSG:4326) to an OpenLayers Feature (EPSG:3857).

```ts
import { geojsonLineString2OpenLayersLineString } from '@gradhist/track-map-utils'

const olFeature = geojsonLineString2OpenLayersLineString(geojsonLineString)
baseTrackVectorSource.addFeature(olFeature)
```

### `geojsonMultiLineString2OpenLayersMultiLineString(feature)`

Same as above but for MultiLineString features (e.g. multi-segment climb overlays).

### `zoomToTrack(map, source)`

Fits the map view to the extent of a track source with animation.

```ts
import { zoomToTrack } from '@gradhist/track-map-utils'

zoomToTrack(map, baseTrackVectorSource)
```

## Building a custom MapView

```vue
<script setup lang="ts">
import Map from 'ol/Map'
import View from 'ol/View'
import { Tile as TileLayer } from 'ol/layer'
import { OSM } from 'ol/source'
import { fromLonLat, transform } from 'ol/proj'
import { onMounted, watch } from 'vue'
import {
  TrackPointIndex,
  MarkerOnTrack,
  getMapElements,
  geojsonLineString2OpenLayersLineString,
  zoomToTrack,
} from '@gradhist/track-map-utils'
import type { CursorSync } from '@gradhist/elevation-cursor-sync'

const props = defineProps<{ cursor: CursorSync /* ... */ }>()

const { baseTrackVectorSource, baseTrackVectorLayer, markerSource, markerLayer } = getMapElements()
const marker = new MarkerOnTrack(markerSource)
let tpIndex: TrackPointIndex | undefined

onMounted(() => {
  const map = new Map({
    layers: [new TileLayer({ source: new OSM() }), baseTrackVectorLayer, markerLayer],
    view: new View({ center: fromLonLat([0, 0]), zoom: 4 }),
  })

  map.on('pointermove', (evt) => {
    const [lon, lat] = transform(
      map.getCoordinateFromPixel(evt.pixel),
      'EPSG:3857',
      'EPSG:4326',
    ) as [number, number]
    const idx = tpIndex?.getNearestIndex({ lon, lat })
    if (idx != null) props.cursor.setByDistance(myPoints[idx]!.distance)
  })

  watch(
    () => props.cursor.nearestIndex.value,
    (idx) => {
      idx == null ? marker.clear() : marker.setByIndex(idx)
    },
  )
})
</script>
```
