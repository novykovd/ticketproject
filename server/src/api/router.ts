import { MatchRequestSchema } from '@ticketproject/core'
import { router, publicProcedure } from './trpc.js'
import { findBestSegment } from '../spatial/matcher.js'
import { resolveTree } from '../persistence/resolveTree.js'
import type { RTree } from '../spatial/rtree.js'

const SHAPES_PATH = process.env['GTFS_SHAPES_PATH'] ?? 'C:/Users/david/Documents/GTFS_latest/shapes.txt'

let tree: RTree | null = null
let allSegments: any[] = []

try {
    ;({ tree, segments: allSegments } = resolveTree(SHAPES_PATH))
    console.log(`R-Tree ready — ${allSegments.length} segments`)
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
