import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister"
import type { Query } from "@tanstack/react-query"

/** Bump when cached shapes change so old caches are dropped instead of misread. */
export const CACHE_BUSTER = "2026-10-customer-care"
export const CACHE_KEY = "coverage.cache"
/** How long a saved copy is good for when offline. */
export const CACHE_MAX_AGE = 24 * 60 * 60_000

// What's worth having offline: today's list, prospects, progress and settings.
const OFFLINE_KEYS = new Set([
  "me",
  "dashboard",
  "prospects",
  "templates",
  "cadences",
  "balances",
])

export const shouldPersist = (q: Query) =>
  q.state.status === "success" && OFFLINE_KEYS.has(String(q.queryKey[0]))

export const persister =
  typeof window === "undefined"
    ? undefined
    : createSyncStoragePersister({
        storage: window.localStorage,
        key: CACHE_KEY,
        throttleTime: 2_000,
      })

/** Prospect data must not outlive the session on a shared device. */
export function clearOfflineCache() {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {}
}
