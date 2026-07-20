import Fastify from "fastify";
import cors from '@fastify/cors';
import { clerkPlugin } from '@clerk/fastify';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { appRouter, sampleSegments } from './api/router.ts'
import { createContext } from './api/trpc.js'
import { resolveSource } from './routing/googleRoutes.js'

// Startup env diagnostic — prints presence/length (never the secret value) so
// you can confirm what the process actually loaded via --env-file, and which
// routes source that resolves to.
const mask = (v) => (v ? `set (len ${v.length})` : 'MISSING')
console.log('[env] ROUTES_SOURCE      :', process.env.ROUTES_SOURCE ?? '(unset → auto)')
console.log('[env] GOOGLE_MAPS_API_KEY :', mask(process.env.GOOGLE_MAPS_API_KEY))
console.log('[env] DATABASE_URL       :', mask(process.env.DATABASE_URL))
console.log('[env] CLERK_PUBLISHABLE   :', mask(process.env.CLERK_PUBLISHABLE_KEY))
console.log('[env] → routes resolve to :', resolveSource())

const app = Fastify({
  logger: true
});

await app.register(cors, { origin: true });
if (process.env.CLERK_PUBLISHABLE_KEY) {
  await app.register(clerkPlugin);
}
await app.register(fastifyTRPCPlugin, {
  prefix: '/trpc',
  trpcOptions: { router: appRouter, createContext },
});

app.get("/", async () => {
  return { status: "ok" };
});

app.get("/gtfs/sample", async (req) => {
  const n = Math.min(parseInt(req.query.n ?? '20'), 100)
  return { segments: sampleSegments(n) }
});

app.listen({ port: 3000, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`🚀 Server running at ${address}`);
});
