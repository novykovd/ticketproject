// Standalone check for leg expansion, on a BIG trip. Hardcoded legs using real
// line termini from the feed (line 4 and line 3 end-to-end), so we exercise
// getRouteStopsBetween directly and watch full lines expand.
//   npm run demo:legs   (needs seed:routes to have run)
import { getRouteStopsBetween, getStopsInfo } from '@ticketproject/db'

// Endpoints are the termini of each line's longest (canonical) trip, so they're
// guaranteed to sit in route_stops and expand to the whole line.
const trip = [
    { vehicle: 'TRAM', line: '4', board: { id: '000000049700001', name: 'Zlaté piesky' }, alight: { id: '000000031000002', name: 'Pri kríži' } },
    { vehicle: 'TRAM', line: '3', board: { id: '000000076700001', name: 'Južné mesto' }, alight: { id: '000000015600002', name: 'Komisárky' } },
]

console.log(`expanding ${trip.length} leg(s):\n`)
for (const leg of trip) {
    const stopIds = await getRouteStopsBetween(leg.line, leg.board.id, leg.alight.id)
    const info = await getStopsInfo(stopIds)
    const expanded = stopIds.length > 2

    console.log(`${leg.vehicle} ${leg.line}: ${leg.board.name} -> ${leg.alight.name}`)
    console.log(`  ${stopIds.length} stops${expanded ? '' : '  (fell back to endpoints — line/stops not in route_stops)'}`)
    stopIds.forEach((id, i) => console.log(`   ${String(i + 1).padStart(2)}. ${info[id]?.name ?? id}`))
    console.log()
}
process.exit(0)
