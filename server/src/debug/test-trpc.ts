import { createCallerFactory } from '../api/trpc.js'
import { appRouter } from '../api/router.js'

const createCaller = createCallerFactory(appRouter)
const caller = createCaller({ auth: { userId: null } })

// query: viewport — should return seeded rows
const viewport = await caller.reports.byViewport({
    minLat: 48.05, maxLat: 48.25,
    minLon: 16.95, maxLon: 17.25,
})
console.log(`byViewport: ${viewport.length} rows`)
console.log(viewport[0])

// query: route — seeded rows have no routeId so expect 0
const route = await caller.reports.byRoute({ routeId: '99' })
console.log(`\nbyRoute '99': ${route.length} rows`)

// mutation: add — runs the matcher and writes to DB
const added = await caller.reports.add({
    from: { lat: 48.1486, lon: 17.1077 },
    to:   { lat: 48.1502, lon: 17.1143 },
    type: 'ticket_inspector',
})
console.log(`\nadd result:`, added)

// query: journey — canned route, danger-scored. Force canned so the test is
// offline/deterministic even though a key is present in .env.
process.env['ROUTES_SOURCE'] = 'canned'
const journey = await caller.reports.journey({
    origin: { lat: 48.1271705627441, lon: 17.1167469024658 },
    destination: { lat: 48.2090873718262, lon: 17.2199592590332 },
})
console.log(`\njourney: ${journey.legs.length} legs`)
for (const leg of journey.legs) {
    const pct = (n: number) => `${Math.round(n * 100)}%`
    console.log(`  ${leg.vehicle} ${leg.line}: ${leg.board.name} (${pct(leg.board.danger)}) -> ${leg.alight.name} (${pct(leg.alight.danger)})`)
}

process.exit(0)
