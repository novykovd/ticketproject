// Usage: [TREE_CACHED=1] [SEGMENT_CAP=N] npm run debug:match -- minX,minY,maxX,maxY
import { findBestSegmentDebug } from '../spatial/matcher.js'
import { renderFailureCase } from '../viz/matchVisualizer.js'
import { resolveTree } from '../cache/resolveTree.js'

const SHAPES_PATH = process.env['GTFS_SHAPES_PATH'] ?? 'C:/Users/david/Documents/GTFS_latest/shapes.txt'
const raw = process.argv.find(a => !a.startsWith('--') && a.includes(','))

if (!raw) {
    console.error('Usage: [TREE_CACHED=1] [SEGMENT_CAP=N] npm run debug:match -- minX,minY,maxX,maxY')
    process.exit(1)
}

const [minX, minY, maxX, maxY] = raw.split(',').map(Number) as [number, number, number, number]
if ([minX, minY, maxX, maxY].some(Number.isNaN)) {
    console.error('All four coordinates must be valid numbers')
    process.exit(1)
}

const query = { minX, minY, maxX, maxY }
const { tree } = resolveTree(SHAPES_PATH)

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
