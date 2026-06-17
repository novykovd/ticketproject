import { RTree } from '../src/rtree.js'
import { findBestSegment } from '../src/matcher'
import { applyGpsNoise } from '../src/test-utils'
import { loadGTFSSegments } from '../src/gtfsUpdater.js'
import { populateRTree } from '../src/util.js'

const SHAPES_PATH = process.env['GTFS_SHAPES_PATH'] ?? 'C:/Users/david/Documents/GTFS_latest/shapes.txt'
const TRIALS      = parseInt(process.env['GTFS_TRIALS']   ?? '1000', 10)
const SEGMENT_CAP = parseInt(process.env['GTFS_SEGMENT_CAP'] ?? '0',  10) // 0 = no cap

describe('GTFS Integration - Vector Matching Monte Carlo', () => {
    let tree: RTree
    let segments: ReturnType<typeof loadGTFSSegments>

    beforeAll(() => {
        console.log('Loading GTFS shapes...')
        const all = loadGTFSSegments(SHAPES_PATH)
        segments = SEGMENT_CAP > 0 ? all.slice(0, SEGMENT_CAP) : all
        console.log(`Using ${segments.length} of ${all.length} segments (cap: ${SEGMENT_CAP || 'none'})`)

        console.log('Populating R-Tree...')
        tree = new RTree()
        populateRTree(tree, segments)
        console.log('R-Tree ready.')
    })

    test(`should match ≥85% with 15° noise (${TRIALS} trials)`, () => {
        let correct = 0
        const logEvery = Math.max(1, Math.floor(TRIALS / 10))

        for (let i = 0; i < TRIALS; i++) {
            if (i > 0 && i % logEvery === 0) {
                console.log(`  trial ${i}/${TRIALS} — running accuracy ${((correct / i) * 100).toFixed(1)}%`)
            }

            const trueSeg = segments[Math.floor(Math.random() * segments.length)]!
            const baseVec = { x: trueSeg.maxX - trueSeg.minX, y: trueSeg.maxY - trueSeg.minY }
            const noisyVec = applyGpsNoise(baseVec, 15)

            const noisyObs = {
                minX: trueSeg.minX,
                minY: trueSeg.minY,
                maxX: trueSeg.minX + noisyVec.x,
                maxY: trueSeg.minY + noisyVec.y,
            }

            const predicted = findBestSegment(noisyObs, tree)
            if (predicted === trueSeg) correct++
        }

        const accuracy = correct / TRIALS
        console.log(`Final GTFS Accuracy: ${(accuracy * 100).toFixed(2)}%`)
        expect(accuracy).toBeGreaterThan(0.85)
    })
})
