<template>
  <div class="chart-container px-1">
    <canvas ref="canvasRef" @dblclick="resetZoom"></canvas>
    <button v-if="isZoomed" class="reset-zoom-btn" @click="resetZoom">Reset zoom</button>
  </div>
</template>

<script setup lang="ts">
import { onMounted, watchEffect, ref } from 'vue';
import { Chart } from 'chart.js/auto';
import zoomPlugin from 'chartjs-plugin-zoom';
import type { TrackEntry } from '@/types/TrackEntry';
import type { GradientSegment } from '@/lib/computeGradients';

Chart.register(zoomPlugin);

const props = defineProps<{
  tracks: TrackEntry[]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const isZoomed = ref(false)

type TType = 'line'
type TData = { x: number; y: number }[]

let chartInstance: Chart<TType, TData, string> | null = null

function resetZoom() {
  chartInstance?.resetZoom()
  isZoomed.value = false
}

/**
 * For a gradient threshold g, computes how many km of track qualify:
 * - g >= 0: counts segments with gradient >= g (uphill at or steeper than g)
 * - g < 0:  counts segments with gradient <= g (downhill at or steeper than g)
 * Weights by actual segment distance — correct for both interpolated and raw tracks.
 */
function buildCurve(gradients: GradientSegment[], gValues: number[]): TData {
  return gValues.map(g => ({
    x: g,
    y: g < 0
      ? gradients.filter(s => s.gradient <= g).reduce((sum, s) => sum + s.distance, 0) / 1000
      : gradients.filter(s => s.gradient >= g).reduce((sum, s) => sum + s.distance, 0) / 1000,
  }))
}

let firstRun = true
watchEffect(
  () => {
    // Access reactive prop FIRST so Vue tracks it as a dependency,
    // even on the initial run when chartInstance is still null (pre-mount).
    const currentTracks = props.tracks

    if (!chartInstance) return

    if (currentTracks.length === 0) {
      chartInstance.data.datasets = []
      chartInstance.update('none')
      return
    }

    // Global gradient range across all tracks
    const allGradients = currentTracks.flatMap(t => t.gradients.map(s => s.gradient))
    const gMin = Math.floor(Math.min(...allGradients))
    const gMax = Math.ceil(Math.max(...allGradients))

    if (!isFinite(gMin) || !isFinite(gMax) || gMin > gMax) return

    // Build x-axis values at 0.5% steps
    const gValues: number[] = []
    for (let g = gMin; g <= gMax; g = Math.round((g + 0.5) * 10) / 10) {
      gValues.push(g)
    }

    chartInstance.data.datasets = currentTracks.map(track => ({
      data: buildCurve(track.gradients, gValues),
      borderColor: track.color,
      fill: false,
      pointStyle: false as const,
      label: track.name,
    }))

    if (chartInstance.options.plugins?.legend) {
      chartInstance.options.plugins.legend.display = currentTracks.length > 1
    }

    if (chartInstance.options.scales) {
      chartInstance.options.scales['x'] = {
        type: 'linear' as const,
        title: { display: true, text: 'Gradient threshold (%)' },
        min: gMin,
        max: gMax,
      }
    }

    chartInstance.resetZoom()
    isZoomed.value = false

    if (firstRun) {
      requestAnimationFrame(() => chartInstance && chartInstance.update('none'))
      firstRun = false
    } else {
      chartInstance.update('none')
    }
  },
  { flush: 'post' },
)

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return

  chartInstance = new Chart(canvas, {
    type: 'line' as TType,
    data: { datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: 'Gradient threshold (%)' },
        },
        y: {
          title: { display: true, text: 'km above threshold' },
          min: 0,
        },
      },
      plugins: {
        tooltip: { enabled: false },
        legend: { display: false },
        zoom: {
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode: 'x',
            onZoom: () => { isZoomed.value = true },
          },
          pan: {
            enabled: true,
            mode: 'x',
            onPan: () => { isZoomed.value = true },
          },
        },
      },
      elements: {
        point: { radius: 0 },
        line: { tension: 0, borderWidth: 2 },
      },
    },
  })
})
</script>

<style scoped>
.chart-container {
  position: relative;
  width: 100%;
  height: 250px;
}

canvas {
  width: 100%;
  height: 100%;
}

.reset-zoom-btn {
  position: absolute;
  top: 6px;
  right: 8px;
  padding: 2px 8px;
  font-size: 0.75rem;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid #aaa;
  border-radius: 4px;
  cursor: pointer;
}

.reset-zoom-btn:hover {
  background: #fff;
}
</style>
