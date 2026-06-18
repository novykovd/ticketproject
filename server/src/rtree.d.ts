// rtree.d.ts
// src/rtree.d.ts
export class RTree {
    insert(mbr: any, payload: any): void;
    getLeafEntries(): any[];
    knn(vector: any): any[];
    knn(vector: any, k: number)
}