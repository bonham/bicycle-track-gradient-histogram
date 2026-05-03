import { createInterpolatorWithFallback } from "commons-math-interpolation";
import { haversineDistance } from './haversine';
import type { TrackSegment, TrackPointWithDistance, TrackSegmentWithDistance } from './TrackData';



const InterpolationMethod = "akima";

function makeEquidistantTrackAkima(coords: TrackSegment, interval: number): TrackSegmentWithDistance {

  const distances = [0];
  let totalDist = 0;

  for (let i = 1; i < coords.length; i++) {
    totalDist += haversineDistance(coords[i - 1]!, coords[i]!);
    distances.push(totalDist);
  }

  // Separate lat, lon, elev arrays
  const lats = coords.map(c => c.lat);
  const lons = coords.map(c => c.lon);
  const elevs = coords.map(c => c.elevation);

  // remove duplicate distances from distances lats lons and elevs 
  // these would cause issues with the interpolator
  // need to remove from end to start to keep indices valid
  const duplicateIndices = detectEqualElements(distances);
  for (let i = duplicateIndices.length - 1; i >= 0; i--) {
    const index = duplicateIndices[i]!;
    distances.splice(index, 1);
    lats.splice(index, 1);
    lons.splice(index, 1);
    elevs.splice(index, 1);
  }

  // Create Akima interpolators

  const latInterp = createInterpolatorWithFallback(InterpolationMethod, distances, lats);
  const lonInterp = createInterpolatorWithFallback(InterpolationMethod, distances, lons);
  const elevInterp = createInterpolatorWithFallback(InterpolationMethod, distances, elevs);

  // Generate equidistant points
  const newCoords: TrackSegmentWithDistance = [];

  for (let d = 0; d <= totalDist; d += interval) {

    const lat = latInterp(d);
    const lon = lonInterp(d);
    const elevation = elevInterp(d);

    const tp: TrackPointWithDistance = {
      lat,
      lon,
      elevation,
      distanceFromStart: d
    };
    newCoords.push(tp);
  }

  return newCoords;
}

/**
 * Searches array for elements which are equal previous element.
 * Indices of found elements are returned in an array
 */
function detectEqualElements(a: unknown[]): number[] {
  if (a.length === 0) return []
  const indices: number[] = []
  for (let i = 1; i < a.length; i++) {
    if (a[i] === a[i - 1]) {
      indices.push(i)
    }
  }
  return indices
}

export { makeEquidistantTrackAkima, detectEqualElements, addDistancesToSegment };

/**
 * Adds cumulative haversine distance to each point of a raw segment,
 * without resampling. Used when interpolation is disabled.
 */
function addDistancesToSegment(coords: TrackSegment): TrackSegmentWithDistance {
  let totalDist = 0
  return coords.map((p, i) => {
    if (i > 0) totalDist += haversineDistance(coords[i - 1]!, p)
    return { ...p, distanceFromStart: totalDist }
  })
}
