import { jest } from '@jest/globals'
import { resolveTree } from '../src/persistence/index.js'
import { majorityVote, weightedVote } from '../src/spatial/majorityMatcher.js'

const SHAPES_PATH = process.env['GTFS_SHAPES_PATH'] ?? 'C:/Users/david/Documents/GTFS_latest/shapes.txt'
const TRIALS      = parseInt(process.env['GTFS_TRIALS'] ?? '200', 10)

jest.setTimeout(120_000)

const STEP_COUNTS = [1, 3, 5, 10]
// degrees — ~0.001° ≈ 100m, ~0.002° ≈ 200m, ~0.005° ≈ 500m at Bratislava latitude
const STEP_SIZES  = [0.0005, 0.001, 0.002, 0.005]

describe('GTFS Interpolation — fixed step count', () => {
    let tree: ReturnType<typeof resolveTree>['tree']
    let segments: any[]

    beforeAll(() => {
        ;({ tree, segments } = resolveTree(SHAPES_PATH))
        console.log(`R-Tree ready — ${segments.length} segments`)
    })

    for (const N of STEP_COUNTS) {
        test(`N=${N} readings (${TRIALS} trials)`, () => {
            let majorityCorrect = 0
            let weightedCorrect = 0

            for (let i = 0; i < TRIALS; i++) {
                const trueSeg = segments[Math.floor(Math.random() * segments.length)]!
                if (majorityVote(trueSeg, tree, N).winner === trueSeg) majorityCorrect++
                if (weightedVote(trueSeg, tree, N).winner === trueSeg) weightedCorrect++
            }

            const maj = (majorityCorrect / TRIALS * 100).toFixed(1)
            const wgt = (weightedCorrect / TRIALS * 100).toFixed(1)
            console.log(`  N=${N}:  majority=${maj}%  weighted=${wgt}%`)
        })
    }
})

describe('GTFS Interpolation — fixed step size (weighted only)', () => {
    let tree: ReturnType<typeof resolveTree>['tree']
    let segments: any[]

    beforeAll(() => {
        ;({ tree, segments } = resolveTree(SHAPES_PATH))
    })

    for (const stepSizeDeg of STEP_SIZES) {
        test(`stepSize=${stepSizeDeg}° (${TRIALS} trials)`, () => {
            let correct  = 0
            let totalN   = 0

            for (let i = 0; i < TRIALS; i++) {
                const trueSeg = segments[Math.floor(Math.random() * segments.length)]!
                const { winner, vectorResults } = weightedVote(trueSeg, tree, 1, 0.0001, 10, stepSizeDeg)
                if (winner === trueSeg) correct++
                totalN += vectorResults.length
            }

            const pct  = (correct / TRIALS * 100).toFixed(1)
            const avgN = (totalN / TRIALS).toFixed(1)
            console.log(`  stepSize=${stepSizeDeg}°:  weighted=${pct}%  (avg N=${avgN})`)
        })
    }
})
