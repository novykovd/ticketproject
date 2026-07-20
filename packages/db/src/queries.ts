import { and, gte, lte, eq, lt, inArray, sql, asc, desc } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from './client'
import { observations, stops, routes, routeStops } from './schema'

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

// Every recent ping within `radiusM` of any of the given journey stops, as flat
// (journeyStopId, distance, age-source) pairs. ONE join instead of a query per
// stop: SQL prunes by distance + time (the cheap index-friendly part), and the
// danger scorer does the Gaussian weighting in JS. The distance is the same
// equirectangular approximation resolveStopId uses, here between a journey stop
// and a ping's raw coordinate.
export async function getPingsNearStops(
    stopIds: string[],
    radiusM: number,
    sinceMinutes: number,
) {
    if (stopIds.length === 0) return []
    const cutoff = new Date(Date.now() - sinceMinutes * 60 * 1000)
    const distM = sql<number>`sqrt(((${stops.lat} - ${observations.lat}) * ${METERS_PER_DEG_LAT})^2 + ((${stops.lon} - ${observations.lon}) * ${METERS_PER_DEG_LON})^2)`
    return db
        .select({
            stopId: stops.stopId,
            type: observations.type,
            distM,
            createdAt: observations.createdAt,
        })
        .from(stops)
        // ON clause pairs a stop with a ping only if they're within radius —
        // this is the spatial prune; WHERE then restricts to the journey's
        // stops and the recency window.
        .innerJoin(observations, sql`${distM} <= ${radiusM}`)
        .where(
            and(
                inArray(stops.stopId, stopIds),
                gte(observations.createdAt, cutoff),
            )
        )
}

// Distinct stops that got a report within the window. Debug/demo helper for
// picking stops that actually have danger to show.
export async function getRecentlyReportedStopIds(sinceMinutes: number, limit = 8): Promise<string[]> {
    const cutoff = new Date(Date.now() - sinceMinutes * 60 * 1000)
    const rows = await db
        .selectDistinct({ stopId: observations.stopId })
        .from(observations)
        .where(and(gte(observations.createdAt, cutoff), sql`${observations.stopId} is not null`))
        .limit(limit)
    return rows.map((r) => r.stopId).filter(Boolean) as string[]
}

// stop_id -> name lookup for the given ids.
export async function getStopNames(stopIds: string[]): Promise<Record<string, string>> {
    if (stopIds.length === 0) return {}
    const rows = await db
        .select({ stopId: stops.stopId, name: stops.name })
        .from(stops)
        .where(inArray(stops.stopId, stopIds))
    return Object.fromEntries(rows.map((r) => [r.stopId, r.name]))
}

// stop_id -> {name, lat, lon} for the given ids. Used where the consumer needs
// to place the stop on a map, not just label it (e.g. journey danger pins).
export async function getStopsInfo(
    stopIds: string[],
): Promise<Record<string, { name: string; lat: number; lon: number }>> {
    if (stopIds.length === 0) return {}
    const rows = await db
        .select({ stopId: stops.stopId, name: stops.name, lat: stops.lat, lon: stops.lon })
        .from(stops)
        .where(inArray(stops.stopId, stopIds))
    return Object.fromEntries(rows.map((r) => [r.stopId, { name: r.name, lat: r.lat, lon: r.lon }]))
}

// Name search over stops for the From/To autocomplete. Our own data, so no
// Google Places API needed — and it only ever offers real stops.
// NOTE: accent-sensitive for now ("zlate" won't match "Zlaté"); enabling the
// Postgres `unaccent` extension would fix that later.
export async function searchStops(q: string, limit = 8) {
    const term = q.trim()
    if (term.length < 2) return []
    // DISTINCT ON name -> one row per stop name (platforms collapse to one entry).
    return db
        .selectDistinctOn([stops.name], { stopId: stops.stopId, name: stops.name, lat: stops.lat, lon: stops.lon })
        .from(stops)
        .where(sql`${stops.name} ILIKE ${'%' + term + '%'}`)
        .orderBy(stops.name)
        .limit(limit)
}

// Nearest stop to a coordinate, for "use my location". Unlike resolveStopId it
// returns the stop regardless of distance (no snapping threshold).
export async function getNearestStop(lat: number, lon: number) {
    const distM = sql<number>`sqrt(((${stops.lat} - ${lat}) * ${METERS_PER_DEG_LAT})^2 + ((${stops.lon} - ${lon}) * ${METERS_PER_DEG_LON})^2)`
    const [row] = await db
        .select({ stopId: stops.stopId, name: stops.name, lat: stops.lat, lon: stops.lon, distM })
        .from(stops)
        .orderBy(distM)
        .limit(1)
    return row ?? null
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

// Expands a transit leg into its full ordered stop list. Given the line's short
// name plus the resolved board/alight stop_ids, returns every stop_id from board
// to alight inclusive. Falls back to [board, alight] if it can't be expanded.
//
// Two SQL steps:
//   1. A SELF-JOIN of route_stops to itself (aliased `b` for board, `a` for
//      alight). We join the routes table (matching the line's short_name) to a
//      board-row and an alight-row that share the same route_id AND direction_id.
//      Requiring b.seq < a.seq picks the travel direction; sharing the route_id
//      picks the variant that actually contains both stops. -> route + direction
//      + the two seq numbers.
//   2. A range scan: every route_stops row for that route+direction whose seq is
//      between the two, ordered by seq. -> the stop array.
export async function getRouteStopsBetween(
    line: string,
    boardId: string | null,
    alightId: string | null,
): Promise<string[]> {
    const fallback = [boardId, alightId].filter(Boolean) as string[]
    if (!boardId || !alightId) return fallback

    const b = alias(routeStops, 'b') // the board end of the leg
    const a = alias(routeStops, 'a') // the alight end
    const [seg] = await db
        .select({
            routeId: b.routeId,
            directionId: b.directionId,
            boardSeq: b.seq,
            alightSeq: a.seq,
        })
        .from(routes)
        .innerJoin(b, and(eq(b.routeId, routes.routeId), eq(b.stopId, boardId)))
        .innerJoin(a, and(
            eq(a.routeId, routes.routeId),
            eq(a.directionId, b.directionId), // same direction as the board row
            eq(a.stopId, alightId),
        ))
        .where(and(eq(routes.shortName, line), lt(b.seq, a.seq)))
        .orderBy(desc(sql`${a.seq} - ${b.seq}`)) // prefer the longest-serving variant
        .limit(1)

    if (!seg) return fallback

    const rows = await db
        .select({ stopId: routeStops.stopId })
        .from(routeStops)
        .where(and(
            eq(routeStops.routeId, seg.routeId),
            eq(routeStops.directionId, seg.directionId),
            gte(routeStops.seq, seg.boardSeq),
            lte(routeStops.seq, seg.alightSeq),
        ))
        .orderBy(asc(routeStops.seq))
    return rows.map((r) => r.stopId)
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
