import type { Feature, LineString } from 'geojson'
import type { TrackPoint } from '@gradhist/elevation-cursor-sync'
import type { GradientSegment } from '@/lib/computeGradients'

export interface TrackEntry {
  id: string
  name: string
  color: string
  lineStringFeature: Feature<LineString>
  trackPoints: TrackPoint[]
  gradients: GradientSegment[]
}

export const TRACK_COLORS = ['#3b82f6', '#f97316', '#22c55e', '#a855f7', '#ef4444', '#14b8a6']
