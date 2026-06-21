# CLAUDE.md

This file provides guidance to Claude Code when working in `ticketproject/`.

## Monorepo layout

pnpm workspace + Turborepo, rooted at `ticketproject/`.

```
ticketproject/
├── server/          (@ticketproject/server)   — Fastify API + matching pipeline
├── ticket-client/   (@ticketproject/mobile)   — Expo mobile app
└── packages/
    ├── core/        (@ticketproject/core)      — shared Zod schemas + TS types
    ├── db/          (@ticketproject/db)        — Drizzle schema + PostgreSQL client
    └── tsconfig/    (@ticketproject/tsconfig)  — shared TS configs
```

## Commands

From `ticketproject/` root:
```bash
pnpm install       # install all workspaces
pnpm dev           # turbo dev (all packages in parallel)
pnpm test          # turbo test across all packages
pnpm db:push       # drizzle-kit push (apply schema to DB)
pnpm db:studio     # open Drizzle Studio
```

From `server/`:
```bash
npm run dev                  # dev server, SEGMENT_CAP=3000
npm run cache:tree           # build R-Tree from full GTFS → server/cache/rtree.json
npm run cache:tree:rebuild   # force rebuild even if cache exists
npm run test:full            # Monte Carlo accuracy test, full cached tree
npm run test:tied            # tied-set diagnostic: measures redundancy gap
npm run debug:match          # visualize a single failure case → debug-output/debug.png
```

From `packages/db/`:
```bash
pnpm db:generate   # generate migration files
```

## Environment variables

- `server/.env` — `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`
- `ticket-client/.env` — `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`

Matching pipeline env vars (all optional):
- `TREE_CACHED=1` — deserialize tree from `server/cache/rtree.json` instead of rebuilding
- `SEGMENT_CAP=N` — slice GTFS to N segments (fast dev/test iterations)
- `GTFS_TRIALS=N` — Monte Carlo trial count (default: 1000 for test:full, 200 for test:tied)
- `DEBUG_FAILURES=1` — render failure PNGs when running test:full

## server/src/ structure

All source in subdirectories, each with an `index.ts` barrel:

```
src/
├── spatial/        R-Tree, matcher, Monte Carlo, test utils
│   ├── rtree.js / rtree.d.ts   — custom R-Tree (insert, KNN, serialize/deserialize)
│   ├── matcher.ts              — findBestSegment, findBestSegmentDebug, cosine scoring
│   ├── monteCarlo.ts           — runMonteCarlo (accuracy + tiedAccuracy metrics)
│   ├── test-utils.ts           — applyGpsNoise
│   └── index.ts
├── gtfs/           GTFS CSV loading and R-Tree population
│   ├── util.js                 — loadGTFSSegments, computeBounds, leafToRect, populateRTree
│   ├── gtfsUpdater.js
│   └── index.ts
├── persistence/    Tree persistence + unified resolveTree interface
│   ├── resolveTree.ts          — unified loader: reads TREE_CACHED / SEGMENT_CAP env vars
│   ├── treeCache.ts            — loadTreeCached (serialize/deserialize rtree.json)
│   ├── segmentCache.ts         — loadSegmentsCached
│   ├── buildTree.ts            — standalone script: build + save full tree
│   └── index.ts
├── viz/            Canvas PNG rendering
│   ├── matchVisualizer.js      — renderFailureCase: map panel + sidebar legend
│   ├── viewport.js / renderer.js / leafVisuals.js
│   └── index.ts
├── api/            tRPC router and context
│   ├── router.ts               — appRouter, uses resolveTree() on startup
│   ├── trpc.ts                 — createContext, protectedProcedure
│   └── index.ts
└── debug/          One-off scripts, not imported by production code
    ├── debugMatch.ts           — replay single failure → debug-output/debug.png
    └── demo.js / runDemo.js    — R-Tree viz → debug-output/rtree.png
```

## Key interfaces

### resolveTree — unified entry point for all consumers
```ts
// src/persistence/resolveTree.ts
resolveTree(shapesPath?: string): { tree: RTree; segments: any[] }
```
All consumers (server, tests, debugMatch) go through this. No consumer does its own GTFS loading.

