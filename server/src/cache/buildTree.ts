// Builds and persists the full R-Tree cache. Run once before debug:match --cached.
// Pass --force to rebuild even if cache already exists.
import fs from 'fs'
import path from 'path'
import { loadGTFSSegments } from '../gtfs/gtfsUpdater.js'
import { populateRTree } from '../gtfs/util.js'
import { RTree } from '../spatial/rtree.js'

const SHAPES_PATH = process.env['GTFS_SHAPES_PATH'] ?? 'C:/Users/david/Documents/GTFS_latest/shapes.txt'
const CACHE_PATH  = path.join(process.cwd(), 'cache', 'rtree.json')
const FORCE       = process.argv.includes('--force')

if (fs.existsSync(CACHE_PATH) && !FORCE) {
    console.log(`Cache already exists at ${CACHE_PATH}`)
    console.log('Pass --force to rebuild.')
    process.exit(0)
}

console.log('Loading GTFS...')
const segments = loadGTFSSegments(SHAPES_PATH)
console.log(`Building R-Tree from ${segments.length} segments...`)

const tree = new RTree()
populateRTree(tree, segments)

fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true })
fs.writeFileSync(CACHE_PATH, JSON.stringify(tree.serialize()))
console.log(`Saved to ${CACHE_PATH}`)
