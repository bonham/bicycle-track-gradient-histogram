<script setup lang="ts">
import MapView from '@/components/MapView.vue';
import MultiElevationChart from '@/components/MultiElevationChart.vue';
import GradientHistogramChart from '@/components/GradientHistogramChart.vue';
import DropField from '@/components/DropField.vue';
import DropPanel from '@/components/DropPanel.vue';
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
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
const interpolateInput = ref(100)
const interpolate = ref(interpolateInput.value)
const zoomResetKey = ref(0)
const useLogScale = ref(true)

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

function commonPrefix(names: string[]): string {
  if (names.length < 2) return ''
  let prefix = names[0]!
  for (let i = 1; i < names.length; i++) {
    while (!names[i]!.startsWith(prefix)) prefix = prefix.slice(0, -1)
    if (!prefix) return ''
  }
  return prefix
}

function commonSuffix(names: string[]): string {
  if (names.length < 2) return ''
  let suffix = names[0]!
  for (let i = 1; i < names.length; i++) {
    while (!names[i]!.endsWith(suffix)) suffix = suffix.slice(1)
    if (!suffix) return ''
  }
  return suffix
}

const abbreviateNameFn = computed(() => {
  const names = tracks.value.map(t => t.name)
  const prefix = commonPrefix(names)
  const suffix = commonSuffix(names)
  const stripPrefix = prefix.length >= 3
  const stripSuffix = suffix.length >= 3
  return (name: string): string => {
    let result = name
    if (stripPrefix) result = '..' + result.slice(prefix.length)
    if (stripSuffix) result = result.slice(0, result.length - suffix.length) + '..'
    if (result.length > 22) result = result.slice(0, 10) + '..' + result.slice(-10)
    return result
  }
})

const legendPanelRef = ref<HTMLElement | null>(null)
const legendPanelWidth = ref(200)

let resizeObserver: ResizeObserver | null = null
watch(legendPanelRef, (el) => {
  resizeObserver?.disconnect()
  resizeObserver = null
  if (el) {
    resizeObserver = new ResizeObserver(entries => {
      legendPanelWidth.value = entries[0]!.contentRect.width
    })
    resizeObserver.observe(el)
  }
})

const legendFontSize = computed(() => {
  const names = tracks.value.map(t => abbreviateNameFn.value(t.name))
  if (names.length === 0) return '0.85rem'
  const longestLen = Math.max(...names.map(s => s.length))
  // contentRect.width is padding-box inner width; grid splits it into 2 cols with columnGap
  const colWidth = (legendPanelWidth.value - 8) / 2  // 8px column-gap
  const textWidth = colWidth - 20 - 6               // 20px dot, 6px item gap
  // monospace char width ≈ 0.6 × font-size; 1rem = 16px
  const idealRem = textWidth / (longestLen * 0.6) / 16
  const clamped = Math.min(0.85, Math.max(0.5, idealRem))
  return `${clamped.toFixed(2)}rem`
})

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
  resizeObserver?.disconnect()
})
</script>

<template>
  <DropField @files-dropped="addFiles" class="container px-0 mx-auto border bg-light">
    <nav class="navbar mbb-0">
      <div class="container-fluid">
        <span class="fw-bold mb-0">Gradient Histogram</span>
        <div class="d-flex flex-row gap-2 align-items-center">
          <div class="d-flex align-items-center gap-1">
            <label for="interpolateInput" class="mb-0 small">Interpolate (m)</label>
            <input id="interpolateInput" type="number" class="form-control form-control-sm no-spinner"
              style="width: 80px" min="0" step="1" :value="interpolateInput" @input="onInterpolateInput"
              placeholder="0">
          </div>
          <label class="d-flex align-items-center gap-1 mb-0 small" style="cursor:pointer">
            <input type="checkbox" v-model="useLogScale" /> Log Y
          </label>
          <span class="border border-1 rounded px-2 py-1" @click="clearTracks">Clear</span>
          <DropPanel @files-dropped="addFiles">
            <label for="input" class="border border-1 rounded px-2 py-1 d-flex flex-row">
              Upload
            </label>
          </DropPanel>
        </div>
      </div>
    </nav>

    <!-- Map + Legend row -->
    <div class="map-legend-area border">
      <div class="map-square-wrapper">
        <MapView :tracks="tracks" :zoom-reset-key="zoomResetKey" />
      </div>
      <div class="legend-panel" ref="legendPanelRef" v-if="tracks.length > 0" :style="{ fontSize: legendFontSize }">
        <div v-for="track in tracks" :key="track.name" class="legend-item">
          <span class="legend-dot" :style="{ backgroundColor: track.color }"></span>
          <span class="legend-name">{{ abbreviateNameFn(track.name) }}</span>
        </div>
      </div>
    </div>

    <!-- Histogram: always full width -->
    <div class="py-3">
      <GradientHistogramChart :tracks="tracks" :zoom-reset-key="zoomResetKey" :use-log-scale="useLogScale" />
    </div>

    <!-- Elevation chart below histogram -->
    <div class="py-3 border-bottom">
      <MultiElevationChart :tracks="tracks" :zoom-reset-key="zoomResetKey" />
    </div>
  </DropField>
  <div v-if="showScrollHint" class="text-center row scroll-indicator">
    <div class="col-3"></div>
    <i class="col-1 bi bi-caret-down-fill animate-bounce"></i>
    <div class="col-4"></div>
    <i class="col-1 bi bi-caret-down-fill animate-bounce"></i>
    <div class="col-3"></div>
  </div>
</template>

<style scoped>
/* Map + Legend layout */
.map-legend-area {
  display: flex;
  flex-direction: column;
}

.map-square-wrapper {
  width: 100%;
  height: 260px;
  flex-shrink: 0;
}

.legend-panel {
  width: 100%;
  height: auto;
  max-height: 260px;
  padding: 12px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px 8px;
  align-content: start;
  overflow: hidden;
  box-sizing: border-box;
}

/* Desktop: map 60%, legend 40%, same height via flex stretch */
@media (min-width: 768px) {
  .map-legend-area {
    flex-direction: row;
    align-items: stretch;
  }

  .map-square-wrapper {
    width: 60%;
    height: 260px;
    flex-shrink: 0;
  }

  .legend-panel {
    flex: 1;
    height: auto;
    padding: 16px;
  }
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  overflow: hidden;
}

.legend-dot {
  display: inline-block;
  width: 20px;
  height: 4px;
  border-radius: 2px;
  flex-shrink: 0;
}

.legend-name {
  font-family: monospace;
}

/* Scroll hint */
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
