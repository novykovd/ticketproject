Based on everything in this conversation, here's the full picture:

---

**Monorepo root (`ticketproject/`)**
- pnpm workspaces, Turborepo
- No app code lives here, just orchestration

---

**`nodejsdummy/` (`@ticketproject/api`)**

Dependencies:
- `fastify`, `@fastify/cors` — HTTP server
- `@clerk/fastify` — auth middleware
- `@trpc/server` — API layer
- `@ticketproject/core`, `@ticketproject/db` — workspace siblings
- `zod` — validation

Dev dependencies:
- `jest@^29.7.0`, `ts-jest@^29.4.11`, `@types/jest@^29.5.0`
- `typescript`, `tsx`, `@types/node`

Jest config (`jest.config.cjs`):
- ESM mode via `--experimental-vm-modules`
- Transforms `.ts`/`.tsx` through ts-jest with `useESM: true`
- `moduleNameMapper` strips `.js` extensions so TypeScript files resolve correctly
- Run with `npm test` (not `npx jest` — that skips the vm-modules flag)

Writing a test:
```ts
// tests/something.test.ts
import { whatever } from '../src/whatever'

test('does the thing', () => {
  expect(whatever()).toBe(true)
})
```

---

**`packages/core/` (`@ticketproject/core`)**

Dependencies:
- `zod` only

No `@types/node` — this package is intentionally kept environment-agnostic so it could theoretically run on mobile too.

What's exported from `src/index.ts`:
- `GpsReportSchema`, `StartTripSchema`, `EndTripSchema` — Zod schemas
- `GpsReport`, `Segment`, `MatchResult` — TypeScript types

Pulling types into another package:
```ts
import type { Segment, MatchResult } from '@ticketproject/core'
import { GpsReportSchema } from '@ticketproject/core'
```

---

**`packages/db/` (`@ticketproject/db`)**

Dependencies:
- `drizzle-orm`, `postgres`

Dev dependencies:
- `drizzle-kit`, `@types/node`

What's exported:
- `db` — the Drizzle client instance
- `segments`, `trips`, `gpsReports` — table schemas

Needs `DATABASE_URL` in environment before anything works.

---

**`ticket-client/` (`@ticketproject/mobile`)**

Dependencies:
- `expo@51`, `react-native`, `expo-location`, `expo-secure-store`
- `@clerk/clerk-expo` — auth
- `@trpc/client`, `@trpc/react-query`, `@tanstack/react-query` — typed API calls
- `@ticketproject/core` — shared types/schemas

Dev dependencies:
- `@ticketproject/api` as a dev dep — only for importing the `AppRouter` type, nothing runtime

The tRPC client is in `src/lib/trpc.ts`:
```ts
import { trpc } from '@/lib/trpc'
// then in a component:
const result = trpc.health.useQuery()
```

Wrap your app root with `<Providers>` from `src/providers/index.tsx` to get Clerk + tRPC + React Query all wired up.

---

**Key rule across the whole monorepo:** `packages/core` and `packages/db` are the shared foundation. `nodejsdummy` is the only thing that should touch Fastify/server concerns. `ticket-client` is the only thing that should touch Expo/React Native concerns. Cross-package imports go through the `@ticketproject/*` package names, never via relative paths across package boundaries.