import fs from 'fs'
import path from 'path'
import { loadGTFSSegments } from '../gtfs/gtfsUpdater.js'

const CACHE_PATH = path.join(process.cwd(), 'cache', 'segments.json')

export function loadSegmentsCached(shapesPath: string): ReturnType<typeof loadGTFSSegments> {
    if (fs.existsSync(CACHE_PATH)) {
        console.log(`Loading segments from cache (${CACHE_PATH})...`)
        return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'))
    }
    console.log('Cache miss — parsing GTFS CSV...')
    const segments = loadGTFSSegments(shapesPath)
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true })
    fs.writeFileSync(CACHE_PATH, JSON.stringify(segments))
    console.log(`Cached ${segments.length} segments to ${CACHE_PATH}`)
    return segments
}
