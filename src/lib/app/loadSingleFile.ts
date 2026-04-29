import { readSingleFile } from '@/lib/fileReader/readDroppedFile'
import { GeoJsonLoader } from '@/lib/GeoJsonLoader'
import { extractFirstSegmentFirstTrack } from '@/lib/app/extractFirstSegmentFirstTrack'
import { makeEquidistantTrackAkima, addDistancesToSegment } from '@/lib/InterpolateSegment'
import { TrackSegmentIndexed } from '@/lib/TrackData'
import { Track2GeoJson } from '@/lib/Track2GeoJson'
import { computeGradients } from '@/lib/computeGradients'
import type { TrackEntry } from '@/types/TrackEntry'
import type { TrackPoint } from '@gradhist/elevation-cursor-sync'
import type { FeatureCollection, LineString } from 'geojson'

const POINT_DISTANCE = 10

/**
 * Converts a GeoJSON FeatureCollection into a TrackEntry.
 * Exported so App.vue can use it for the initial kl.json fetch.
 */
export function featureCollectionToTrackEntry(
  fc: FeatureCollection<LineString>,
  name: string,
  color: string,
  interpolate: boolean = true,
): TrackEntry {
  const tracks = GeoJsonLoader.loadFromGeoJson(fc)
  const segment = extractFirstSegmentFirstTrack(tracks)
  const source = interpolate ? makeEquidistantTrackAkima(segment, POINT_DISTANCE) : addDistancesToSegment(segment)
  const indexed = new TrackSegmentIndexed(source, POINT_DISTANCE)

  const trackPoints: TrackPoint[] = indexed.getSegment().map(p => ({
    distance: p.distanceFromStart,
    elevation: p.elevation,
    lon: p.lon,
    lat: p.lat,
  }))

  const lineStringFeature = new Track2GeoJson(indexed.getSegment()).toGeoJsonLineStringFeature()
  const gradients = computeGradients(trackPoints)

  return {
    id: crypto.randomUUID(),
    name,
    color,
    lineStringFeature,
    trackPoints,
    gradients,
  }
}

/**
 * Full pipeline: File → TrackEntry.
 */
export async function loadSingleFile(file: File, color: string, interpolate: boolean = true): Promise<TrackEntry> {
  const fc = await readSingleFile(file)
  const name = file.name.replace(/\.(gpx|fit)$/i, '')
  return featureCollectionToTrackEntry(fc, name, color, interpolate)
}

/**
 * Reads a file and returns the raw FeatureCollection + display name.
 * Used by App.vue to store source data for live re-processing on toggle.
 */
export async function readFileToSource(file: File): Promise<{ fc: FeatureCollection<LineString>, name: string }> {
  const fc = await readSingleFile(file)
  const name = file.name.replace(/\.(gpx|fit)$/i, '')
  return { fc, name }
}
