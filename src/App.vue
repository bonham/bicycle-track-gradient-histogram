<script setup lang="ts">
import MapView from '@/components/MapView.vue';
import MultiElevationChart from '@/components/MultiElevationChart.vue';
import GradientHistogramChart from '@/components/GradientHistogramChart.vue';
import DropField from '@/components/DropField.vue';
import DropPanel from '@/components/DropPanel.vue';
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { featureCollectionToTrackEntry, readFileToSource } from '@/lib/app/loadSingleFile';
import { TRACK_COLORS } from '@/types/TrackEntry';
import type { FeatureCollection, LineString } from 'geojson';

interface TrackSource {
  fc: FeatureCollection<LineString>
  name: string
  color: string
}

const trackSources = ref<TrackSource[]>([])
const exampleTrackLoaded = ref(false)
const interpolate = ref(true)

const tracks = computed(() =>
  trackSources.value.map(s => featureCollectionToTrackEntry(s.fc, s.name, s.color, interpolate.value))
)

function getNextColor(): string {
  return TRACK_COLORS[trackSources.value.length % TRACK_COLORS.length]!
}

async function addFiles(files: FileList): Promise<void> {
  if (exampleTrackLoaded.value) {
    trackSources.value = []
    exampleTrackLoaded.value = false
  }
  for (const file of Array.from(files)) {
    try {
      const { fc, name } = await readFileToSource(file)
      trackSources.value = [...trackSources.value, { fc, name, color: getNextColor() }]
    } catch (err) {
      console.error(`Failed to load ${file.name}:`, err)
    }
  }
}

function clearTracks(): void {
  trackSources.value = []
}

initialLoad().catch(err => console.error('Error in initial load:', err))

async function initialLoad(): Promise<void> {
  const response = await fetch('./kl.json')
  const fc = await response.json() as FeatureCollection<LineString>
  trackSources.value = [{ fc, name: 'kl', color: getNextColor() }]
  exampleTrackLoaded.value = true
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
  <div class="container px-0 mx-auto border bg-light">
    <nav class="navbar mbb-0">
      <div class="container-fluid">
        <span class="fw-bold mb-0">Gradient Histogram</span>
        <div class="d-flex flex-row gap-2 align-items-center">
          <div class="form-check form-switch mb-0 d-flex align-items-center gap-1">
            <input class="form-check-input" type="checkbox" role="switch" id="interpolateToggle" v-model="interpolate">
            <label class="form-check-label" for="interpolateToggle">Interpolate</label>
          </div>
          <span class="border border-1 rounded px-2 py-1" @click="clearTracks">Clear</span>
          <DropPanel @files-dropped="addFiles">
            <label for="input" class="border border-1 rounded px-2 py-1 d-flex flex-row">
              Upload
            </label>
          </DropPanel>
        </div>
      </div>

    </nav>
    <DropField @files-dropped="addFiles">
      <div class=" border px-0 py-0">
        <MapView :tracks="tracks" :zoom-on-update="true" />
      </div>
    </DropField>
    <div class="p-2 border-bottom">
      <MultiElevationChart :tracks="tracks" />
    </div>
    <div class="p-2">
      <GradientHistogramChart :tracks="tracks" />
    </div>
  </div>
  <div v-if="showScrollHint" class=" text-center row scroll-indicator">
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

.navbar {
  background-color: #f8f5e8 !important;
}

.container {
  background-color: white;
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
