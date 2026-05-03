import { gpx2GeoJson } from '@/lib/app/gpx2GeoJson';
import type { FeatureCollection, LineString } from 'geojson';
import { FitFile } from '@/lib/fileReader/fit/FitFile';
import { Buffer } from 'buffer';
import { Track2GeoJson } from '../Track2GeoJson';
import type { TrackSegment } from '../TrackData';

/**
 * Reads a single File and returns a GeoJSON FeatureCollection.
 * Supports GPX and Garmin FIT formats.
 */
export function readSingleFile(file: File): Promise<FeatureCollection<LineString>> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.addEventListener('load', () => {
      if (fr.result === null || !(fr.result instanceof ArrayBuffer)) {
        reject(new Error('FileReader result is null or not ArrayBuffer'))
        return
      }
      const buf = Buffer.from(fr.result)
      if (FitFile.isFit(buf)) {
        const fitFile = new FitFile(buf)
        const segments = fitFile.getRecordMessageList(+Infinity)
        if (segments.length < 1) {
          reject(new Error('No segments found in fit file'))
          return
        }
        const onlySegment = segments[0]!
        const trackData: TrackSegment = []
        onlySegment.getMessages().forEach((recordMessage) => {
          const [lat, lon] = recordMessage.getLatLon() as [number, number]
          const fitMsg = recordMessage.getFitMessage()
          const elevation = fitMsg.altitude
          if (elevation === undefined) throw Error('Elevation not defined')
          trackData.push({ lat, lon, elevation })
        })
        const t2g = new Track2GeoJson(trackData)
        const feature = t2g.toGeoJsonLineStringFeature()
        resolve({ type: 'FeatureCollection', features: [feature] })
      } else {
        const decoder = new TextDecoder('utf-8')
        const text = decoder.decode(fr.result)
        resolve(gpx2GeoJson(text))
      }
    })
    fr.readAsArrayBuffer(file)
  })
}

// Read dropped file, return promise with GeoJSON FeatureCollection
// Only first file in the list is considered
export function readDroppedFile(files: FileList): Promise<FeatureCollection<LineString>> {
  if (files.length < 1) return Promise.reject(new Error('Filelist is empty'))
  const thisFile = files[0]
  if (thisFile == null) return Promise.reject(new Error('File is null'))
  return readSingleFile(thisFile)
}
