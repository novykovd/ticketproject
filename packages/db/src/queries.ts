import { and, gte, lte, eq, inArray, sql } from 'drizzle-orm'
import { db } from './client'
import { observations, stops } from './schema'

// Empirically, 1318/1319 GTFS stops sit within 5m of a shape point
// (see server check:stops). Observations land on the matched segment, so 20m
// gives slack for the midpoint offset while still rejecting between-stop points.
const NEAREST_STOP_RADIUS_M = 20

// Degree → meter conversion (equirectangular approximation, good over a few km).
// Latitude is uniform worldwide; longitude shrinks toward the poles, so we scale
// it by cos(latitude) at Bratislava (~48°N).
const METERS_PER_DEG_LAT = 111320
const METERS_PER_DEG_LON = 74500 // 111320 * cos(48°)

function twoHoursAgo() {
    return new Date(Date.now() - 2 * 60 * 60 * 1000)
}

// Resolves a raw coordinate to the nearest GTFS stop within NEAREST_STOP_RADIUS_M.
// Exported because it's the reconciliation tool for mapping externally-sourced
// coordinates (e.g. Google Routes stops) onto our own GTFS stop_ids.
export async function resolveStopId(lat: number, lon: number): Promise<string | null> {
    const [row] = await db
        .select({
            stopId: stops.stopId,
            distM: sql<number>`sqrt(((${stops.lat} - ${lat}) * ${METERS_PER_DEG_LAT})^2 + ((${stops.lon} - ${lon}) * ${METERS_PER_DEG_LON})^2)`,
        })
        .from(stops)
        .orderBy(sql`2`)
        .limit(1)

    if (!row || row.distM > NEAREST_STOP_RADIUS_M) return null
    return row.stopId
}

// Reports at any of the given stops within the 2h window. The DB half of the
// route-lookup feature: given a journey's stop_ids, which have recent reports?
export async function getReportsByStops(stopIds: string[]) {
    if (stopIds.length === 0) return []
    return db
        .select({
            id: observations.id,
            type: observations.type,
            createdAt: observations.createdAt,
            stopId: observations.stopId,
            stopName: stops.name,
        })
        .from(observations)
        .innerJoin(stops, eq(observations.stopId, stops.stopId))
        .where(
            and(
                inArray(observations.stopId, stopIds),
                gte(observations.createdAt, twoHoursAgo()),
            )
        )
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
    createdAt?: Date   // omit for real reports (DB stamps now); seed backdates
}) {
    const stopId = await resolveStopId(input.lat, input.lon)
    const [row] = await db.insert(observations).values({ ...input, stopId }).returning()
    return row
}
