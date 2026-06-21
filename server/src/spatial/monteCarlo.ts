import { RTree } from './rtree.js'
import { findBestSegment, findBestSegmentDebug, type ScoredCandidate, type GpsSegment } from './matcher.js'
import { applyGpsNoise } from './test-utils.js'


export interface FailureCase {
    query: GpsSegment
    expected: any
    candidates: ScoredCandidate[]
}

export interface MonteCarloOptions {
    trials: number
    noiseAngle?: number   // degrees, default 15
    k?: number            // KNN candidates, default 10
    maxFailures?: number  // how many failures to capture, default 5
}

export interface MonteCarloResult {
    accuracy: number
    correct: number
    failures: FailureCase[]
}

export function runMonteCarlo(tree: RTree, segments: any[], opts: MonteCarloOptions): MonteCarloResult {
    const { trials, noiseAngle = 15, k = 10, maxFailures = 5 } = opts

    let correct = 0
    const failures: FailureCase[] = []
    const logEvery = Math.max(1, Math.floor(trials / 10))

    for (let i = 0; i < trials; i++) {
        if (i > 0 && i % logEvery === 0) {
            console.log(`  trial ${i}/${trials} — running accuracy ${((correct / i) * 100).toFixed(1)}%`)
        }

        const trueSeg = segments[Math.floor(Math.random() * segments.length)]!
        const baseVec = { x: trueSeg.maxX - trueSeg.minX, y: trueSeg.maxY - trueSeg.minY }
        const noisyVec = applyGpsNoise(baseVec, noiseAngle)

        const noisyObs: GpsSegment = {
            minX: trueSeg.minX,
            minY: trueSeg.minY,
            maxX: trueSeg.minX + noisyVec.x,
            maxY: trueSeg.minY + noisyVec.y,
        }

        const predicted = findBestSegment(noisyObs, tree, k)
        if (predicted === trueSeg) {
            correct++
        } else if (failures.length < maxFailures) {
            const { candidates } = findBestSegmentDebug(noisyObs, tree, k)
            failures.push({ query: noisyObs, expected: trueSeg, candidates })
        }
    }

    return { accuracy: correct / trials, correct, failures }
}
