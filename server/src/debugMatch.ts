// Usage: GTFS_SEGMENT_CAP=N tsx src/debugMatch.ts minX,minY,maxX,maxY
import { loadGTFSSegments } from './gtfsUpdater.js'
import { populateRTree } from './util.js'
import { RTree } from './rtree.js'
import { findBestSegmentDebug } from './matcher.js'
import { renderFailureCase } from './matchVisualizer.js'

const SHAPES_PATH = process.env['GTFS_SHAPES_PATH'] ?? 'C:/Users/david/Documents/GTFS_latest/shapes.txt'
const SEGMENT_CAP = parseInt(process.env['GTFS_SEGMENT_CAP'] ?? '0', 10)

const raw = process.argv[2]
if (!raw) {
    console.error('Usage: GTFS_SEGMENT_CAP=N tsx src/debugMatch.ts minX,minY,maxX,maxY')
    process.exit(1)
}

const [minX, minY, maxX, maxY] = raw.split(',').map(Number) as [number, number, number, number]
if ([minX, minY, maxX, maxY].some(isNaN)) {
    console.error('All four coordinates must be valid numbers')
    process.exit(1)
}

const query = { minX, minY, maxX, maxY }

console.log('Loading GTFS...')
const all = loadGTFSSegments(SHAPES_PATH)
const segments = SEGMENT_CAP > 0 ? all.slice(0, SEGMENT_CAP) : all
console.log(`Loaded ${segments.length} segments`)

const tree = new RTree()
populateRTree(tree, segments)

const { winner, candidates } = findBestSegmentDebug(query, tree)

console.log(`\nQuery:  ${minX}, ${minY} → ${maxX}, ${maxY}`)
console.log(`Winner: ${winner?.shapeId ?? 'none'}`)
console.log('\nAll candidates (descending score):')
candidates.forEach((c, i) => {
    console.log(`  #${i + 1}  score=${c.score.toFixed(6)}  shape=${c.segment?.shapeId}`)
})

const outPath = 'debug-output/debug.png'
renderFailureCase({ query, expected: winner ?? candidates[0]!.segment, candidates }, outPath)
console.log(`\nPNG: ${outPath}`)
