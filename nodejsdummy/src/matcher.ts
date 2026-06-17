import { RTree } from "./rtree.js"

export interface Vector { x: number; y: number }

export interface GpsSegment {
    minX: number
    minY: number
    maxX: number
    maxY: number
}

export function findBestSegment(query: GpsSegment, tree: RTree, k = 10) {
    const queryVector: Vector = { x: query.maxX - query.minX, y: query.maxY - query.minY }

    const queryMBR: GpsSegment = {
        minX: Math.min(query.minX, query.maxX),
        minY: Math.min(query.minY, query.maxY),
        maxX: Math.max(query.minX, query.maxX),
        maxY: Math.max(query.minY, query.maxY),
    }

    const candidates = tree.knn(queryMBR, k)

    let bestSegment = null
    let highestScore = -Infinity

    candidates.forEach((entry: any) => {
        const segVector: Vector = entry.obj.vector
        const score = queryVector.x * segVector.x + queryVector.y * segVector.y
        if (score > highestScore) {
            highestScore = score
            bestSegment = entry.obj.segment
        }
    })

    return bestSegment
}
