import { jest } from '@jest/globals'
import { resolveTree } from '../src/persistence/index.js'
import { majorityVote, weightedVote } from '../src/spatial/majorityMatcher.js'

const SHAPES_PATH = process.env['GTFS_SHAPES_PATH'] ?? 'C:/Users/david/Documents/GTFS_latest/shapes.txt'
const TRIALS      = parseInt(process.env['GTFS_TRIALS'] ?? '200', 10)

jest.setTimeout(120_000)

const STEP_COUNTS = [1, 3, 5, 10]

describe('GTFS Interpolation — Majority Vote vs Weighted Vote', () => {
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
