// The route-lookup feature as ONE reusable call: outsourced planning (Google
// Routes) + our danger scoring. Both the CLI demo and the tRPC endpoint call
// this — the orchestration lives here once, not duplicated in each consumer.
import { resolveStopId, getStopsInfo } from '@ticketproject/db'
import { parseTransitRoute, type TransitLeg, type StopPoint } from './parseTransitRoute.js'
import { getTransitRoute, loadFixture, type LatLng, type RoutesSource } from './googleRoutes.js'
import { journeyDanger } from '../danger/index.js'

export interface JourneyStop {
    name: string
    stopId: string | null
    lat: number
    lon: number
    danger: number      // P(encounter) in [0,1); 0 if unresolved or no pings
    pingCount: number
}

export interface JourneyLeg {
    vehicle: string
    line: string
    headsign?: string
    stopCount?: number
    departureTime?: string
    arrivalTime?: string
    board: JourneyStop
    alight: JourneyStop
}

export interface JourneyReport {
    legs: JourneyLeg[]
    fellBack: boolean   // true if we substituted the fixture (dev only)
}

export interface JourneyOptions {
    source?: RoutesSource
    // Dev affordance: if the (live) response has no transit legs, substitute the
    // canned fixture so downstream work doesn't stall. NEVER pass this in prod —
    // it would return a fake Bratislava itinerary for whatever was asked.
    fallbackToFixture?: boolean
}

export async function getJourneyReport(
    origin: LatLng,
    destination: LatLng,
    opts: JourneyOptions = {},
): Promise<JourneyReport> {
    const response = await getTransitRoute(origin, destination, opts.source)
    let legs: TransitLeg[] = parseTransitRoute(response)

    let fellBack = false
    if (legs.length === 0 && opts.fallbackToFixture) {
        legs = parseTransitRoute(loadFixture())
        fellBack = true
    }

    // Resolve every board/alight coordinate to a GTFS stop_id. Promise.all runs
    // the small lookups concurrently rather than awaiting them one by one.
    const resolved = await Promise.all(
        legs.map(async (leg) => ({
            leg,
            boardId: await resolveStopId(leg.board.lat, leg.board.lon),
            alightId: await resolveStopId(leg.alight.lat, leg.alight.lon),
        })),
    )

    // Score every distinct journey stop in one join, then look up coords/names.
    const stopIds = [...new Set(resolved.flatMap((r) => [r.boardId, r.alightId]).filter(Boolean) as string[])]
    const dangers = await journeyDanger(stopIds)
    const info = await getStopsInfo(stopIds)
    const dByStop = new Map(dangers.map((d) => [d.stopId, d]))

    // Prefer the GTFS stop's data; fall back to Google's coord/name if a stop
    // didn't resolve, so a pin still shows (just with danger 0).
    const toStop = (pt: StopPoint, stopId: string | null): JourneyStop => {
        const s = stopId ? info[stopId] : undefined
        const d = stopId ? dByStop.get(stopId) : undefined
        return {
            name: s?.name ?? pt.name,
            stopId: stopId ?? null,
            lat: s?.lat ?? pt.lat,
            lon: s?.lon ?? pt.lon,
            danger: d?.danger ?? 0,
            pingCount: d?.pingCount ?? 0,
        }
    }

    return {
        fellBack,
        legs: resolved.map(({ leg, boardId, alightId }) => ({
            vehicle: leg.vehicle,
            line: leg.line,
            headsign: leg.headsign,
            stopCount: leg.stopCount,
            departureTime: leg.departureTime,
            arrivalTime: leg.arrivalTime,
            board: toStop(leg.board, boardId),
            alight: toStop(leg.alight, alightId),
        })),
    }
}
