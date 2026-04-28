import type { Feature, LineString } from 'geojson'
import type { TrackPoint } from '@la-rampa/elevation-cursor-sync'

export interface TrackEntry {
  id: string
  name: string
  color: string
  lineStringFeature: Feature<LineString>
  trackPoints: TrackPoint[]
  gradients: number[]
}

export const TRACK_COLORS = ['#3b82f6', '#f97316', '#22c55e', '#a855f7', '#ef4444', '#14b8a6']
