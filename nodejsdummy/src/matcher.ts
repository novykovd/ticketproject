import { RTree } from "./rtree.js";

export interface Vector { x: number; y: number; }

export function findBestSegment(userVector: Vector, tree: RTree) {
    const candidates = tree.knn(userVector); // Assuming you have a KNN search
    
    let bestSegment = null;
    let highestScore = -Infinity;

    candidates.forEach((entry: any) => {
        const segVector = entry.payload.vector;
        
        // Dot Product = (u.x * v.x) + (u.y * v.y)
        // Normalized dot product gives the cosine of the angle between them
        const score = (userVector.x * segVector.x) + (userVector.y * segVector.y);
        
        if (score > highestScore) {
            highestScore = score;
            bestSegment = entry.payload.segment;
        }
    });

    return bestSegment;
}