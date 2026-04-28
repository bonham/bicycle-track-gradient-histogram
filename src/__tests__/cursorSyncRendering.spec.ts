import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, defineComponent } from 'vue'
import App from '../App.vue'

/**
 * Rendering tests for App.vue multi-track behavior.
 *
 * Uses stubbed MapView, MultiElevationChart, and GradientHistogramChart components
 * so tests do not depend on Chart.js or OpenLayers internals.
 *
 * Behavioral contract under test:
 *   - All three child components receive the same `tracks` array prop
 *   - Clear button appears only when at least one track is loaded
 *   - Clear button removes all tracks and hides itself
 *   - Track count badge reflects the number of loaded tracks
 */

// Capture props each stub receives so tests can assert on them
let capturedMapTracks: unknown = undefined
let capturedElevTracks: unknown = undefined
let capturedHistTracks: unknown = undefined

const MapViewStub = defineComponent({
  name: 'MapView',
  props: { tracks: { default: () => [] }, zoomOnUpdate: { default: false } },
  setup(props) { capturedMapTracks = props.tracks },
  template: '<div class="map-stub" />',
})

const MultiElevationChartStub = defineComponent({
  name: 'MultiElevationChart',
  props: { tracks: { default: () => [] } },
  setup(props) { capturedElevTracks = props.tracks },
  template: '<div class="elev-stub" />',
})

const GradientHistogramChartStub = defineComponent({
  name: 'GradientHistogramChart',
  props: { tracks: { default: () => [] } },
  setup(props) { capturedHistTracks = props.tracks },
  template: '<div class="hist-stub" />',
})

vi.mock('@/lib/app/loadSingleFile', () => {
  let callCount = 0
  const mockEntry = (name = 'kl') => ({
    id: `mock-id-${++callCount}`,
    name,
    color: '#3b82f6',
    lineStringFeature: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} },
    trackPoints: [],
    gradients: [],
  })
  return {
    featureCollectionToTrackEntry: vi.fn(() => mockEntry()),
    loadSingleFile: vi.fn(async (file: File) => mockEntry(file.name)),
  }
})

function mountApp() {
  capturedMapTracks = undefined
  capturedElevTracks = undefined
  capturedHistTracks = undefined

  return mount(App, {
    global: {
      stubs: {
        MapView: MapViewStub,
        MultiElevationChart: MultiElevationChartStub,
        GradientHistogramChart: GradientHistogramChartStub,
      },
    },
  })
}

describe('App multi-track rendering', () => {

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', vi.fn(class {
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
    }))
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ json: () => Promise.resolve({ type: 'FeatureCollection', features: [] }) }),
    ))
  })

  it('renders the La Rampa title', () => {
    const wrapper = mountApp()
    expect(wrapper.text()).toContain('La Rampa')
  })

  it('shows Upload button at all times', () => {
    const wrapper = mountApp()
    expect(wrapper.text()).toContain('Upload')
  })

  it('does not show Clear button before initialLoad resolves', () => {
    const wrapper = mountApp()
    // fetch has not resolved yet — tracks is still empty
    const clearBtn = wrapper.findAll('button').find(b => b.text() === 'Clear')
    expect(clearBtn).toBeUndefined()
  })

  it('shows Clear button and track badge after initial track loads', async () => {
    const wrapper = mountApp()
    await nextTick() // fetch resolves
    await nextTick() // Vue updates DOM
    expect(wrapper.find('button').text()).toBe('Clear')
    expect(wrapper.text()).toContain('1 track')
  })

  it('all three child components receive the same tracks array reference', async () => {
    mountApp()
    await nextTick()
    await nextTick()
    // Same reference, not just structural equality
    expect(capturedMapTracks).toBe(capturedElevTracks)
    expect(capturedElevTracks).toBe(capturedHistTracks)
    expect(Array.isArray(capturedMapTracks)).toBe(true)
  })

  it('clear button removes all tracks and hides itself', async () => {
    const wrapper = mountApp()
    await nextTick()
    await nextTick()
    expect(wrapper.find('button').text()).toBe('Clear')

    await wrapper.find('button').trigger('click')
    await nextTick()

    const clearBtn = wrapper.findAll('button').find(b => b.text() === 'Clear')
    expect(clearBtn).toBeUndefined()
    expect(capturedMapTracks).toEqual([])
  })

  it('track count badge increments when a second track is added via drop', async () => {
    const wrapper = mountApp()
    await nextTick()
    await nextTick()
    expect(wrapper.text()).toContain('1 track')

    // Simulate dropping a second file by emitting from DropField
    const dropField = wrapper.findComponent({ name: 'DropField' })
    const fakeFile = new File(['content'], 'route2.gpx', { type: 'application/gpx+xml' })
    const fakeFileList = { 0: fakeFile, length: 1, item: () => fakeFile, [Symbol.iterator]: function* () { yield fakeFile } } as unknown as FileList
    await dropField.vm.$emit('files-dropped', fakeFileList)
    await nextTick()
    await nextTick()

    expect(wrapper.text()).toContain('2 tracks')
  })
})
