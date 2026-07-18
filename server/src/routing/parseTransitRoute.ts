// Parses a Google Routes API computeRoutes TRANSIT response into a flat list of
// transit legs. Walks routes[0].legs[].steps[], keeping only steps that carry
// transitDetails (walking steps have none) and pulling out the board/alight
// stops + the line. This is the ONLY code coupled to Google's response shape —
// everything downstream works off our own TransitLeg type.

export interface StopPoint {
    name: string
    lat: number
    lon: number
}

export interface TransitLeg {
    line: string             // human label, e.g. "1" or "Tram 1"
    vehicle: string          // TRAM | BUS | TROLLEYBUS | SUBWAY ...
    headsign?: string        // direction / terminus the vehicle is signed for
    stopCount?: number       // stops between board and alight (intermediate + 1)
    departureTime?: string   // RFC-3339, board time
    arrivalTime?: string     // RFC-3339, alight time
    board: StopPoint
    alight: StopPoint
}

function toStopPoint(stop: any): StopPoint {
    return {
        name: stop.name,
        lat: stop.location.latLng.latitude,
        lon: stop.location.latLng.longitude,
    }
}

export function parseTransitRoute(response: any): TransitLeg[] {
    const route = response?.routes?.[0]
    if (!route) return []

    const legs: TransitLeg[] = []
    for (const leg of route.legs ?? []) {
        for (const step of leg.steps ?? []) {
            const td = step.transitDetails
            if (!td) continue // walking / non-transit step
            legs.push({
                line: td.transitLine?.nameShort ?? td.transitLine?.name ?? '?',
                vehicle: td.transitLine?.vehicle?.type ?? 'UNKNOWN',
                headsign: td.headsign,
                stopCount: td.stopCount,
                departureTime: td.stopDetails.departureTime,
                arrivalTime: td.stopDetails.arrivalTime,
                board: toStopPoint(td.stopDetails.departureStop),
                alight: toStopPoint(td.stopDetails.arrivalStop),
            })
        }
    }
    return legs
}
