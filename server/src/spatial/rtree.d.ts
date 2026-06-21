export class RTree {
    constructor(maxEntries?: number)
    insert(mbr: any, payload: any): void
    getLeafEntries(): any[]
    getAllRectangles(): any[]
    knn(vector: any, k?: number): any[]
    serialize(): object
    static deserialize(data: object): RTree
}