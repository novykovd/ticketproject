import { pgTable, serial, text, real, timestamp, integer, index, jsonb } from 'drizzle-orm/pg-core'

// Pre-computed directional segments derived from GTFS shape points.
// The in-memory R-Tree is built from these at startup.
// For production spatial queries, add a PostGIS geometry column and GIST index:
//   ALTER TABLE segments ADD COLUMN geom geometry(LineString, 4326);
//   CREATE INDEX segments_geom_idx ON segments USING GIST(geom);
export const segments = pgTable('segments', {
  id: serial('id').primaryKey(),
  shapeId: text('shape_id').notNull(),
  routeId: text('route_id'),
  minX: real('min_x').notNull(),
  minY: real('min_y').notNull(),
  maxX: real('max_x').notNull(),
  maxY: real('max_y').notNull(),
  sequence: integer('sequence').notNull(),
}, (t) => [
  index('segments_shape_id_idx').on(t.shapeId),
])

export const trips = pgTable('trips', {
  id: serial('id').primaryKey(),
  clerkUserId: text('clerk_user_id').notNull(),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  endedAt: timestamp('ended_at'),
  matchedRouteId: text('matched_route_id'),
}, (t) => [
  index('trips_user_idx').on(t.clerkUserId),
])

export const stops = pgTable('stops', {
  stopId: text('stop_id').primaryKey(),
  name: text('name').notNull(),
  lat: real('lat').notNull(),
  lon: real('lon').notNull(),
}, (t) => [
  index('stops_lat_lon_idx').on(t.lat, t.lon),
])

export const observations = pgTable('observations', {
  id: serial('id').primaryKey(),
  clerkUserId: text('clerk_user_id').notNull(),
  routeId: text('route_id'),
  lat: real('lat').notNull(),
  lon: real('lon').notNull(),
  headingDeg: real('heading_deg'),
  stopId: text('stop_id').references(() => stops.stopId),
  type: text('type').notNull(),
  data: jsonb('data'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('observations_lat_lon_idx').on(t.lat, t.lon),
  index('observations_route_idx').on(t.routeId),
  index('observations_created_at_idx').on(t.createdAt),
])

export const gpsReports = pgTable('gps_reports', {
  id: serial('id').primaryKey(),
  clerkUserId: text('clerk_user_id').notNull(),
  tripId: integer('trip_id').references(() => trips.id),
  lat: real('lat').notNull(),
  lon: real('lon').notNull(),
  heading: real('heading'),
  speed: real('speed'),
  accuracy: real('accuracy'),
  matchedSegmentId: integer('matched_segment_id').references(() => segments.id),
  recordedAt: timestamp('recorded_at').notNull().defaultNow(),
}, (t) => [
  index('gps_reports_trip_idx').on(t.tripId),
  index('gps_reports_user_idx').on(t.clerkUserId),
])
