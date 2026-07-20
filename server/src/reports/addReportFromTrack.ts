// Report from a captured GPS track (multi-sample). Builds consecutive direction
// vectors from the points, matches each to a segment, and majority-votes the
// winner — the multi-sample version of addReport. Writes the observation at the
// arrival point (last sample) and returns everything the UI needs to draw the
// result: the matched segment (polyline) + the arrival point.
import { findBestSegment } from '../spatial/matcher.js'
import { addObservation, getStopsInfo } from '@ticketproject/db'
import type { RTree } from '../spatial/rtree.js'

export interface TrackPoint { lat: number; lon: number }

export async function addReportFromTrack(points: TrackPoint[], type: string, tree: RTree) {
    // Vote: each consecutive pair is a direction vector; tally its best segment.
    const votes = new Map<string, { seg: any; count: number }>()
    for (let i = 0; i < points.length - 1; i++) {
        const seg = findBestSegment(
            { minX: points[i]!.lat, minY: points[i]!.lon, maxX: points[i + 1]!.lat, maxY: points[i + 1]!.lon },
            tree,
        ) as any
        if (!seg) continue
        const key = `${seg.shapeId}:${seg.minX},${seg.minY},${seg.maxX},${seg.maxY}`
        const v = votes.get(key)
        if (v) v.count++
        else votes.set(key, { seg, count: 1 })
    }

    let winner: any = null
    let best = 0
    for (const { seg, count } of votes.values()) if (count > best) { best = count; winner = seg }

    // Arrival = the last sample. (Later: infer along the submitted itinerary.)
    const arrival = points[points.length - 1]!
    const obs = await addObservation({
        clerkUserId: 'anonymous',
        routeId: winner?.routeId ?? null,
        lat: arrival.lat,
        lon: arrival.lon,
        type,
    })

    // The resolved arrival stop (with coords), so the UI can pin the stop rather
    // than the raw last GPS point. Null if nothing was within snapping range.
    let arrivalStop: { stopId: string; name: string; lat: number; lon: number } | null = null
    if (obs.stopId) {
        const info = await getStopsInfo([obs.stopId])
        const st = info[obs.stopId]
        if (st) arrivalStop = { stopId: obs.stopId, name: st.name, lat: st.lat, lon: st.lon }
    }

    console.log(`[matchTrack] ${points.length} pts -> shape ${winner?.shapeId ?? 'none'} (${best}/${points.length - 1} votes) -> obs #${obs.id} @ ${arrival.lat.toFixed(5)},${arrival.lon.toFixed(5)} stop ${arrivalStop?.name ?? 'unresolved'}`)

    return {
        shapeId: (winner?.shapeId ?? null) as string | null,
        segment: winner
            ? { from: { lat: winner.minX, lon: winner.minY }, to: { lat: winner.maxX, lon: winner.maxY } }
            : null,
        arrival: { lat: arrival.lat, lon: arrival.lon },
        arrivalStop,
        stopId: obs.stopId,
        votes: best,
        totalVectors: points.length - 1,
    }
}
