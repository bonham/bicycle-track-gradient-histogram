import type { TrackPoint } from '@la-rampa/elevation-cursor-sync'

const POINT_DISTANCE_M = 10

/**
 * Computes per-segment gradient values from equidistant track points.
 * Returns an array of length (trackPoints.length - 1).
 * Each value is gradient in percent: (Δelev / POINT_DISTANCE_M) * 100.
 * Positive = ascending, negative = descending.
 */
export function computeGradients(trackPoints: TrackPoint[]): number[] {
  const result: number[] = []
  for (let i = 0; i < trackPoints.length - 1; i++) {
    const dElev = trackPoints[i + 1]!.elevation - trackPoints[i]!.elevation
    result.push((dElev / POINT_DISTANCE_M) * 100)
  }
  return result
}
