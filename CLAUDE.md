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
npm run test:interpolation   # majority-vote accuracy at N=1,3,5,10 (needs TREE_CACHED=1)
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
│   ├── test-utils.ts           — applyGpsNoise (angle noise), interpolateWithNoise (position noise)
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

Full deduplicated tree (1739 segments after removing coordinate-identical duplicates) at `server/cache/rtree.json` (gitignored via `/server/cache/` in root .gitignore).
Rebuild: `npm run cache:tree:rebuild`. Takes ~2-3s. Deserialization is near-instant.
R-Tree has circular `parent` refs — serialization strips them, deserialization reconstructs them.
Deduplication is in `gtfsUpdater.js` via a coordinate hashmap keyed on `p1.x,p1.y,p2.x,p2.y` (6dp). Direction-preserving — opposite-direction segments on the same street are kept as distinct entries.

## Matching accuracy (last measured)

- **Single-vector, deduplicated tree, 200 trials:** winner 60.5%, tied-set 60.5%, redundancy gap 0%
- **Single-vector, duplicate tree, 50 trials:** winner 22%, tied-set 82%, redundancy gap 60%

The jump from 22% → 60.5% came entirely from deduplication. The tied-set drop from 82% → 60.5% is not regression — with duplicates the correct street appeared multiple times so tied-set was inflated. Now each physical location exists once; winner == tied-set is correct.
Remaining ~39.5% failures are genuine direction mismatch from GPS noise.

## Interpolation tests (branch: feature/interpolation-tests)

### What's already built

`interpolateWithNoise(seg, steps, sigmaDeg)` in `src/spatial/test-utils.ts`:
- Interpolates `steps+1` evenly-spaced points along segment A→B
- Adds independent Gaussian position noise (Box-Muller) to each point, default sigma=0.0001° (~10m)
- Returns `steps` consecutive direction vectors (as `GpsSegment[]`) — the simulated GPS readings

This is more realistic than the existing `applyGpsNoise` (which adds angle noise to a single vector). Real GPS error is positional, so direction noise is derived from two noisy positions, not applied directly to the angle.

### Majority-vote matcher — `src/spatial/majorityMatcher.ts`

`majorityVote(seg, tree, steps, sigmaDeg?, k?)`:
- Calls `interpolateWithNoise` to produce `steps` direction vectors
- Runs each through `findBestSegmentDebug` (to get scores for tiebreaking)
- Tallies votes per matched segment; tiebreak by cumulative cosine score
- Returns `{ winner, votes, vectorResults }` — `vectorResults` carries per-vector `matched` + `score` for viz

### Majority-vote test — `tests/matching-gtfs-interpolation.test.ts`

Runs N=1,3,5,10 as separate Jest tests in one describe block.
`npm run test:interpolation` (needs `TREE_CACHED=1`).
Expected convergence: N=1→~60.5% (baseline), N=5→~83%, N=10→~93%.

### Interpolation visualizer — `renderInterpolationCase` in `matchVisualizer.js`

Parallel to `renderFailureCase` (don't modify existing).
Takes `{ trueSeg, vectorResults, majorityWinner }`:
- Faint white line = ideal segment
- Yellow dots = N+1 noisy GPS position samples (reconstructed from vector minX/minY + final maxX/maxY)
- Green/orange arrows = per-vector direction vectors (green=matched expected, orange=wrong)
- Faint orange = segments the matcher wrongly picked
- Sidebar: legend, ideal segment coords, majority winner (correct/wrong), per-vector vote list

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
