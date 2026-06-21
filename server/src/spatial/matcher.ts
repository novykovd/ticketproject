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

function normalize(v: Vector): Vector {
    const mag = Math.sqrt(v.x * v.x + v.y * v.y)
    if (mag === 0) return { x: 0, y: 0 }
    return { x: v.x / mag, y: v.y / mag }
}

function scoreAndSort(queryVector: Vector, candidates: any[]): ScoredCandidate[] {
    const qNorm = normalize(queryVector)
    return candidates
        .map((entry: any) => {
            const sNorm = normalize(entry.obj.vector)
            return {
                segment: entry.obj.segment,
                score: qNorm.x * sNorm.x + qNorm.y * sNorm.y,
            }
        })
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
