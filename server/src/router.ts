import { MatchRequestSchema } from '@ticketproject/core'
import { router, publicProcedure } from './trpc'
import { loadGTFSSegments } from './gtfsUpdater.js'
import { populateRTree } from './util.js'
import { RTree } from './rtree.js'
import { findBestSegment } from './matcher.js'

// Load GTFS and build R-Tree once at startup.
// Set GTFS_SHAPES_PATH to override the default location.
const SHAPES_PATH = process.env['GTFS_SHAPES_PATH'] ?? 'C:/Users/david/Documents/GTFS_latest/shapes.txt'

let tree: RTree | null = null
let allSegments: ReturnType<typeof loadGTFSSegments> = []

try {
    const limit = process.env['DEV_SEGMENT_LIMIT'] ? parseInt(process.env['DEV_SEGMENT_LIMIT']) : undefined
    console.log('Loading GTFS...')
    allSegments = loadGTFSSegments(SHAPES_PATH)
    const segments = limit !== undefined ? allSegments.slice(0, limit) : allSegments
    if (limit !== undefined) console.log(`DEV mode: capping at ${limit} segments`)
    tree = new RTree()
    populateRTree(tree, segments)
    console.log(`R-Tree ready — ${segments.length} segments`)
} catch (e) {
    console.warn('GTFS load failed, match endpoint will return null:', e)
}

export function sampleSegments(n: number) {
    if (!allSegments.length) return []
    const indices = new Set<number>()
    while (indices.size < Math.min(n, allSegments.length)) {
        indices.add(Math.floor(Math.random() * allSegments.length))
    }
    return [...indices].map(i => allSegments[i])
}

export const appRouter = router({
    health: publicProcedure.query(() => ({
        ok: true,
        gtfsLoaded: tree !== null,
    })),

    location: router({
        match: publicProcedure
            .input(MatchRequestSchema)
            .mutation(({ input }) => {
                if (!tree) return { matched: false as const }

                const query = {
                    minX: input.from.lat,
                    minY: input.from.lon,
                    maxX: input.to.lat,
                    maxY: input.to.lon,
                }

                const segment = findBestSegment(query, tree) as any
                if (!segment) return { matched: false as const }

                return {
                    matched: true as const,
                    shapeId: segment.shapeId as string,
                    from: { lat: segment.minX as number, lon: segment.minY as number },
                    to:   { lat: segment.maxX as number, lon: segment.maxY as number },
                }
            }),
    }),
})

export type AppRouter = typeof appRouter
