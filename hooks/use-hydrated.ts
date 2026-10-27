import { useSyncExternalStore } from "react"

const noop = () => () => {}

/**
 * False during SSR and the first client render, true once React has hydrated.
 * Forms keep submit disabled until then so the browser never falls back to a
 * native submit (which would put a password in the URL).
 */
export function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false
  )
}
