import type { TrackPoint } from '@gradhist/elevation-cursor-sync'

export interface GradientSegment {
  gradient: number  // percent, positive = ascending
  distance: number  // metres, actual segment length
}

/**
 * Computes per-segment gradient values from track points.
 * Returns an array of length (trackPoints.length - 1).
 * Uses actual distance between consecutive points — works for both
 * equidistant (interpolated) and raw GPS tracks.
 */
export function computeGradients(trackPoints: TrackPoint[]): GradientSegment[] {
  const result: GradientSegment[] = []
  for (let i = 0; i < trackPoints.length - 1; i++) {
    const dist = trackPoints[i + 1]!.distance - trackPoints[i]!.distance
    if (dist <= 0) continue
    const dElev = trackPoints[i + 1]!.elevation - trackPoints[i]!.elevation
    result.push({ gradient: (dElev / dist) * 100, distance: dist })
  }
  return result
}
