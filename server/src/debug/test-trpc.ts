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

// query: journey — canned route, danger-scored. The test:trpc script sets
// ROUTES_SOURCE=canned so this stays offline/deterministic despite the .env key.
const journey = await caller.reports.journey({
    origin: { lat: 48.1271705627441, lon: 17.1167469024658 },
    destination: { lat: 48.2090873718262, lon: 17.2199592590332 },
})
console.log(`\njourney: ${journey.legs.length} legs`)
for (const leg of journey.legs) {
    const hottest = [...leg.stops].sort((a, b) => b.danger - a.danger)[0]
    const first = leg.stops[0]
    const last = leg.stops[leg.stops.length - 1]
    console.log(`  ${leg.vehicle} ${leg.line}: ${first?.name} -> ${last?.name} (${leg.stops.length} stops)`)
    if (hottest) console.log(`     hottest: ${hottest.name} ${Math.round(hottest.danger * 100)}% [${hottest.lat.toFixed(4)},${hottest.lon.toFixed(4)}]`)
}

// stops.search + stops.nearest
const found = await caller.stops.search({ q: 'zlat' })
console.log(`\nstops.search 'zlat': ${found.length} hits ->`, found.map(f => f.name).join(', '))

const near = await caller.stops.nearest({ lat: 48.1486, lon: 17.1077 })
console.log(`stops.nearest (centre): ${near?.name} (${Math.round(near?.distM ?? 0)}m)`)

const track = await caller.dev.sampleTrack({ steps: 6 })
console.log(`\ndev.sampleTrack: ${track.points.length} points along shape ${track.shapeId}`)
console.log('  first point:', track.points[0])

// full pipeline: sample track -> match -> observation
const matched = await caller.reports.matchTrack({ points: track.points })
console.log(`\nmatchTrack: shape ${matched.shapeId} (${matched.votes}/${matched.totalVectors} votes)`)
console.log('  segment:', matched.segment)
console.log('  arrival:', matched.arrival, '-> stop', matched.stopId)

process.exit(0)
