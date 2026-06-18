import { initTRPC, TRPCError } from '@trpc/server'
import { getAuth } from '@clerk/fastify'
import type { FastifyRequest } from 'fastify'

export async function createContext({ req }: { req: FastifyRequest }) {
  return { auth: getAuth(req) }
}
export type Context = Awaited<ReturnType<typeof createContext>>

const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure
export const protectedProcedure: ReturnType<typeof t.procedure.use> = t.procedure.use(({ ctx, next }) => {
  if (!ctx.auth.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({ ctx: { auth: ctx.auth } })
})
