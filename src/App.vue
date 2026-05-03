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
const interpolateInput = ref(0)
const interpolate = ref(0)
const zoomResetKey = ref(0)

let debounceTimer: ReturnType<typeof setTimeout> | null = null
function onInterpolateInput(event: Event) {
  const val = Math.max(0, Number((event.target as HTMLInputElement).value))
  interpolateInput.value = val
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { interpolate.value = val }, 400)
}

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
  zoomResetKey.value++
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
  zoomResetKey.value++
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
          <div class="d-flex align-items-center gap-1">
            <label for="interpolateInput" class="mb-0 small">Interpolate (m)</label>
            <input id="interpolateInput" type="number" class="form-control form-control-sm no-spinner" style="width: 80px" min="0"
              step="1" :value="interpolateInput" @input="onInterpolateInput" placeholder="0">
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
        <MapView :tracks="tracks" :zoom-reset-key="zoomResetKey" />
      </div>
    </DropField>
    <div class="py-3">
      <GradientHistogramChart :tracks="tracks" :zoom-reset-key="zoomResetKey" />
    </div>
    <div class="py-3 border-bottom">
      <MultiElevationChart :tracks="tracks" :zoom-reset-key="zoomResetKey" />
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

.no-spinner::-webkit-outer-spin-button,
.no-spinner::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.no-spinner {
  -moz-appearance: textfield;
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
