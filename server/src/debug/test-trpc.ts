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

process.exit(0)
