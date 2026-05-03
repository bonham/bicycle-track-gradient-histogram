<template>
  <div class="chart-wrapper px-1">
    <div class="chart-controls">
      <label class="log-scale-label">
        <input type="checkbox" v-model="useLogScale" /> Log Y
      </label>
    </div>
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
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const isZoomed = ref(false)
const useLogScale = ref(false)

type TType = 'line'
type TData = { x: number; y: number }[]

let chartInstance: Chart<TType, TData, string> | null = null

function resetZoom() {
  chartInstance?.resetZoom()
  isZoomed.value = false
}

function buildCurve(gradients: GradientSegment[], gValues: number[]): TData {
  return gValues.map(g => ({
    x: g,
    y: g < 0
      ? gradients.filter(s => s.gradient <= g).reduce((sum, s) => sum + s.distance, 0) / 1000
      : gradients.filter(s => s.gradient >= g).reduce((sum, s) => sum + s.distance, 0) / 1000,
  }))
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
  chartInstance.options.scales.y.type = useLogScale.value ? 'logarithmic' : 'linear'
  chartInstance.options.scales.y.min = useLogScale.value ? undefined : 0
  chartInstance.update('none')
}

watch(useLogScale, applyYScale)

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
      chartInstance.options.plugins.legend.display = true
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
          type: 'linear',
          title: { display: true, text: 'km above threshold' },
          min: 0,
        },
      },
      plugins: {
        tooltip: { enabled: false },
        legend: { display: true },
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

.chart-controls {
  display: flex;
  justify-content: flex-end;
  padding: 2px 4px;
}

.log-scale-label {
  font-size: 0.8rem;
  cursor: pointer;
  user-select: none;
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
