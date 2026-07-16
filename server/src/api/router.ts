import { z } from 'zod'
import { MatchRequestSchema, ViewportSchema, ReportSubmitSchema } from '@ticketproject/core'
import { router, publicProcedure } from './trpc.js'
import { findBestSegment } from '../spatial/matcher.js'
import { resolveTree } from '../persistence/resolveTree.js'
import { getReportsByViewport, getReportsByRoute } from '@ticketproject/db'
import { addReport } from '../reports/addReport.js'
import { getJourneyReport } from '../routing/journeyReport.js'
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

    reports: router({
        byViewport: publicProcedure
            .input(ViewportSchema)
            .query(({ input }) =>
                getReportsByViewport(input.minLat, input.maxLat, input.minLon, input.maxLon)
            ),

        byRoute: publicProcedure
            .input(z.object({ routeId: z.string() }))
            .query(({ input }) =>
                getReportsByRoute(input.routeId)
            ),

        add: publicProcedure
            .input(ReportSubmitSchema)
            .mutation(({ input }) => {
                if (!tree) throw new Error('GTFS tree not loaded')
                return addReport(input, tree)
            }),

        // Route lookup: plan A->B via Google (or canned), score each journey
        // stop's danger. No fixture fallback here — an endpoint must return a
        // real answer, not a stand-in itinerary.
        journey: publicProcedure
            .input(z.object({
                origin: z.object({ lat: z.number(), lon: z.number() }),
                destination: z.object({ lat: z.number(), lon: z.number() }),
            }))
            .query(({ input }) => getJourneyReport(input.origin, input.destination)),
    }),

    location: router({
        match: publicProcedure
            .input(MatchRequestSchema)
            .mutation(({ input }) => {
                if (!tree) return { matched: false as const }

                const segment = findBestSegment({
                    minX: input.from.lat,
                    minY: input.from.lon,
                    maxX: input.to.lat,
                    maxY: input.to.lon,
                }, tree) as any

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
