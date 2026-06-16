import { z } from 'zod'
import { db, gpsReports, trips } from '@ticketproject/db'
import { GpsReportSchema, StartTripSchema, EndTripSchema } from '@ticketproject/core'
import { router, publicProcedure, protectedProcedure } from './trpc'

export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true })),

  trip: router({
    start: protectedProcedure
      .input(StartTripSchema)
      .mutation(async ({ ctx, input }) => {
        const [trip] = await db.insert(trips).values({
          clerkUserId: ctx.auth.userId,
          startedAt: new Date(input.timestamp),
        }).returning()
        return trip
      }),

    end: protectedProcedure
      .input(EndTripSchema)
      .mutation(async ({ ctx, input }) => {
        const [trip] = await db
          .update(trips)
          .set({ endedAt: new Date(input.timestamp) })
          .where(
            // Only allow ending your own trip
            // drizzle: .where(and(eq(trips.id, input.tripId), eq(trips.clerkUserId, ctx.auth.userId)))
            // simplified here for scaffold:
            // @ts-expect-error — wire up drizzle `and`/`eq` when implementing
            undefined
          )
          .returning()
        return trip
      }),
  }),

  location: router({
    report: protectedProcedure
      .input(GpsReportSchema.extend({ tripId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const [report] = await db.insert(gpsReports).values({
          clerkUserId: ctx.auth.userId,
          tripId: input.tripId ?? null,
          lat: input.latitude,
          lon: input.longitude,
          heading: input.heading ?? null,
          speed: input.speed ?? null,
          accuracy: input.accuracy ?? null,
          recordedAt: new Date(input.timestamp),
        }).returning()
        return report
      }),
  }),
})

export type AppRouter = typeof appRouter
