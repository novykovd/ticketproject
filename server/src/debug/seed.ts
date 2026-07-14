import { addObservation } from '@ticketproject/db'
import { loadGTFSSegments } from '../gtfs/gtfsUpdater.js'
import { interpolateWithNoise } from '../spatial/test-utils.js'

const SHAPES_PATH = process.env['GTFS_SHAPES_PATH'] ?? 'C:/Users/david/Documents/GTFS_latest/shapes.txt'
const COUNT = 80

const segments = loadGTFSSegments(SHAPES_PATH)
console.log(`loaded ${segments.length} segments`)

// Route through addObservation so seeded rows resolve stops the same way real
// reports do. createdAt is backdated to spread rows across the 2h window.
for (let i = 0; i < COUNT; i++) {
    const seg = segments[Math.floor(Math.random() * segments.length)]!
    const [vec] = interpolateWithNoise(seg, 1)
    const minsAgo = Math.random() * 110 + 5
    await addObservation({
        clerkUserId: `seed_user_${i % 5}`,
        lat: vec!.minX,
        lon: vec!.minY,
        type: Math.random() < 0.7 ? 'ticket_inspector' : 'crowding',
        data: { shapeId: seg.shapeId, seeded: true },
        createdAt: new Date(Date.now() - minsAgo * 60 * 1000),
    })
}
console.log(`inserted ${COUNT} observations`)
process.exit(0)
