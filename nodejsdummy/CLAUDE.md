# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo layout

This is a pnpm workspace managed by Turborepo, rooted at `ticketproject/`.

```
ticketproject/
├── nodejsdummy/     (@ticketproject/api)    — Fastify API server
├── ticket-client/   (@ticketproject/mobile) — Expo mobile app
└── packages/
    ├── core/        (@ticketproject/core)   — shared Zod schemas and TS types
    ├── db/          (@ticketproject/db)     — Drizzle schema + PostgreSQL client
    └── tsconfig/    (@ticketproject/tsconfig) — shared TS configs
```

## Commands

Run from `ticketproject/` root:
```bash
pnpm install          # install all workspaces
pnpm dev              # turbo dev (all packages in parallel)
pnpm test             # turbo test across all packages
pnpm db:push          # drizzle-kit push (apply schema to DB)
pnpm db:studio        # open Drizzle Studio
```

Run within a specific package:
```bash
# from nodejsdummy/
npx tsx --watch server.js   # dev server with hot reload
npm test                     # Jest tests
npx jest tests/matching.test.ts  # single test file

# from packages/db/
pnpm db:generate    # generate migration files
```

## Environment variables

Copy `.env.example` to `.env` in each app:
- `nodejsdummy/.env` — `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`
- `ticket-client/.env` — `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`

## Architecture

### Data & matching pipeline (`nodejsdummy/src/`)
- `rtree.js` — custom R-Tree with insert, split, and KNN search (no external spatial lib)
- `gtfsUpdater.js` — loads GTFS CSV → `Segment[]`, skips pairs that cross a `shape_id` boundary
- `matcher.ts` — two-stage match: KNN spatial lookup → dot-product scoring
- `util.js` / `viewport.js` / `renderer.js` / `runDemo.js` — headless PNG visualization

### API (`nodejsdummy/`)
- `server.js` — Fastify entry point; registers CORS, Clerk, and tRPC at `/trpc`
- `src/trpc.ts` — tRPC init with Clerk-aware context (`createContext`, `protectedProcedure`)
- `src/router.ts` — `appRouter` (exports `AppRouter` type consumed by mobile)

### Database (`packages/db/`)
- `src/schema.ts` — `segments`, `trips`, `gps_reports` tables
- `src/client.ts` — `db` export (drizzle + postgres.js)
- `drizzle.config.ts` — points at `DATABASE_URL`
- PostGIS: schema has a comment showing how to add a `geometry(LineString)` column and GIST index when spatial queries are needed

### Shared (`packages/core/`)
- `src/types.ts` — Zod schemas (`GpsReportSchema`, `StartTripSchema`, `EndTripSchema`) and plain TS types (`Segment`, `MatchResult`)

### Mobile (`ticket-client/`)
- `src/lib/trpc.ts` — `createTRPCReact<AppRouter>()` client
- `src/providers/index.tsx` — `<Providers>` component: `ClerkProvider` → `TRPCProvider` → `QueryClientProvider`
- Auth token from Clerk is forwarded to the API as `Authorization: Bearer <token>`
- Wrap `App.js` root with `<Providers>` and add Clerk sign-in screens to enable auth + tRPC

## Tests

Jest tests live in `nodejsdummy/tests/`. The matching test runs Monte Carlo trials with ≥85% accuracy at 15° GPS noise. There is no separate build step — ts-jest handles TypeScript at test time.
