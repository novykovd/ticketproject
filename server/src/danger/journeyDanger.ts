// Bridges the DB and the scorer: given the stops of a journey, return each stop's
// danger probability. One join fetches every nearby-recent ping for the whole set
// (no per-stop N+1); the pure scorer turns each stop's pings into a probability.
import { getPingsNearStops } from '@ticketproject/db'
import { stopDanger, pruneRadiusM, RELEVANCE_MIN, type Ping } from './danger.js'

export interface StopDanger {
    stopId: string
    danger: number    // P(encounter) in [0,1)
    pingCount: number // how many pings fed the score (0 = cheap empty case)
}

export async function journeyDanger(stopIds: string[]): Promise<StopDanger[]> {
    const now = Date.now()
    const pairs = await getPingsNearStops(stopIds, pruneRadiusM(), RELEVANCE_MIN)

    // Bucket the flat (stop, ping) pairs back under their stop. Seed every
    // journey stop so stops with no nearby pings still report danger 0.
    const byStop = new Map<string, Ping[]>()
    for (const id of stopIds) byStop.set(id, [])
    for (const row of pairs) {
        const ageMin = (now - new Date(row.createdAt).getTime()) / 60000
        byStop.get(row.stopId)?.push({ distM: row.distM, ageMin })
    }

    return stopIds.map((id) => {
        const pings = byStop.get(id) ?? []
        return { stopId: id, danger: stopDanger(pings), pingCount: pings.length }
    })
}
