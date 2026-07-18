// Imports GTFS routes + route_stops into the DB.
//   npm run seed:routes         build and write (needs stops already seeded)
//   npm run seed:routes -- --dry parse + print stats only, no DB writes
import fs from 'fs'
import { db, routes as routesTable, routeStops as routeStopsTable, stops } from '@ticketproject/db'
import { buildRouteStops } from '../gtfs/index.js'

const GTFS_DIR = process.env['GTFS_DIR'] ?? 'C:/Users/david/Documents/GTFS_latest'
const dry = process.argv.includes('--dry')

// Known stop_ids: from the DB (real run — inserts must satisfy the FK) or from
// stops.txt (dry run — no DB needed).
let knownStopIds: Set<string>
if (dry) {
    const rows = fs.readFileSync(`${GTFS_DIR}/stops.txt`, 'utf8').split('\n').slice(1)
    knownStopIds = new Set(rows.map((l) => l.split(',')[0]).filter(Boolean))
} else {
    const rows = await db.select({ stopId: stops.stopId }).from(stops)
    knownStopIds = new Set(rows.map((r) => r.stopId))
}
console.log(`known stops: ${knownStopIds.size}`)

console.log('building routes + route_stops from GTFS…')
const { routes, routeStops } = buildRouteStops(GTFS_DIR, knownStopIds)
console.log(`  routes:      ${routes.length}`)
console.log(`  route_stops: ${routeStops.length}`)

// Sanity sample: line "4", direction 0.
const line4 = routes.filter((r) => r.shortName === '4').map((r) => r.routeId)
const sample = routeStops.filter((rs) => line4.includes(rs.routeId) && rs.directionId === 0)
console.log(`  sample line 4 dir 0: ${sample.length} stops across ${new Set(sample.map((s) => s.routeId)).size} variant(s)`)

if (dry) {
    console.log('\ndry run — nothing written.')
    process.exit(0)
}

// Wipe + reinsert. Delete route_stops first (it FKs routes).
await db.delete(routeStopsTable)
await db.delete(routesTable)
await db.insert(routesTable).values(routes)

const CHUNK = 1000 // keep each insert well under Postgres' parameter limit
for (let i = 0; i < routeStops.length; i += CHUNK) {
    await db.insert(routeStopsTable).values(routeStops.slice(i, i + CHUNK))
}
console.log(`\ninserted ${routes.length} routes, ${routeStops.length} route_stops.`)
process.exit(0)
