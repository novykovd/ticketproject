// The route-lookup feature as ONE reusable call: outsourced planning (Google
// Routes) + our danger scoring. Both the CLI demo and the tRPC endpoint call
// this — the orchestration lives here once, not duplicated in each consumer.
import { resolveStopId, getStopNames } from '@ticketproject/db'
import { parseTransitRoute, type TransitLeg } from './parseTransitRoute.js'
import { getTransitRoute, loadFixture, type LatLng, type RoutesSource } from './googleRoutes.js'
import { journeyDanger } from '../danger/index.js'

export interface JourneyStop {
    name: string
    stopId: string | null
    danger: number      // P(encounter) in [0,1); 0 if unresolved or no pings
    pingCount: number
}

export interface JourneyLeg {
    vehicle: string
    line: string
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

    // Score every distinct journey stop in one join, then look up names.
    const stopIds = [...new Set(resolved.flatMap((r) => [r.boardId, r.alightId]).filter(Boolean) as string[])]
    const dangers = await journeyDanger(stopIds)
    const names = await getStopNames(stopIds)
    const dByStop = new Map(dangers.map((d) => [d.stopId, d]))

    const toStop = (fallbackName: string, stopId: string | null): JourneyStop => {
        const d = stopId ? dByStop.get(stopId) : undefined
        return {
            name: (stopId && names[stopId]) || fallbackName,
            stopId: stopId ?? null,
            danger: d?.danger ?? 0,
            pingCount: d?.pingCount ?? 0,
        }
    }

    return {
        fellBack,
        legs: resolved.map(({ leg, boardId, alightId }) => ({
            vehicle: leg.vehicle,
            line: leg.line,
            board: toStop(leg.board.name, boardId),
            alight: toStop(leg.alight.name, alightId),
        })),
    }
}
