// The route-lookup feature as ONE reusable call: outsourced planning (Google
// Routes) + our danger scoring. Both the CLI demo and the tRPC endpoint call
// this — the orchestration lives here once, not duplicated in each consumer.
import { resolveStopId, getStopsInfo, getRouteStopsBetween } from '@ticketproject/db'
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
    stops: JourneyStop[]   // ordered board -> alight, intermediate stops included
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

    // For each leg: resolve the endpoints, then expand to the FULL ordered stop
    // list via route_stops (board -> every intermediate -> alight). Endpoint
    // resolution runs concurrently.
    const expanded = await Promise.all(
        legs.map(async (leg) => {
            const [boardId, alightId] = await Promise.all([
                resolveStopId(leg.board.lat, leg.board.lon),
                resolveStopId(leg.alight.lat, leg.alight.lon),
            ])
            const stopIds = await getRouteStopsBetween(leg.line, boardId, alightId)
            return { leg, stopIds }
        }),
    )

    // Score every distinct stop across ALL legs in one join, then look up names.
    const allStopIds = [...new Set(expanded.flatMap((e) => e.stopIds))]
    const dangers = await journeyDanger(allStopIds)
    const info = await getStopsInfo(allStopIds)
    const dByStop = new Map(dangers.map((d) => [d.stopId, d]))

    // Every id from route_stops is a real GTFS stop, so info always has it.
    const fromGtfs = (stopId: string): JourneyStop => {
        const s = info[stopId]
        const d = dByStop.get(stopId)
        return {
            name: s?.name ?? stopId,
            stopId,
            lat: s?.lat ?? 0,
            lon: s?.lon ?? 0,
            danger: d?.danger ?? 0,
            pingCount: d?.pingCount ?? 0,
        }
    }
    // Fallback when a leg couldn't be expanded (endpoints didn't resolve): show
    // Google's board/alight so a pin still appears, unscored.
    const fromPoint = (pt: StopPoint): JourneyStop => ({
        name: pt.name, stopId: null, lat: pt.lat, lon: pt.lon, danger: 0, pingCount: 0,
    })

    return {
        fellBack,
        legs: expanded.map(({ leg, stopIds }) => ({
            vehicle: leg.vehicle,
            line: leg.line,
            headsign: leg.headsign,
            stopCount: leg.stopCount,
            departureTime: leg.departureTime,
            arrivalTime: leg.arrivalTime,
            stops: stopIds.length > 0
                ? stopIds.map(fromGtfs)
                : [fromPoint(leg.board), fromPoint(leg.alight)],
        })),
    }
}
