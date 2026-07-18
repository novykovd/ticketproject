// Builds the `routes` + `route_stops` rows from the raw GTFS feed.
// Pure (no DB): give it the GTFS dir + the set of stop_ids that exist in our
// stops table, get back rows ready to insert. Kept separate from the seed script
// so the parsing can be dry-run without touching the database.
import fs from 'fs'
import { join } from 'path'
import { parseCSV } from './util.js'

export interface RouteRow { routeId: string; shortName: string; type: number | null }
export interface RouteStopRow { routeId: string; directionId: number; seq: number; stopId: string }

export function buildRouteStops(gtfsDir: string, knownStopIds: Set<string>): {
    routes: RouteRow[]
    routeStops: RouteStopRow[]
} {
    // 1. routes.txt -> our routes rows.
    const routes: RouteRow[] = (parseCSV(join(gtfsDir, 'routes.txt')) as any[]).map((r) => ({
        routeId: r.route_id,
        shortName: r.route_short_name,
        type: r.route_type === '' ? null : Number(r.route_type),
    }))

    // 2. trips.txt -> trip_id => {routeId, directionId}.
    const tripMeta = new Map<string, { routeId: string; directionId: number }>()
    for (const t of parseCSV(join(gtfsDir, 'trips.txt')) as any[]) {
        tripMeta.set(t.trip_id, {
            routeId: t.route_id,
            directionId: t.direction_id === '' ? 0 : Number(t.direction_id),
        })
    }

    // 3. stop_times.txt (~48MB) -> ordered [seq, stopId] per trip. Parse only the
    // three columns we need by index rather than building full row objects.
    const lines = fs.readFileSync(join(gtfsDir, 'stop_times.txt'), 'utf8').split('\n')
    // header: trip_id(0), arrival_time(1), departure_time(2), stop_id(3), stop_sequence(4), ...
    const stopsByTrip = new Map<string, Array<[number, string]>>()
    for (let i = 1; i < lines.length; i++) {
        const ln = lines[i]
        if (!ln) continue
        const c = ln.split(',')
        const tripId = c[0]
        let arr = stopsByTrip.get(tripId)
        if (!arr) { arr = []; stopsByTrip.set(tripId, arr) }
        arr.push([Number(c[4]), c[3]])   // [stop_sequence, stop_id]
    }

    // 4. Canonical trip per (route, direction) = the one visiting the most stops
    //    (the full pattern; ignores short-turns/diversions).
    const canonical = new Map<string, { tripId: string; count: number }>()
    for (const [tripId, stops] of stopsByTrip) {
        const meta = tripMeta.get(tripId)
        if (!meta) continue
        const key = `${meta.routeId}|${meta.directionId}`
        const prev = canonical.get(key)
        if (!prev || stops.length > prev.count) canonical.set(key, { tripId, count: stops.length })
    }

    // 5. Emit route_stops from each canonical trip: order by stop_sequence, drop
    //    any stop we don't have (FK safety), renumber seq 0..N.
    const routeStops: RouteStopRow[] = []
    for (const [key, { tripId }] of canonical) {
        const sep = key.lastIndexOf('|')
        const routeId = key.slice(0, sep)
        const directionId = Number(key.slice(sep + 1))
        const ordered = stopsByTrip.get(tripId)!
            .slice()
            .sort((x, y) => x[0] - y[0])
            .map(([, stopId]) => stopId)
            .filter((stopId) => knownStopIds.has(stopId))
        ordered.forEach((stopId, seq) => routeStops.push({ routeId, directionId, seq, stopId }))
    }

    return { routes, routeStops }
}
