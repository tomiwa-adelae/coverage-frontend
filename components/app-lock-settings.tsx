"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { toast } from "sonner"
import {
  disableLock,
  enableLock,
  lockAvailable,
  parseLock,
  readLockRaw,
  setLockDelay,
  subscribeLock,
  unlock,
} from "@/lib/app-lock"
import { useMe } from "@/lib/queries"
import { PageSection } from "@/components/section"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"

const DELAYS: [number, string][] = [
  [0, "Straight away"],
  [1, "After 1 minute"],
  [5, "After 5 minutes"],
  [15, "After 15 minutes"],
]

/** Security page: turn fingerprint/face lock on for this device. */
export function AppLockSettings() {
  const { data: me } = useMe()
  const raw = useSyncExternalStore(subscribeLock, readLockRaw, () => null)
  const lock = parseLock(raw)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    lockAvailable().then((ok) => live && setAvailable(ok))
    return () => {
      live = false
    }
  }, [])

  async function toggle(on: boolean) {
    if (!me) return
    setBusy(true)
    try {
      if (on) {
        await enableLock({ email: me.email, name: me.name }, 1)
        toast.success("App lock is on for this device")
      } else {
        // Prove it's them before switching it off.
        if (await unlock()) {
          disableLock()
          toast.success("App lock is off")
        }
      }
    } catch {
      toast.error(
        on
          ? "App lock wasn’t turned on. Your phone needs a fingerprint, face or screen lock set up."
          : "App lock is still on."
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageSection
      title="App lock"
      hint="Ask for your fingerprint, face or phone PIN when Coverage opens, so no one else can see your prospects on this device."
    >
      <div className="divide-y rounded-xl border bg-card shadow-xs">
        <div className="flex items-center justify-between gap-4 p-4">
          <div className="min-w-0">
            <Label htmlFor="app-lock" className="text-sm font-medium">
              Lock this device
            </Label>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {available === false
                ? "This browser or device can’t use fingerprint or face unlock."
                : "Only on this device. Your phone checks it; Coverage never sees your fingerprint or face."}
            </p>
          </div>
          <Switch
            id="app-lock"
            checked={!!lock}
            disabled={busy || !available || !me}
            onCheckedChange={toggle}
          />
        </div>
        {lock && (
          <div className="flex items-center justify-between gap-4 p-4">
            <Label htmlFor="app-lock-delay" className="text-sm font-medium">
              Lock when I leave the app
            </Label>
            <NativeSelect
              id="app-lock-delay"
              value={String(lock.afterMinutes)}
              onChange={(e) => setLockDelay(Number(e.target.value))}
              className="w-44"
            >
              {DELAYS.map(([v, label]) => (
                <NativeSelectOption key={v} value={v}>
                  {label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        )}
      </div>
    </PageSection>
  )
}
