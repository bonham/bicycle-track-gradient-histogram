<template>
  <div ref="mapContainer" class="map p-0" />
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import { OSM, Vector as VectorSource } from 'ol/source';
import ImageTile from 'ol/ImageTile';
import { fromLonLat } from 'ol/proj';
import Style from 'ol/style/Style';
import Stroke from 'ol/style/Stroke';
import type { FeatureLike } from 'ol/Feature';
import { geojsonLineString2OpenLayersLineString, zoomToTrack } from '@gradhist/track-map-utils';
import type { TrackEntry } from '@/types/TrackEntry';

let map: Map;
const mapContainer = ref<HTMLDivElement | null>(null);

const props = defineProps<{
  tracks: TrackEntry[];
  zoomOnUpdate: boolean;
}>();

const trackSource = new VectorSource()
const trackLayer = new VectorLayer({
  source: trackSource,
  style: (feature: FeatureLike) =>
    new Style({ stroke: new Stroke({ color: feature.get('trackColor') as string, width: 4 }) }),
})

onMounted(async () => {
  if (!mapContainer.value) return;

  const defaultCenter = fromLonLat([8.67673, 49.41053]);
  const defaultZoom = 7;

  map = new Map({
    target: mapContainer.value,
    layers: [
      new TileLayer({
        source: new OSM({
          tileLoadFunction: (tile, src) => {
            const img = (tile as ImageTile).getImage() as HTMLImageElement;
            img.referrerPolicy = 'strict-origin-when-cross-origin';
            img.src = src;
          },
        }),
      }),
      trackLayer,
    ],
    view: new View({
      center: defaultCenter,
      zoom: defaultZoom,
    }),
  });

  watch(
    () => props.tracks,
    (newTracks) => {
      trackSource.clear()
      newTracks.forEach(track => {
        const olFeature = geojsonLineString2OpenLayersLineString(track.lineStringFeature)
        olFeature.set('trackColor', track.color)
        trackSource.addFeature(olFeature)
      })
      if (props.zoomOnUpdate && newTracks.length > 0) {
        zoomToTrack(map, trackSource)
      }
    },
    { immediate: true },
  )
});
</script>

<style scoped>
.map {
  width: 100%;
  height: 350px;
}
</style>
