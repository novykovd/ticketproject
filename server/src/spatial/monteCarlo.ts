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
    tiedEpsilon?: number  // max score gap from top to be considered "tied", default 1e-4
}

export interface MonteCarloResult {
    accuracy: number      // winner === expected
    tiedAccuracy: number  // expected is anywhere in the tied top-score cluster
    correct: number
    tiedCorrect: number
    failures: FailureCase[]
}

export function runMonteCarlo(tree: RTree, segments: any[], opts: MonteCarloOptions): MonteCarloResult {
    const { trials, noiseAngle = 15, k = 10, maxFailures = 5, tiedEpsilon = 1e-4 } = opts

    let correct = 0
    let tiedCorrect = 0
    const failures: FailureCase[] = []
    const logEvery = Math.max(1, Math.floor(trials / 10))

    for (let i = 0; i < trials; i++) {
        if (i > 0 && i % logEvery === 0) {
            console.log(`  trial ${i}/${trials} — accuracy ${((correct / i) * 100).toFixed(1)}%  tied ${((tiedCorrect / i) * 100).toFixed(1)}%`)
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

        const { winner, candidates } = findBestSegmentDebug(noisyObs, tree, k)

        const isCorrect = winner === trueSeg
        if (isCorrect) correct++

        const topScore = candidates[0]?.score ?? 0
        const tiedSet  = candidates.filter(c => topScore - c.score <= tiedEpsilon)
        const inTied   = tiedSet.some(c => c.segment === trueSeg)
        if (inTied) tiedCorrect++

        if (!isCorrect && failures.length < maxFailures) {
            failures.push({ query: noisyObs, expected: trueSeg, candidates })
        }
    }

    return { accuracy: correct / trials, tiedAccuracy: tiedCorrect / trials, correct, tiedCorrect, failures }
}
