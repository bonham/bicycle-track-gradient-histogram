import { TrackSegmentIndexed } from '@/lib/TrackData'
import { stretchInterval } from '@gradhist/elevation-chart'
import throttle from 'lodash/throttle'

type ZoomFunction = (centerIndex: number, factor: number) => void
type PanFunction = (panDelta: number) => void

/**
 * Holds the initial segment and a current projection of that.
 * Further transformations can be applied to current segment, like zooming and panning. 
 */
class SegmentTransformManager {
  fullSegment: TrackSegmentIndexed
  currentSegment: TrackSegmentIndexed
  MIN_INTERVAL_LENGTH = 20

  constructor(fullSegment: TrackSegmentIndexed) {
    this.fullSegment = fullSegment
    this.currentSegment = fullSegment
  }

  /**
   * Returns zoomed indexed segment
   * 
   * @param virtualCenterIndex Center of zoom
   * @param factor Zoom factor ( > 0 )
   * @returns Zoomed Indexed segment
   */
  applyFactor(virtualCenterIndex: number, factor: number) {


    // zoom logic
    const curSeg = this.currentSegment
    const fullSeg = this.fullSegment

    const I_min = fullSeg.minIndex()
    const I_max = fullSeg.maxIndex()
    const current_start = curSeg.minIndex()
    const current_end = curSeg.maxIndex()
    const { start: newStart, end: newEnd } = stretchInterval(current_start, current_end, virtualCenterIndex, factor, I_min, I_max, this.MIN_INTERVAL_LENGTH)
    const zoomedIndexedSegment = fullSeg.slice(newStart, newEnd + 1) // from full segment
    this.currentSegment = zoomedIndexedSegment
    // console.log("Zoomed Segment:", zoomedIndexedSegment)
    return zoomedIndexedSegment
  }

  applyFactorInternal(internalCenterIndex: number, factor: number) {
    const virtualIdx = this.currentSegment.toVirtualIndex(internalCenterIndex)
    return this.applyFactor(virtualIdx, factor)
  }


  pan(delta: number) {
    const curSeg = this.currentSegment
    const fullSeg = this.fullSegment
    const I_min = fullSeg.minIndex()
    const I_max = fullSeg.maxIndex()
    const current_start = curSeg.minIndex()
    const current_end = curSeg.maxIndex()
    let newStart = current_start + delta
    let newEnd = current_end + delta
    // check boundaries
    if (newStart < I_min) {
      newStart = I_min
      newEnd = newStart + (current_end - current_start)
    }
    if (newEnd > I_max) {
      newEnd = I_max
      newStart = newEnd - (current_end - current_start)
    }
    const pannedSegment = fullSeg.slice(newStart, newEnd + 1) // from full segment
    this.currentSegment = pannedSegment
    return pannedSegment
  }

  /**
   * Returns initial segment
   */
  reset() {
    this.currentSegment = this.fullSegment
    //  this.currentZoomFactor = 1
    return this.fullSegment
  }
}

/**
 * Serializing and throttling of zoom commands coming from mousewheel
 */
const THROTTLE_INTERVAL = 100 // miliseconds
class ZoomEventQueue {

  zoomFunction: ZoomFunction
  throttledHandleZoom: (center: number, factor: number) => void

  accumulatedZoomFactor: number | null = null


  /**
   * 
   * @param zoomFunction Function which takes internal index and zoom factor as arguments
   */
  constructor(zoomFunction: ZoomFunction) {
    this.zoomFunction = zoomFunction

    // craft and store new wrapped function of the provided function
    const handleZoomBatched = (center: number, factor: number) => {
      this.zoomFunction(center, factor)
      // reset this to null to indicate zooming was performed 
      this.accumulatedZoomFactor = null

    }

    // Create throttled function which is only executed from time to time. 
    // if it is executed then it will set accumulatedZoomFactor to null - indicating all buffered events have been handled
    this.throttledHandleZoom = throttle(handleZoomBatched, THROTTLE_INTERVAL, { leading: false, trailing: true })
  }
  /**
   * Queues a zoom command
   * @param centerIndex Internal index ( mouse position in elevation chart )
   * @param factor zoom factor
   */
  queue(centerIndex: number, factor: number) {

    if (this.accumulatedZoomFactor === null) {

      // Status after the queue was run
      this.accumulatedZoomFactor = factor

    } else {

      // accumulated factor already there -> reapply factor
      this.accumulatedZoomFactor *= factor

    }
    console.log("Queue: CenterIndex", centerIndex, "Accumulated zoom factor:", this.accumulatedZoomFactor)
    // call the throttled handlezoom - it is possible that it is not called immediately , but later
    this.throttledHandleZoom(centerIndex, this.accumulatedZoomFactor)
  }
}

class PanEventQueue {

  panFunction: PanFunction
  throttledHandlePan: PanFunction

  accumulatedPanDelta: number | null = null

  /**
   * 
   * @param panFunction Function which takes internal index and pan factor as arguments
   */
  constructor(panFunction: PanFunction) {
    this.panFunction = panFunction

    // craft and store new wrapped function of the provided function
    const handlePanBatched = (delta: number) => {
      this.panFunction(delta)
      // reset this to null to indicate paning was performed 
      this.accumulatedPanDelta = null

    }

    // Create throttled function which is only executed from time to time. 
    // if it is executed then it will set accumulatedpandelta to null - indicating all buffered events have been handled
    this.throttledHandlePan = throttle(handlePanBatched, THROTTLE_INTERVAL, { leading: true, trailing: true })
  }
  /**
   * Queues a pan command
   * @param centerIndex Internal index ( mouse position in elevation chart )
   * @param delta pan delta
   */
  queue(delta: number) {

    if (this.accumulatedPanDelta === null) {

      // Status after the queue was run
      this.accumulatedPanDelta = delta

    } else {

      // accumulated delta already there -> reapply delta
      this.accumulatedPanDelta += delta

    }

    // call the throttled handlepan - it is possible that it is not called immediately , but later
    this.throttledHandlePan(delta)
  }
}

export { SegmentTransformManager, ZoomEventQueue, PanEventQueue, stretchInterval }

