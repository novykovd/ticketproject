// Toy end-to-end for the route-lookup feature: Google plan -> resolve stops ->
// danger. A thin CLI over getJourneyReport (the tRPC endpoint calls the same
// function) — this file only picks inputs and prints.
//   npm run demo:route            canned fixture (default — always works)
//   npm run demo:route -- --live  hit the real Google Routes API (needs a key)
import { getJourneyReport } from '../routing/journeyReport.js'

// Predetermined cross-city trip for --live: Farského (Petržalka) -> Vajnory.
const ORIGIN = { lat: 48.1271705627441, lon: 17.1167469024658 }
const DESTINATION = { lat: 48.2090873718262, lon: 17.2199592590332 }

const source = process.argv.includes('--live') ? 'live' : 'canned'
console.log(`mode: ${source.toUpperCase()}${source === 'canned' ? ' (pass --live to hit the real API)' : ''}\n`)

const { legs, fellBack } = await getJourneyReport(ORIGIN, DESTINATION, { source, fallbackToFixture: true })
if (fellBack) console.warn('live returned no transit legs (night / walkable) — fell back to fixture\n')

console.log(`${legs.length} transit leg(s):\n`)
for (const leg of legs) {
    const toward = leg.headsign ? ` toward ${leg.headsign}` : ''
    console.log(`${leg.vehicle} ${leg.line}${toward} — ${leg.stops.length} stops:`)
    for (const s of leg.stops) {
        const pct = String(Math.round(s.danger * 100)).padStart(3)
        console.log(`   ${pct}%  ${s.name.padEnd(22)} (${s.pingCount} pings)`)
    }
    console.log()
}
process.exit(0)
