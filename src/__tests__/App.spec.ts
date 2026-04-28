import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import App from '../App.vue'

// Stub components that require DOM APIs (Chart.js / OpenLayers) unavailable in jsdom
const stubComponent = (name: string) => ({ name, props: ['tracks', 'zoomOnUpdate'], template: '<div />' })

vi.mock('@/lib/app/loadSingleFile', () => {
  const mockEntry = () => ({
    id: 'test-id',
    name: 'kl',
    color: '#3b82f6',
    lineStringFeature: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} },
    trackPoints: [],
    gradients: [],
  })
  return {
    featureCollectionToTrackEntry: vi.fn(() => mockEntry()),
    loadSingleFile: vi.fn(async () => mockEntry()),
  }
})

describe('App', () => {
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

  it('mounts and renders the app title', () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          MapView: stubComponent('MapView'),
          MultiElevationChart: stubComponent('MultiElevationChart'),
          GradientHistogramChart: stubComponent('GradientHistogramChart'),
        },
      },
    })
    expect(wrapper.text()).toContain('La Rampa')
  })
})
