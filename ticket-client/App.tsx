import { useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink } from '@trpc/client'
import { trpc } from './src/lib/trpc'
import { RootShell } from './src/screens/RootShell'

const queryClient = new QueryClient()
const trpcClient  = trpc.createClient({
    links: [
        httpBatchLink({
            url: `${process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000'}/trpc`,
        }),
    ],
})

export default function App() {
    return (
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>
                <StatusBar style="light" />
                <RootShell />
            </QueryClientProvider>
        </trpc.Provider>
    )
}
