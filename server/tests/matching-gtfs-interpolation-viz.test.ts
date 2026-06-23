import { jest } from '@jest/globals'
import { resolveTree } from '../src/persistence/index.js'
import { weightedVote } from '../src/spatial/majorityMatcher.js'
import { renderInterpolationCase } from '../src/viz/index.js'

const SHAPES_PATH  = process.env['GTFS_SHAPES_PATH']   ?? 'C:/Users/david/Documents/GTFS_latest/shapes.txt'
const TRIALS       = parseInt(process.env['GTFS_TRIALS']       ?? '200', 10)
const N            = parseInt(process.env['INTERP_N']          ?? '5',   10)
const MAX_FAILURES = parseInt(process.env['GTFS_MAX_FAILURES'] ?? '5',   10)

jest.setTimeout(120_000)

describe('GTFS Interpolation — Failure Visualizer', () => {
    let tree: ReturnType<typeof resolveTree>['tree']
    let segments: any[]

    beforeAll(() => {
        ;({ tree, segments } = resolveTree(SHAPES_PATH))
        console.log(`R-Tree ready — ${segments.length} segments`)
    })

    test(`N=${N}: collect and render failure cases (${TRIALS} trials)`, () => {
        let correct = 0
        const failures: Array<{ trueSeg: any; vectorResults: any[]; majorityWinner: any }> = []

        for (let i = 0; i < TRIALS; i++) {
            const trueSeg = segments[Math.floor(Math.random() * segments.length)]!
            const { winner, vectorResults } = weightedVote(trueSeg, tree, N)

            if (winner === trueSeg) {
                correct++
            } else if (failures.length < MAX_FAILURES) {
                failures.push({ trueSeg, vectorResults, majorityWinner: winner })
            }
        }

        failures.forEach(({ trueSeg, vectorResults, majorityWinner }, i) => {
            const path = `debug-output/interp-failure-${i + 1}.png`
            renderInterpolationCase({ trueSeg, vectorResults, majorityWinner }, path)
            console.log(`  [${i + 1}] expected=${trueSeg.shapeId}  got=${majorityWinner?.shapeId}  → ${path}`)
        })

        const pct = (correct / TRIALS * 100).toFixed(1)
        console.log(`\nN=${N}: ${pct}%  (${correct}/${TRIALS})`)
        console.log(`Rendered ${failures.length} failure case(s) to debug-output/`)
    })
})