### Matcher — cosine similarity scoring
```ts
// src/spatial/matcher.ts
findBestSegment(query: GpsSegment, tree: RTree, k = 10): any
findBestSegmentDebug(query: GpsSegment, tree: RTree, k = 10): { winner: any; candidates: ScoredCandidate[] }
```
Scoring is cosine similarity — both vectors normalized to unit length before dot product. Score range [-1, 1]. Direction only, magnitude does not affect score.

### MonteCarloResult
```ts
interface MonteCarloResult {
    accuracy: number      // winner === expected
    tiedAccuracy: number  // expected is in exact top-score cluster
    correct: number
    tiedCorrect: number
    failures: FailureCase[]
}
```

## Tests

```
tests/
├── matching.test.ts           — unit: small synthetic segment set
├── matching-gtfs.test.ts      — integration: GTFS subset
├── matching-gtfs-full.test.ts — full dataset Monte Carlo (needs TREE_CACHED=1)
└── matching-gtfs-tied.test.ts — tied-set diagnostic (needs TREE_CACHED=1)
```

ESM mode: always run via `node --experimental-vm-modules node_modules/jest/bin/jest.js`.
Always `import { jest } from '@jest/globals'` — jest is not a global in ESM.

## R-Tree cache

Full 5988-segment tree at `server/cache/rtree.json` (gitignored via `/server/cache/` in root .gitignore).
Rebuild: `npm run cache:tree:rebuild`. Takes ~2-3s. Deserialization is near-instant.
R-Tree has circular `parent` refs — serialization strips them, deserialization reconstructs them.

## Matching accuracy (last measured, 50 trials)

- **Winner accuracy ~22%** — top-ranked segment is correct
- **Tied-set accuracy ~82%** — correct segment is in the top-score cluster
- **Redundancy gap ~60%** — root cause: same physical street has many `shape_id`s in GTFS, they score identically

The algorithm is working. The gap is a data model issue: the right key is `route_id + stop_id`, not raw `shape_id`.

## Database design (planned, not yet implemented)

Three-table core:
```sql
routes      (route_id, short_name, type)
stops       (stop_id, name, lat, lon)
route_stops (route_id, stop_id, direction_id, stop_sequence)  -- GTFS backbone for path queries

observations (
  id, created_at, user_id,
  route_id, stop_id, direction_id,   -- resolved network anchor
  lat, lon, heading_deg,             -- raw GPS (always keep for re-matching)
  type text,                         -- 'ticket_inspector', 'crowding', etc.
  data jsonb                         -- type-specific payload
)
```

Rules:
- `type + data jsonb` generalizes to any event type without schema changes
- Never use `shape_id` as FK — GTFS updates rotate them silently
- Keep raw GPS alongside resolved position for future re-matching
- Live position state is ephemeral (in-memory); only write to DB on notable events

Path query pattern — "upcoming stops on my route with reports":
```sql
SELECT o.*, rs.stop_sequence FROM observations o
JOIN route_stops rs USING (route_id, stop_id)
WHERE o.route_id = $route AND rs.direction_id = $dir
  AND rs.stop_sequence > $current_seq
  AND o.created_at > now() - interval '2 hours'
ORDER BY rs.stop_sequence
```

## API

- `server.js` — Fastify entry; CORS, Clerk auth, tRPC at `/trpc`
- `src/api/trpc.ts` — `createContext`, `protectedProcedure`
- `src/api/router.ts` — `appRouter`

## Mobile client

- `EXPO_PUBLIC_API_URL` — set inline via `pnpm dev:phone` for LAN testing
- `TrackMap/index.native.tsx` — react-native-maps implementation
- `TrackMap/index.web.tsx` — web implementation
- `TrackMap/index.tsx` — TypeScript stub only; bundler uses platform file at runtime
- HUD safe area: `Platform.OS === 'ios' ? 60 : 12` (no react-native-safe-area-context)

## Shared packages

- `packages/core/src/types.ts` — `GpsReportSchema`, `StartTripSchema`, `EndTripSchema`, `Segment`, `MatchResult`
- `packages/db/src/schema.ts` — `segments`, `trips`, `gps_reports` tables (Drizzle + postgres.js)
