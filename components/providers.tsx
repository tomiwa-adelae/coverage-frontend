"use client"

import { QueryClient } from "@tanstack/react-query"
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client"
import { useState } from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { PwaSupport } from "@/components/pwa"
import { isQueued, registerQueuedMutations } from "@/lib/offline-queue"
import {
  CACHE_BUSTER,
  CACHE_MAX_AGE,
  persister,
  shouldPersist,
} from "@/lib/offline-cache"

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => {
    const qc = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          // Kept as long as the offline copy, or restored data is dropped at once.
          gcTime: CACHE_MAX_AGE,
          refetchOnWindowFocus: true,
          retry: 1,
        },
      },
    })
    registerQueuedMutations(qc)
    return qc
  })
  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister: persister!,
        maxAge: CACHE_MAX_AGE,
        buster: CACHE_BUSTER,
        dehydrateOptions: {
          shouldDehydrateQuery: shouldPersist,
          // Logs and to-dos waiting for signal survive closing the app.
          shouldDehydrateMutation: (m) => isQueued(m) && m.state.isPaused,
        },
      }}
      onSuccess={() => client.resumePausedMutations()}
    >
      <ThemeProvider>
        {children}
        <PwaSupport />
        <Toaster position="top-center" richColors closeButton />
      </ThemeProvider>
    </PersistQueryClientProvider>
  )
}
