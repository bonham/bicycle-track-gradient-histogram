<script setup lang="ts">
import MapView from '@/components/MapView.vue';
import MultiElevationChart from '@/components/MultiElevationChart.vue';
import GradientHistogramChart from '@/components/GradientHistogramChart.vue';
import DropField from '@/components/DropField.vue';
import DropPanel from '@/components/DropPanel.vue';
import { ref, onMounted, onUnmounted } from 'vue';
import { loadSingleFile, featureCollectionToTrackEntry } from '@/lib/app/loadSingleFile';
import { TRACK_COLORS } from '@/types/TrackEntry';
import type { TrackEntry } from '@/types/TrackEntry';
import type { FeatureCollection, LineString } from 'geojson';

const tracks = ref<TrackEntry[]>([])

function getNextColor(): string {
  return TRACK_COLORS[tracks.value.length % TRACK_COLORS.length]!
}

async function addFiles(files: FileList): Promise<void> {
  for (const file of Array.from(files)) {
    try {
      const entry = await loadSingleFile(file, getNextColor())
      tracks.value = [...tracks.value, entry]
    } catch (err) {
      console.error(`Failed to load ${file.name}:`, err)
    }
  }
}

function clearTracks(): void {
  tracks.value = []
}

initialLoad().catch(err => console.error('Error in initial load:', err))

async function initialLoad(): Promise<void> {
  const response = await fetch('./kl.json')
  const geojson = await response.json() as FeatureCollection<LineString>
  const entry = featureCollectionToTrackEntry(geojson, 'kl', getNextColor())
  tracks.value = [entry]
}

// Scroll hint
const showScrollHint = ref(false)

const checkScrollHint = () => {
  const scrollable = document.documentElement.scrollHeight > window.innerHeight
  const scrolledToBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 10
  showScrollHint.value = scrollable && !scrolledToBottom
}

onMounted(() => {
  checkScrollHint()
  window.addEventListener('scroll', checkScrollHint)
  window.addEventListener('resize', checkScrollHint)
})

onUnmounted(() => {
  window.removeEventListener('scroll', checkScrollHint)
  window.removeEventListener('resize', checkScrollHint)
})
</script>

<template>
  <div class="container py-0 px-3 mx-auto">
    <nav class="row navbar bg-body-tertiary mb-2">
      <div class="container-fluid">
        <span class="fw-bold mb-0">Gradient Histogram</span>
        <span v-if="tracks.length > 0" class="badge bg-secondary me-2">
          {{ tracks.length }} track{{ tracks.length > 1 ? 's' : '' }}
        </span>
        <button v-if="tracks.length > 0" class="btn btn-outline-secondary btn-sm me-2"
          @click="clearTracks">Clear</button>
        <DropPanel @files-dropped="addFiles">
          <label for="input" class="border border-1 rounded px-2 py-1 d-flex flex-row">
            Upload
          </label>
        </DropPanel>
      </div>
    </nav>
    <DropField @files-dropped="addFiles">
      <div class="row border py-1">
        <MapView :tracks="tracks" :zoom-on-update="true" />
      </div>
    </DropField>
    <div class="row my-3 py-3 border">
      <MultiElevationChart :tracks="tracks" />
    </div>
    <div class="row my-3 py-3 border">
      <GradientHistogramChart :tracks="tracks" />
    </div>
  </div>
  <div v-if="showScrollHint" class="row text-center scroll-indicator">
    <div class="col-3"></div>
    <i class="col-1 bi bi-caret-down-fill animate-bounce"></i>
    <div class="col-4"></div>
    <i class="col-1 bi bi-caret-down-fill animate-bounce"></i>
    <div class="col-3"></div>
  </div>
</template>

<style scoped>
.scroll-indicator {
  position: fixed;
  bottom: 0px;
  left: 50%;
  width: 100%;
  font-size: 2rem;
  color: #6c757d;
  z-index: 1000;
  animation: bounce 2.5s infinite;
  opacity: 0.5;
  pointer-events: none;
}

@keyframes bounce {

  0%,
  100% {
    transform: translateX(-50%) translateY(0);
  }

  50% {
    transform: translateX(-50%) translateY(6px);
  }
}
</style>
