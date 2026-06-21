import { jest } from '@jest/globals'
import { resolveTree } from '../src/cache/index.js'
import { findBestSegmentDebug, type GpsSegment } from '../src/spatial/index.js'
import { applyGpsNoise } from '../src/spatial/test-utils.js'

const SHAPES_PATH = process.env['GTFS_SHAPES_PATH'] ?? 'C:/Users/david/Documents/GTFS_latest/shapes.txt'
const TRIALS      = parseInt(process.env['GTFS_TRIALS'] ?? '200', 10)
const K           = parseInt(process.env['GTFS_K']      ?? '10',  10)

jest.setTimeout(120_000)

describe('GTFS Tied-Set Accuracy — redundancy diagnostic', () => {
    let tree: ReturnType<typeof resolveTree>['tree']
    let segments: any[]

    beforeAll(() => {
        ;({ tree, segments } = resolveTree(SHAPES_PATH))
        console.log(`R-Tree ready — ${segments.length} segments, k=${K}`)
    })

    test(`tied-set: expected segment is in the exact top-score cluster (${TRIALS} trials)`, () => {
        let inTied   = 0
        let isWinner = 0

        for (let i = 0; i < TRIALS; i++) {
            const trueSeg  = segments[Math.floor(Math.random() * segments.length)]!
            const baseVec  = { x: trueSeg.maxX - trueSeg.minX, y: trueSeg.maxY - trueSeg.minY }
            const noisyVec = applyGpsNoise(baseVec, 15)

            const query: GpsSegment = {
                minX: trueSeg.minX,
                minY: trueSeg.minY,
                maxX: trueSeg.minX + noisyVec.x,
                maxY: trueSeg.minY + noisyVec.y,
            }

            const { winner, candidates } = findBestSegmentDebug(query, tree, K)

            if (winner === trueSeg) isWinner++

            const topScore = candidates[0]?.score ?? 0
            const tiedSet  = candidates.filter(c => c.score === topScore)
            if (tiedSet.some(c => c.segment === trueSeg)) inTied++
        }

        const winnerPct = (isWinner / TRIALS * 100).toFixed(1)
        const tiedPct   = (inTied   / TRIALS * 100).toFixed(1)
        const gapPct    = ((inTied - isWinner) / TRIALS * 100).toFixed(1)

        console.log(`\nWinner accuracy : ${winnerPct}%`)
        console.log(`Tied-set accuracy: ${tiedPct}%  (expected has same top score as winner)`)
        console.log(`Redundancy gap   : ${gapPct}%  (lost to duplicate segments with identical score)`)

        expect(inTied / TRIALS).toBeGreaterThan(isWinner / TRIALS)
    })
})
