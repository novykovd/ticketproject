import { RTree } from '../spatial/rtree.js'
import { loadGTFSSegments } from '../gtfs/gtfsUpdater.js'
import { populateRTree } from '../gtfs/util.js'
import { loadTreeCached } from './treeCache.js'

const SHAPES_PATH = process.env['GTFS_SHAPES_PATH'] ?? 'C:/Users/david/Documents/GTFS_latest/shapes.txt'
const SEGMENT_CAP = parseInt(process.env['SEGMENT_CAP'] ?? '0', 10)
const TREE_CACHED = !!process.env['TREE_CACHED']

export interface TreeResolution {
    tree: RTree
    segments: any[]
}

export function resolveTree(shapesPath = SHAPES_PATH): TreeResolution {
    if (TREE_CACHED) {
        console.log('TREE_CACHED=1 — loading from cache...')
        const tree = loadTreeCached(shapesPath)
        const segments = tree.getLeafEntries().map((e: any) => e.payload.segment)
        return { tree, segments }
    }

    const all = loadGTFSSegments(shapesPath)
    const segments = SEGMENT_CAP > 0 ? all.slice(0, SEGMENT_CAP) : all
    if (SEGMENT_CAP > 0) console.log(`SEGMENT_CAP=${SEGMENT_CAP} — using ${segments.length} of ${all.length} segments`)

    const tree = new RTree()
    populateRTree(tree, segments)
    return { tree, segments }
}
