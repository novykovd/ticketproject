// Toy end-to-end for the danger scorer. Picks stops that actually have recent
// reports (so the number isn't just 0), scores them, and prints a bar chart.
//   npm run demo:danger
import { getRecentlyReportedStopIds, getStopNames } from '@ticketproject/db'
import { journeyDanger, pruneRadiusM, RELEVANCE_MIN, TAU_MIN } from '../danger/index.js'

console.log('danger params:')
console.log(`  τ (survival)      ${TAU_MIN} min`)
console.log(`  relevance window  ${RELEVANCE_MIN} min`)
console.log(`  fetch radius      ${Math.round(pruneRadiusM())} m\n`)

const stopIds = await getRecentlyReportedStopIds(RELEVANCE_MIN)

if (stopIds.length === 0) {
    console.log('no reports in the last 90 min. run `npm run seed` first.')
    process.exit(0)
}

const results = await journeyDanger(stopIds)
const names = await getStopNames(stopIds)

console.log('danger by stop (last 90 min):')
for (const r of results.sort((a, b) => b.danger - a.danger)) {
    const pct = Math.round(r.danger * 100)
    const bar = '█'.repeat(Math.round(r.danger * 20)).padEnd(20, '·')
    const name = (names[r.stopId] ?? r.stopId).padEnd(22)
    console.log(`  ${bar} ${String(pct).padStart(3)}%  ${name} (${r.pingCount} ping${r.pingCount === 1 ? '' : 's'})`)
}
process.exit(0)
