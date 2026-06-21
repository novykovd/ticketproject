import fs from 'fs'
import path from 'path'
import { RTree } from '../spatial/rtree.js'
import { loadGTFSSegments } from '../gtfs/gtfsUpdater.js'
import { populateRTree } from '../gtfs/util.js'

const CACHE_PATH = path.join(process.cwd(), 'cache', 'rtree.json')

export function loadTreeCached(shapesPath: string): RTree {
    if (fs.existsSync(CACHE_PATH)) {
        console.log('Loading R-Tree from cache...')
        const data = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'))
        return RTree.deserialize(data)
    }

    console.log('Cache miss — building R-Tree from GTFS...')
    const segments = loadGTFSSegments(shapesPath)
    const tree = new RTree()
    populateRTree(tree, segments)

    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true })
    fs.writeFileSync(CACHE_PATH, JSON.stringify(tree.serialize()))
    console.log(`Cached R-Tree (${segments.length} segments) to ${CACHE_PATH}`)

    return tree
}
