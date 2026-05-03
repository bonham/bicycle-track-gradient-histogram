import { describe, test, expect } from 'vitest'
import { computeGradients } from '@/lib/computeGradients'
import type { TrackPoint } from '@gradhist/elevation-cursor-sync'

/**
 * Unit tests for computeGradients().
 *
 * The function computes per-segment gradient in percent using actual
 * distanceFromStart differences. Result length is always trackPoints.length - 1.
 */

function makePoints(elevations: number[]): TrackPoint[] {
  return elevations.map((elevation, i) => ({
    distance: i * 10,
    elevation,
    lon: 0,
    lat: 0,
  }))
}

describe('computeGradients', () => {

  test('returns empty array for a single point', () => {
    const result = computeGradients(makePoints([100]))
    expect(result).toEqual([])
  })

  test('returns empty array for empty input', () => {
    const result = computeGradients([])
    expect(result).toEqual([])
  })

  test('result length is trackPoints.length - 1', () => {
    const points = makePoints([100, 101, 102, 103, 104])
    expect(computeGradients(points)).toHaveLength(4)
  })

  test('flat segment yields 0% gradient', () => {
    const result = computeGradients(makePoints([200, 200]))
    expect(result[0]!.gradient).toBe(0)
  })

  test('ascending 1 m over 10 m yields 10% gradient', () => {
    const result = computeGradients(makePoints([100, 101]))
    expect(result[0]!.gradient).toBeCloseTo(10)
  })

  test('descending 1 m over 10 m yields -10% gradient', () => {
    const result = computeGradients(makePoints([100, 99]))
    expect(result[0]!.gradient).toBeCloseTo(-10)
  })

  test('steep ascent: 2 m over 10 m yields 20%', () => {
    const result = computeGradients(makePoints([50, 52]))
    expect(result[0]!.gradient).toBeCloseTo(20)
  })

  test('computes each segment independently', () => {
    // flat → ascent → descent → flat
    const result = computeGradients(makePoints([100, 100, 101, 100, 100]))
    expect(result[0]!.gradient).toBeCloseTo(0)   // flat
    expect(result[1]!.gradient).toBeCloseTo(10)  // +1 m over 10 m = 10%
    expect(result[2]!.gradient).toBeCloseTo(-10) // −1 m over 10 m = −10%
    expect(result[3]!.gradient).toBeCloseTo(0)   // flat
  })

  test('each segment carries the correct distance', () => {
    const result = computeGradients(makePoints([100, 101, 102]))
    expect(result[0]!.distance).toBeCloseTo(10)
    expect(result[1]!.distance).toBeCloseTo(10)
  })

  /**
   * Synthetic scenario: 2 km at exactly -1% grade (10m steps, -0.1 m each).
   * computeGradients should return gradient=-1 for every segment.
   * Summing distances for segments in [-1, -0.5) yields 2.0 km.
   */
  test('2 km at -1% grade: all gradients are -1%, histogram bin contains 2 km', () => {
    // 201 points × 10 m = 2000 m, elevation drops 0.1 m per step (-1%)
    const elevations = Array.from({ length: 201 }, (_, i) => 100 - i * 0.1)
    const points = makePoints(elevations)
    const gradients = computeGradients(points)

    expect(gradients).toHaveLength(200)
    gradients.forEach(s => expect(s.gradient).toBeCloseTo(-1, 5))

    // Simulate histogram bin [-1, -0.5): weight by actual distance
    const kmInBin = gradients
      .filter(s => Math.round(s.gradient * 10) / 10 === -1.0)
      .reduce((sum, s) => sum + s.distance, 0) / 1000
    expect(kmInBin).toBeCloseTo(2.0)
  })

  test('positive gradients sum matches total elevation gain', () => {
    const points = makePoints([100, 102, 104, 103, 105])
    const gradients = computeGradients(points)
    // Total gain: +2 +2 -1 +2 = +5 m; each pos segment * 10 m / 100 = gradient%
    const totalGainM = gradients
      .filter(s => s.gradient > 0)
      .reduce((acc, s) => acc + (s.gradient / 100) * s.distance, 0)
    expect(totalGainM).toBeCloseTo(6) // 2+2+2 = 6 m of ascending segments
  })

})
