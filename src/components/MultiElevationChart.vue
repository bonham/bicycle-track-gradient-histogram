<template>
  <div class="chart-container px-1">
    <canvas ref="canvasRef"></canvas>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watchEffect } from 'vue';
import { Chart } from 'chart.js/auto';
import {
  ZoomPanState,
  type DataInterval,
  wheelEventHandler,
  panEventHandler,
  touchEventHandler,
  TransformPixelScale2ChartScale,
} from '@la-rampa/elevation-chart';
import type { TrackEntry } from '@/types/TrackEntry';

const ZOOM_SENSITIVITY = 0.001

const props = defineProps<{
  tracks: TrackEntry[]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)

type TType = 'line'
type TData = { x: number; y: number }[]

let chartInstance: Chart<TType, TData, string> | null = null
const viewportRef = ref<DataInterval | null>(null)

// Rebuild datasets and reset viewport whenever tracks change
let firstRun = true
watchEffect(
  () => {
    // Access reactive prop FIRST so Vue tracks it as a dependency,
    // even on the initial run when chartInstance is still null (pre-mount).
    const currentTracks = props.tracks

    if (!chartInstance) return

    if (currentTracks.length === 0) {
      chartInstance.data.datasets = []
      viewportRef.value = null
      chartInstance.update('none')
      return
    }

    chartInstance.data.datasets = currentTracks.map(track => ({
      data: track.trackPoints.map(p => ({ x: p.distance / 1000, y: p.elevation })),
      borderColor: track.color,
      fill: false,
      pointStyle: false as const,
      label: track.name,
    }))

    const maxKm = Math.max(
      ...currentTracks.map(t =>
        t.trackPoints.length > 0 ? t.trackPoints[t.trackPoints.length - 1]!.distance / 1000 : 0,
      ),
    )
    viewportRef.value = { start: 0, end: maxKm }

    if (chartInstance.options.scales) {
      chartInstance.options.scales['x'] = { ...getScaleX(0, maxKm) }
    }

    // compute global y range
    const allElevations = currentTracks.flatMap(t => t.trackPoints.map(p => p.elevation))
    const minY = Math.min(...allElevations)
    const maxY = Math.max(...allElevations)
    if (chartInstance.options.scales) {
      chartInstance.options.scales['y'] = { ...getScaleY(minY, maxY) }
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
      },
      elements: {
        point: { radius: 0 },
        line: { tension: 0.2, borderWidth: 2 },
      },
    },
  })

  // drag-to-pan state
  let isDragging = false
  let dragStartX: number | undefined

  canvas.addEventListener('mousedown', (event) => {
    isDragging = true
    dragStartX = getChartX(canvas, event.clientX)
  })
  canvas.addEventListener('mouseup', () => {
    isDragging = false
    dragStartX = undefined
  })

  function updateViewport(interval: DataInterval) {
    viewportRef.value = interval
    if (chartInstance?.options.scales) {
      chartInstance.options.scales['x'] = { ...getScaleX(interval.start, interval.end) }
      chartInstance.update('none')
    }
  }

  // wheel zoom and mouse-move pan — re-registered when tracks change to rebuild ZoomPanState
  let oldWheelHandler: ((e: WheelEvent) => void) | undefined
  let oldMouseMoveHandler: ((e: MouseEvent) => void) | undefined

  watchEffect(() => {
    if (props.tracks.length === 0) return

    if (oldWheelHandler) canvas.removeEventListener('wheel', oldWheelHandler)
    if (oldMouseMoveHandler) canvas.removeEventListener('mousemove', oldMouseMoveHandler)

    const maxKm = Math.max(
      ...props.tracks.map(t =>
        t.trackPoints.length > 0 ? t.trackPoints[t.trackPoints.length - 1]!.distance / 1000 : 0,
      ),
    )
    const baseInterval: DataInterval = { start: 0, end: maxKm }
    const zoomState = new ZoomPanState(ZOOM_SENSITIVITY, baseInterval)

    const newWheelHandler = (event: WheelEvent) => {
      event.preventDefault()
      const xPos = getChartX(canvas, event.clientX)
      if (xPos === undefined) return
      wheelEventHandler(event.deltaY, xPos, zoomState, updateViewport)
    }
    canvas.addEventListener('wheel', newWheelHandler)
    oldWheelHandler = newWheelHandler

    const newMouseMoveHandler = (event: MouseEvent) => {
      if (isDragging) {
        const xCurrent = getChartX(canvas, event.clientX)
        if (xCurrent === undefined || dragStartX === undefined) return
        panEventHandler(-(xCurrent - dragStartX), zoomState, updateViewport)
      }
    }
    canvas.addEventListener('mousemove', newMouseMoveHandler)
    oldMouseMoveHandler = newMouseMoveHandler

    // touch pinch-zoom
    const tpc = new TransformPixelScale2ChartScale()
    canvas.addEventListener('touchstart', (event) => {
      event.preventDefault()
      if (event.touches.length === 2 && chartInstance) {
        tpc.setChartStartInterval(zoomState.getCurrentInterval())
        const x0 = 0
        const p0 = chartInstance.scales['x']!.getPixelForValue(x0)
        const x1 = (chartInstance.options.scales!['x']!.max as number) ?? maxKm
        const p1 = chartInstance.scales['x']!.getPixelForValue(x1)
        tpc.setPoints(p0, x0, p1, x1)
        tpc.setPixelStartInterval({ start: event.touches[0]!.clientX, end: event.touches[1]!.clientX })
      }
    })
    canvas.addEventListener('touchmove', (event) => {
      if (event.touches.length === 2) {
        event.preventDefault()
        tpc.setPixelPinchedInterval({ start: event.touches[0]!.clientX, end: event.touches[1]!.clientX })
        touchEventHandler(tpc.getChartPinchedInterval(), zoomState, updateViewport)
      }
    })
  })
})

function getChartX(canvas: HTMLCanvasElement, clientX: number): number | undefined {
  if (!chartInstance) return undefined
  const rect = canvas.getBoundingClientRect()
  return chartInstance.scales['x']?.getValueForPixel(clientX - rect.left)
}
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
