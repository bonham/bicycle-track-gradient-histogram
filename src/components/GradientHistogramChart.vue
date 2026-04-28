<template>
  <div class="chart-container px-1">
    <canvas ref="canvasRef"></canvas>
  </div>
</template>

<script setup lang="ts">
import { onMounted, watchEffect } from 'vue';
import { ref } from 'vue';
import { Chart } from 'chart.js/auto';
import type { TrackEntry } from '@/types/TrackEntry';

const props = defineProps<{
  tracks: TrackEntry[]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)

type TType = 'line'
type TData = { x: number; y: number }[]

let chartInstance: Chart<TType, TData, string> | null = null

/**
 * For a gradient threshold g, computes how many km of track qualify:
 * - g >= 0: counts segments with gradient >= g (uphill at or steeper than g)
 * - g < 0:  counts segments with gradient <= g (downhill at or steeper than g)
 * Gradient values are in percent; each segment represents POINT_DISTANCE_M = 10 m.
 */
function buildCurve(gradients: number[], gValues: number[]): TData {
  return gValues.map(g => ({
    x: g,
    y: g < 0
      ? gradients.filter(v => v <= g).length * 10 / 1000
      : gradients.filter(v => v >= g).length * 10 / 1000,
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
    const allGradients = currentTracks.flatMap(t => t.gradients)
    const gMin = Math.floor(Math.min(...allGradients))
    const gMax = Math.ceil(Math.max(...allGradients))

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
  width: 100%;
  height: 250px;
}
canvas {
  width: 100%;
  height: 100%;
}
</style>
