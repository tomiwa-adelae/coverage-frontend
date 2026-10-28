"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { IconFingerprint, IconLock } from "@tabler/icons-react"
import { api } from "@/lib/api"
import { isLocked, noteVisibility, subscribeLock, unlock } from "@/lib/app-lock"
import { clearOfflineCache } from "@/lib/offline-cache"
import { disablePush } from "@/lib/push"
import { BrandLockup } from "@/components/brand"
import { Button } from "@/components/ui/button"

/** Covers the app until fingerprint/face unlock, when App lock is on. */
export function AppLock() {
  const locked = useSyncExternalStore(subscribeLock, isLocked, () => false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const on = () => noteVisibility(document.visibilityState === "visible")
    document.addEventListener("visibilitychange", on)
    return () => document.removeEventListener("visibilitychange", on)
  }, [])

  if (!locked) return null

  async function tryUnlock() {
    setBusy(true)
    setError(null)
    try {
      if (!(await unlock())) setError("That didn’t work. Try again.")
    } catch {
      setError("That didn’t work. Try again, or sign out and back in.")
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    await disablePush().catch(() => {})
    await api("/auth/logout", { method: "POST" }).catch(() => {})
    clearOfflineCache()
    window.location.href = "/login"
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Coverage is locked"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-background p-6 text-center"
    >
      <BrandLockup />
      <div>
        <IconLock className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 font-semibold">Coverage is locked</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Use your fingerprint, face or phone PIN to open it.
        </p>
      </div>
      <Button size="lg" onClick={tryUnlock} disabled={busy} autoFocus>
        <IconFingerprint /> Unlock
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button variant="ghost" size="sm" onClick={signOut}>
        Sign out instead
      </Button>
    </div>
  )
}
