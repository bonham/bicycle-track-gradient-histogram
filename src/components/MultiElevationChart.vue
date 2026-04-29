<template>
  <div class="chart-container px-1">
    <canvas ref="canvasRef" @dblclick="resetZoom"></canvas>
    <button v-if="isZoomed" class="reset-zoom-btn" @click="resetZoom">Reset zoom</button>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watchEffect, watch } from 'vue';
import { Chart } from 'chart.js/auto';
import zoomPlugin from 'chartjs-plugin-zoom';
import type { TrackEntry } from '@/types/TrackEntry';

Chart.register(zoomPlugin);

const props = defineProps<{
  tracks: TrackEntry[]
  zoomResetKey: number
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

function getScaleX(min: number | undefined, max: number | undefined) {
  return {
    type: 'linear' as const,
    title: { display: true, text: 'Distance (km)' },
    min,
    max,
  }
}

function getScaleY(dataMin: number | undefined, dataMax: number | undefined) {
  let minMaxOpts = {}
  if (dataMin !== undefined && dataMax !== undefined) {
    const range = dataMax - dataMin
    const padding = range * 0.1
    const minY = Math.floor((dataMin - padding) / 10) * 10
    const maxY = Math.ceil((dataMax + padding) / 10) * 10
    minMaxOpts = { min: minY, max: maxY }
  }
  return { title: { display: true, text: 'Elevation (m)' }, ...minMaxOpts }
}

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

    chartInstance.data.datasets = currentTracks.map(track => ({
      data: track.trackPoints.map(p => ({ x: p.distance / 1000, y: p.elevation })),
      borderColor: track.color,
      fill: false,
      pointStyle: false as const,
      pointRadius: 5,
      pointBorderColor: '#ff0000',
      label: track.name,
    }))

    if (chartInstance.options.plugins?.legend) {
      chartInstance.options.plugins.legend.display = currentTracks.length > 1
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
    const currentTracks = props.tracks
    const maxKm = Math.max(
      ...currentTracks.map(t =>
        t.trackPoints.length > 0 ? t.trackPoints[t.trackPoints.length - 1]!.distance / 1000 : 0,
      ),
    )
    const allElevations = currentTracks.flatMap(t => t.trackPoints.map(p => p.elevation))
    const minY = Math.min(...allElevations)
    const maxY = Math.max(...allElevations)
    if (chartInstance.options.scales) {
      chartInstance.options.scales['x'] = { ...getScaleX(0, maxKm) }
      chartInstance.options.scales['y'] = { ...getScaleY(minY, maxY) }
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
        x: getScaleX(undefined, undefined),
        y: getScaleY(undefined, undefined),
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
        line: { tension: 0.002, borderWidth: 2 },
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
