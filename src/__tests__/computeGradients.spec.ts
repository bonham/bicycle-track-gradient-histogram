import { describe, test, expect } from 'vitest'
import { computeGradients } from '@/lib/computeGradients'
import type { TrackPoint } from '@gradhist/elevation-cursor-sync'

/**
 * Unit tests for computeGradients().
 *
 * The function computes per-segment gradient in percent from equidistant
 * track points (10 m apart). Result length is always trackPoints.length - 1.
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
    expect(result[0]).toBe(0)
  })

  test('ascending 1 m over 10 m yields 10% gradient', () => {
    const result = computeGradients(makePoints([100, 101]))
    expect(result[0]).toBeCloseTo(10)
  })

  test('descending 1 m over 10 m yields -10% gradient', () => {
    const result = computeGradients(makePoints([100, 99]))
    expect(result[0]).toBeCloseTo(-10)
  })

  test('steep ascent: 2 m over 10 m yields 20%', () => {
    const result = computeGradients(makePoints([50, 52]))
    expect(result[0]).toBeCloseTo(20)
  })

  test('computes each segment independently', () => {
    // flat → ascent → descent → flat
    const result = computeGradients(makePoints([100, 100, 101, 100, 100]))
    expect(result[0]).toBeCloseTo(0)   // flat
    expect(result[1]).toBeCloseTo(10)  // +1 m over 10 m = 10%
    expect(result[2]).toBeCloseTo(-10) // −1 m over 10 m = −10%
    expect(result[3]).toBeCloseTo(0)   // flat
  })

  test('positive gradients sum matches total elevation gain', () => {
    const points = makePoints([100, 102, 104, 103, 105])
    const gradients = computeGradients(points)
    // Total gain: +2 +2 -1 +2 = +5 m; each pos segment * 10 m / 100 = gradient%
    const totalGainM = gradients
      .filter(g => g > 0)
      .reduce((acc, g) => acc + (g / 100) * 10, 0)
    expect(totalGainM).toBeCloseTo(6) // 2+2+2 = 6 m of ascending segments
  })

})
