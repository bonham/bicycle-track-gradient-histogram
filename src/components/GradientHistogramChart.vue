<template>
  <div class="chart-wrapper px-1">
    <div class="chart-container">
      <canvas ref="canvasRef" @dblclick="resetZoom"></canvas>
      <button v-if="isZoomed" class="reset-zoom-btn" @click="resetZoom">Reset zoom</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, watchEffect, ref, watch } from 'vue';
import { Chart } from 'chart.js/auto';
import zoomPlugin from 'chartjs-plugin-zoom';
import type { TrackEntry } from '@/types/TrackEntry';
import type { GradientSegment } from '@/lib/computeGradients';

Chart.register(zoomPlugin);

const props = defineProps<{
  tracks: TrackEntry[]
  zoomResetKey: number
  useLogScale: boolean
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

function buildCurve(gradients: GradientSegment[], gValues: number[]): TData {
  const sorted = [...gradients].sort((a, b) => a.gradient - b.gradient)
  const prefix = new Float64Array(sorted.length + 1)
  for (let i = 0; i < sorted.length; i++) prefix[i + 1] = prefix[i] + sorted[i].distance
  const total = prefix[sorted.length]

  return gValues.map(g => {
    let lo = 0, hi = sorted.length
    if (g < 0) {
      // upper bound: first index where gradient > g
      while (lo < hi) { const mid = (lo + hi) >>> 1; if (sorted[mid].gradient <= g) lo = mid + 1; else hi = mid }
      return { x: g, y: prefix[lo] / 1000 }
    } else {
      // lower bound: first index where gradient >= g
      while (lo < hi) { const mid = (lo + hi) >>> 1; if (sorted[mid].gradient < g) lo = mid + 1; else hi = mid }
      return { x: g, y: (total - prefix[lo]) / 1000 }
    }
  })
}

function buildTrackGValues(track: TrackEntry): number[] {
  const gradients = track.gradients.map(s => s.gradient)
  const gMin = Math.floor(Math.min(...gradients))
  const gMax = Math.ceil(Math.max(...gradients))
  const values: number[] = []
  for (let g = gMin; g <= gMax; g = Math.round((g + 0.5) * 10) / 10) {
    values.push(g)
  }
  return values
}

function applyYScale() {
  if (!chartInstance?.options?.scales?.y) return
  chartInstance.options.scales.y.type = props.useLogScale ? 'logarithmic' : 'linear'
  chartInstance.options.scales.y.min = props.useLogScale ? undefined : 0
  chartInstance.update('none')
}

watch(() => props.useLogScale, applyYScale)

let firstRun = true
watchEffect(
  () => {
    const currentTracks = props.tracks

    if (!chartInstance) return

    if (currentTracks.length === 0) {
      chartInstance.data.datasets = []
      chartInstance.update('none')
      return
    }

    chartInstance.data.datasets = currentTracks.map(track => {
      const gValues = buildTrackGValues(track)
      return {
        data: buildCurve(track.gradients, gValues),
        borderColor: track.color,
        fill: false,
        pointStyle: false as const,
        label: track.name,
      }
    })

    if (chartInstance.options.plugins?.legend) {
      chartInstance.options.plugins.legend.display = false
    }

    if (firstRun) {
      requestAnimationFrame(() => chartInstance && chartInstance.update('none'))
      firstRun = false
    } else {
      chartInstance.update('none')
    }
  },
  { flush: 'post' },
)

watch(
  () => props.zoomResetKey,
  () => {
    if (!chartInstance) return
    if (chartInstance.options.scales) {
      chartInstance.options.scales['x'] = {
        type: 'linear' as const,
        title: { display: true, text: 'Gradient threshold (%)' },
        min: undefined,
        max: undefined,
      }
    }
    chartInstance.resetZoom()
    isZoomed.value = false
  },
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
          type: 'logarithmic',
          title: { display: true, text: 'km above threshold' },
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
.chart-wrapper {
  position: relative;
  width: 100%;
}

.chart-container {
  position: relative;
  width: 100%;
  height: 400px;
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
