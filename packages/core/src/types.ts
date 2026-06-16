import { z } from 'zod'

export const GpsReportSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().nonnegative().optional(),
  accuracy: z.number().nonnegative().optional(),
  timestamp: z.number(),
})
export type GpsReport = z.infer<typeof GpsReportSchema>

export const StartTripSchema = z.object({
  timestamp: z.number(),
})

export const EndTripSchema = z.object({
  tripId: z.number(),
  timestamp: z.number(),
})

export type Segment = {
  minX: number
  minY: number
  maxX: number
  maxY: number
  shapeId: string
  routeId?: string
}

export type MatchResult = {
  segment: Segment
  score: number
}
