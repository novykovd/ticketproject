import { findBestSegmentDebug, type GpsSegment } from './matcher.js'
import { interpolateWithNoise } from './test-utils.js'
import type { RTree } from './rtree.js'

export interface VectorResult {
    vector: GpsSegment
    matched: any    // top-1 winner
    score: number   // top-1 score
    candidates: Array<{ segment: any; score: number }>
}

export interface MajorityVoteResult {
    winner: any
    votes: Array<{ segment: any; count: number; totalScore: number }>
    vectorResults: VectorResult[]
}

export interface WeightedVoteResult {
    winner: any
    votes: Array<{ segment: any; totalScore: number }>
    vectorResults: VectorResult[]
}

function resolveSteps(seg: GpsSegment, steps: number, stepSizeDeg?: number): number {
    if (!stepSizeDeg) return steps
    const len = Math.hypot(seg.maxX - seg.minX, seg.maxY - seg.minY)
    return Math.max(1, Math.round(len / stepSizeDeg))
}

function runVectors(
    seg: GpsSegment,
    tree: RTree,
    steps: number,
    sigmaDeg: number,
    k: number,
    stepSizeDeg?: number,
): VectorResult[] {
    const actualSteps = resolveSteps(seg, steps, stepSizeDeg)
    return interpolateWithNoise(seg, actualSteps, sigmaDeg).map(v => {
        const { winner, candidates } = findBestSegmentDebug(v, tree, k)
        return { vector: v, matched: winner, score: candidates[0]?.score ?? 0, candidates }
    })
}

// Top-1 per vector wins a vote; tiebreak by cumulative score.
export function majorityVote(
    seg: GpsSegment,
    tree: RTree,
    steps: number,
    sigmaDeg = 0.0001,
    k = 10,
    stepSizeDeg?: number,
): MajorityVoteResult {
    const vectorResults = runVectors(seg, tree, steps, sigmaDeg, k, stepSizeDeg)

    const tally = new Map<any, { count: number; totalScore: number }>()
    for (const { matched, score } of vectorResults) {
        if (!matched) continue
        const prev = tally.get(matched) ?? { count: 0, totalScore: 0 }
        tally.set(matched, { count: prev.count + 1, totalScore: prev.totalScore + score })
    }

    const votes = [...tally.entries()]
        .map(([segment, { count, totalScore }]) => ({ segment, count, totalScore }))
        .sort((a, b) => b.count - a.count || b.totalScore - a.totalScore)

    return { winner: votes[0]?.segment ?? null, votes, vectorResults }
}

// All K candidates per vector contribute their cosine score to the tally.
// A segment that is consistently 2nd-best across many vectors can win over
// one that is 1st-best on only a single vector.
export function weightedVote(
    seg: GpsSegment,
    tree: RTree,
    steps: number,
    sigmaDeg = 0.0001,
    k = 10,
    stepSizeDeg?: number,
): WeightedVoteResult {
    const vectorResults = runVectors(seg, tree, steps, sigmaDeg, k, stepSizeDeg)

    const tally = new Map<any, number>()
    for (const { candidates } of vectorResults) {
        for (const { segment, score } of candidates) {
            if (!segment) continue
            tally.set(segment, (tally.get(segment) ?? 0) + score)
        }
    }

    const votes = [...tally.entries()]
        .map(([segment, totalScore]) => ({ segment, totalScore }))
        .sort((a, b) => b.totalScore - a.totalScore)

    return { winner: votes[0]?.segment ?? null, votes, vectorResults }
}
