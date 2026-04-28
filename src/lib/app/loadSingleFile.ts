import { readSingleFile } from '@/lib/fileReader/readDroppedFile'
import { GeoJsonLoader } from '@/lib/GeoJsonLoader'
import { extractFirstSegmentFirstTrack } from '@/lib/app/extractFirstSegmentFirstTrack'
import { makeEquidistantTrackAkima } from '@/lib/InterpolateSegment'
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
): TrackEntry {
  const tracks = GeoJsonLoader.loadFromGeoJson(fc)
  const segment = extractFirstSegmentFirstTrack(tracks)
  const equidistant = makeEquidistantTrackAkima(segment, POINT_DISTANCE)
  const indexed = new TrackSegmentIndexed(equidistant, POINT_DISTANCE)

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
export async function loadSingleFile(file: File, color: string): Promise<TrackEntry> {
  const fc = await readSingleFile(file)
  const name = file.name.replace(/\.(gpx|fit)$/i, '')
  return featureCollectionToTrackEntry(fc, name, color)
}
