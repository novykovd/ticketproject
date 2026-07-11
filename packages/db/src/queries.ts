import { and, gte, lte, eq, sql } from 'drizzle-orm'
import { db } from './client'
import { observations, stops } from './schema'

const NEAREST_STOP_RADIUS_M = 100

function twoHoursAgo() {
    return new Date(Date.now() - 2 * 60 * 60 * 1000)
}

async function resolveStopId(lat: number, lon: number): Promise<string | null> {
    const [row] = await db
        .select({
            stopId: stops.stopId,
            distM: sql<number>`sqrt(((${stops.lat} - ${lat}) * 111320)^2 + ((${stops.lon} - ${lon}) * 74500)^2)`,
        })
        .from(stops)
        .orderBy(sql`2`)
        .limit(1)

    if (!row || row.distM > NEAREST_STOP_RADIUS_M) return null
    return row.stopId
}

export async function getReportsByViewport(
    minLat: number,
    maxLat: number,
    minLon: number,
    maxLon: number,
) {
    return db
        .select({
            id: observations.id,
            type: observations.type,
            lat: observations.lat,
            lon: observations.lon,
            createdAt: observations.createdAt,
            stopName: stops.name,
            stopLat: stops.lat,
            stopLon: stops.lon,
        })
        .from(observations)
        .leftJoin(stops, eq(observations.stopId, stops.stopId))
        .where(
            and(
                gte(observations.lat, minLat),
                lte(observations.lat, maxLat),
                gte(observations.lon, minLon),
                lte(observations.lon, maxLon),
                gte(observations.createdAt, twoHoursAgo()),
            )
        )
}

export async function getReportsByRoute(routeId: string) {
    return db
        .select({
            id: observations.id,
            type: observations.type,
            lat: observations.lat,
            lon: observations.lon,
            createdAt: observations.createdAt,
            stopName: stops.name,
        })
        .from(observations)
        .leftJoin(stops, eq(observations.stopId, stops.stopId))
        .where(
            and(
                eq(observations.routeId, routeId),
                gte(observations.createdAt, twoHoursAgo()),
            )
        )
}

export async function addObservation(input: {
    clerkUserId: string
    routeId?: string | null
    lat: number
    lon: number
    headingDeg?: number | null
    type: string
    data?: unknown
}) {
    const stopId = await resolveStopId(input.lat, input.lon)
    const [row] = await db.insert(observations).values({ ...input, stopId }).returning()
    return row
}
