import { RTree } from "./rtree.js"

export interface Vector { x: number; y: number }

export interface GpsSegment {
    minX: number
    minY: number
    maxX: number
    maxY: number
}

export interface ScoredCandidate {
    segment: any
    score: number
}

function scoreAndSort(queryVector: Vector, candidates: any[]): ScoredCandidate[] {
    return candidates
        .map((entry: any) => ({
            segment: entry.obj.segment,
            score: queryVector.x * entry.obj.vector.x + queryVector.y * entry.obj.vector.y,
        }))
        .sort((a, b) => b.score - a.score)
}

function buildQueryMBR(query: GpsSegment): GpsSegment {
    return {
        minX: Math.min(query.minX, query.maxX),
        minY: Math.min(query.minY, query.maxY),
        maxX: Math.max(query.minX, query.maxX),
        maxY: Math.max(query.minY, query.maxY),
    }
}

export function findBestSegment(query: GpsSegment, tree: RTree, k = 10) {
    const queryVector: Vector = { x: query.maxX - query.minX, y: query.maxY - query.minY }
    const candidates = tree.knn(buildQueryMBR(query), k)
    const scored = scoreAndSort(queryVector, candidates)
    return scored[0]?.segment ?? null
}

export function findBestSegmentDebug(query: GpsSegment, tree: RTree, k = 10): {
    winner: any
    candidates: ScoredCandidate[]
} {
    const queryVector: Vector = { x: query.maxX - query.minX, y: query.maxY - query.minY }
    const candidates = tree.knn(buildQueryMBR(query), k)
    const scored = scoreAndSort(queryVector, candidates)
    return { winner: scored[0]?.segment ?? null, candidates: scored }
}
