// Toy end-to-end: transit route -> parse -> resolve stops to GTFS ids -> query
// reports. Proves the "planning (outsourced) + reports (ours)" seam.
//   npm run demo:route          uses the canned fixture (no key needed)
//   npm run demo:route -- --live calls the real Google Routes API for a
//                                predetermined Bratislava trip (needs a key)
import { resolveStopId, getReportsByStops } from '@ticketproject/db'
import { parseTransitRoute } from '../routing/parseTransitRoute.js'
import { loadFixture, fetchTransitRoute } from '../routing/googleRoutes.js'

// Predetermined trip for the --live demo: Hlavná stanica -> Trnavské mýto.
const ORIGIN = { lat: 48.157543182373, lon: 17.1067714691162 }
const DESTINATION = { lat: 48.1578369140625, lon: 17.1275081634521 }

const live = process.argv.includes('--live')

let response
if (live) {
    if (!process.env['GOOGLE_MAPS_API_KEY']) {
        console.error('--live needs GOOGLE_MAPS_API_KEY in your .env')
        process.exit(1)
    }
    console.log('mode: LIVE (Google Routes API)\n')
    response = await fetchTransitRoute(ORIGIN, DESTINATION)
} else {
    console.log('mode: CANNED (fixture — pass --live to hit the real API)\n')
    response = loadFixture()
}

const legs = parseTransitRoute(response)
console.log(`parsed ${legs.length} transit leg(s)\n`)

// Resolve every board/alight coordinate to a GTFS stop_id.
const resolved = []
for (const leg of legs) {
    const boardId = await resolveStopId(leg.board.lat, leg.board.lon)
    const alightId = await resolveStopId(leg.alight.lat, leg.alight.lon)
    resolved.push({ leg, boardId, alightId })
    console.log(`${leg.vehicle} ${leg.line}:`)
    console.log(`   board  ${leg.board.name.padEnd(18)} -> stop_id ${boardId ?? 'UNRESOLVED'}`)
    console.log(`   alight ${leg.alight.name.padEnd(18)} -> stop_id ${alightId ?? 'UNRESOLVED'}`)
}

// Collect the journey's stop_ids and ask our DB which have recent reports.
const stopIds = [...new Set(resolved.flatMap(r => [r.boardId, r.alightId]).filter(Boolean) as string[])]
const reports = await getReportsByStops(stopIds)

console.log(`\n--- reports on this journey (last 2h) ---`)
if (reports.length === 0) {
    console.log('none. (seed reports land on random stops; re-run seed for fresh data)')
} else {
    for (const r of reports) {
        const mins = Math.round((Date.now() - new Date(r.createdAt).getTime()) / 60000)
        console.log(`   ⚠️  ${r.type} at ${r.stopName} (${mins}m ago)`)
    }
}
process.exit(0)
