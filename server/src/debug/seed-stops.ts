import fs from 'fs'
import { db, stops } from '@ticketproject/db'

const GTFS = 'C:/Users/david/Documents/GTFS_latest'

const lines = fs.readFileSync(`${GTFS}/stops.txt`, 'utf8').trim().split('\n')
const headers = lines[0]!.split(',').map(h => h.trim())
const col = (row: string[], name: string) => row[headers.indexOf(name)]?.trim() ?? ''

const rows = lines.slice(1).map(line => {
    const vals = line.split(',')
    return {
        stopId: col(vals, 'stop_id'),
        name:   col(vals, 'stop_name'),
        lat:    parseFloat(col(vals, 'stop_lat')),
        lon:    parseFloat(col(vals, 'stop_lon')),
    }
}).filter(r => r.stopId && r.name && !isNaN(r.lat))

await db.insert(stops).values(rows).onConflictDoNothing()
console.log(`inserted ${rows.length} stops`)
process.exit(0)
