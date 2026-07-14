import { db, stops } from '@ticketproject/db'
import { parseCSV } from '../gtfs/index.js'

const GTFS = 'C:/Users/david/Documents/GTFS_latest'

const rows = parseCSV(`${GTFS}/stops.txt`).map(r => ({
    stopId: r['stop_id']!,
    name:   r['stop_name']!,
    lat:    parseFloat(r['stop_lat']!),
    lon:    parseFloat(r['stop_lon']!),
})).filter(r => r.stopId && r.name && !isNaN(r.lat))

await db.insert(stops).values(rows).onConflictDoNothing()
console.log(`inserted ${rows.length} stops`)
process.exit(0)
