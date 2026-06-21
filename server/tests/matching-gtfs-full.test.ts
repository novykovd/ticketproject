import { loadTreeCached } from '../src/cache/index.js'
import { runMonteCarlo } from '../src/spatial/index.js'
import { renderFailureCase } from '../src/viz/index.js'

const SHAPES_PATH    = process.env['GTFS_SHAPES_PATH']    ?? 'C:/Users/david/Documents/GTFS_latest/shapes.txt'
const TRIALS         = parseInt(process.env['GTFS_TRIALS']        ?? '1000', 10)
const MAX_FAILURES   = parseInt(process.env['GTFS_MAX_FAILURES']  ?? '5',    10)
const DEBUG_FAILURES = !!process.env['DEBUG_FAILURES']

jest.setTimeout(120_000)

describe('GTFS Full Dataset - Vector Matching Monte Carlo', () => {
    let segments: any[]
    let tree: ReturnType<typeof loadTreeCached>

    beforeAll(() => {
        tree = loadTreeCached(SHAPES_PATH)
        segments = tree.getLeafEntries().map((e: any) => e.payload.segment)
        console.log(`R-Tree ready — ${segments.length} segments.`)
    })

    test(`full dataset: ≥85% accuracy with 15° noise (${TRIALS} trials)`, () => {
        const { accuracy, failures } = runMonteCarlo(tree, segments, { trials: TRIALS, maxFailures: MAX_FAILURES })

        if (failures.length > 0) {
            console.log(`\n--- ${failures.length} FAILURE CASE(S) ---`)
            failures.forEach((f, i) => {
                const q = f.query
                console.log(`  [${i + 1}] expected=${f.expected.shapeId}  got=${f.candidates[0]?.segment?.shapeId}`)
                console.log(`       replay: tsx src/debug/debugMatch.ts ${q.minX},${q.minY},${q.maxX},${q.maxY}`)
                if (DEBUG_FAILURES) {
                    const path = `debug-output/full-failure-${i + 1}.png`
                    renderFailureCase(f, path)
                    console.log(`       png: ${path}`)
                }
            })
            if (!DEBUG_FAILURES) console.log('  (set DEBUG_FAILURES=1 to render PNGs)')
        }

        console.log(`\nFull Dataset Accuracy: ${(accuracy * 100).toFixed(2)}% (${failures.length} failures captured)`)
        expect(accuracy).toBeGreaterThan(0.85)
    })
})
