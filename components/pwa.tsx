"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { IconDeviceMobileDown, IconWifiOff, IconX } from "@tabler/icons-react"
import { swUrl } from "@/lib/push"
import { Button } from "@/components/ui/button"

interface InstallPrompt extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const DISMISS_KEY = "coverage.installDismissed"

/** Registers the service worker, offers "Install app", and flags offline mode. */
export function PwaSupport() {
  const online = useSyncExternalStore(
    (notify) => {
      window.addEventListener("online", notify)
      window.addEventListener("offline", notify)
      return () => {
        window.removeEventListener("online", notify)
        window.removeEventListener("offline", notify)
      }
    },
    () => navigator.onLine,
    () => true
  )
  const [install, setInstall] = useState<InstallPrompt | null>(null)

  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker
        .register(swUrl(), { scope: "/", updateViaCache: "none" })
        .catch(() => {})

    const offer = (e: Event) => {
      e.preventDefault()
      let dismissed = false
      try {
        dismissed = !!localStorage.getItem(DISMISS_KEY)
      } catch {}
      if (!dismissed) setInstall(e as InstallPrompt)
    }
    const installed = () => setInstall(null)
    window.addEventListener("beforeinstallprompt", offer)
    window.addEventListener("appinstalled", installed)
    return () => {
      window.removeEventListener("beforeinstallprompt", offer)
      window.removeEventListener("appinstalled", installed)
    }
  }, [])

  function dismiss() {
    setInstall(null)
    try {
      localStorage.setItem(DISMISS_KEY, "1")
    } catch {}
  }

  return (
    <>
      {!online && (
        <div
          role="status"
          className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-foreground px-4 pt-[max(0.375rem,env(safe-area-inset-top))] pb-1.5 text-xs font-medium text-background"
        >
          <IconWifiOff className="size-4" />
          You&apos;re offline. Showing your last saved list; changes need a
          connection.
        </div>
      )}
      {install && online && (
        <div className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center gap-3 rounded-xl border bg-popover p-3 shadow-lg lg:bottom-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
            <IconDeviceMobileDown className="size-5" />
          </span>
          <p className="min-w-0 flex-1 text-sm">
            <span className="block font-medium">Install Coverage</span>
            <span className="block text-xs text-muted-foreground">
              Opens like an app, works offline, sends reminders.
            </span>
          </p>
          <Button
            size="sm"
            onClick={async () => {
              await install.prompt()
              await install.userChoice
              setInstall(null)
            }}
          >
            Install
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Not now"
            onClick={dismiss}
          >
            <IconX />
          </Button>
        </div>
      )}
    </>
  )
}
