import Fastify from "fastify";
import cors from '@fastify/cors';
import { clerkPlugin } from '@clerk/fastify';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { appRouter, sampleSegments } from './router.ts';
import { createContext } from './trpc.js';

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

const reports = [];

app.get("/", async () => {
  return { status: "ok" };
});

app.get("/gtfs/sample", async (req) => {
  const n = Math.min(parseInt(req.query.n ?? '20'), 100)
  return { segments: sampleSegments(n) }
});

app.post("/report", async (req, reply) => {
  reports.push({
    ...req.body,
    receivedAt: Date.now()
  });

  reply.send({ ok: true });
});

app.get("/reports", async () => {
  return reports.slice(-100);
});

app.post('/location', async (request, reply) => {
  const location = request.body;

  console.log('Received location:', location);

  return { status: 'ok' };
});

app.listen({ port: 3000, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`🚀 Server running at ${address}`);
});
