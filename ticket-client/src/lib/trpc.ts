import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '@ticketproject/server'

export const trpc: ReturnType<typeof createTRPCReact<AppRouter>> = createTRPCReact<AppRouter>()
