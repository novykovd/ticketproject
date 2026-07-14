import { findBestSegment } from '../spatial/matcher.js'
import { addObservation } from '@ticketproject/db'
import type { RTree } from '../spatial/rtree.js'

interface GpsPoint {
    lat: number
    lon: number
}

interface ReportInput {
    from: GpsPoint
    to: GpsPoint
    type: string
    data?: unknown
}

/**
 * The seam between the matching engine and the DB. Always runs the matcher
 * (so route determination can't be bypassed), then persists the report at its
 * arrival point (`to`) via the dumb persistence layer, which resolves the stop.
 */
export function addReport(input: ReportInput, tree: RTree) {
    const matched = findBestSegment({
        minX: input.from.lat,
        minY: input.from.lon,
        maxX: input.to.lat,
        maxY: input.to.lon,
    }, tree) as any

    return addObservation({
        clerkUserId: 'anonymous',
        routeId: matched?.routeId ?? null,
        lat: input.to.lat,
        lon: input.to.lon,
        type: input.type,
        data: input.data,
    })
}
