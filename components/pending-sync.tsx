"use client"

import { IconCloudUpload, IconWifiOff } from "@tabler/icons-react"
import { onlineManager, useMutationState } from "@tanstack/react-query"
import { useSyncExternalStore } from "react"
import { isQueued } from "@/lib/offline-queue"

const useOnline = () =>
  useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
    () => true
  )

/** A slim bar above the page while offline or while saved work is still to send. */
export function PendingSync() {
  const online = useOnline()
  const waiting = useMutationState({
    filters: { predicate: isQueued },
    select: (m) => m.mutationId,
  }).length
  if (online && !waiting) return null
  const what = `${waiting} ${waiting === 1 ? "change" : "changes"}`
  return (
    <div
      role="status"
      className="mb-4 flex items-center gap-2 rounded-lg border bg-muted/60 px-3 py-2 text-sm text-muted-foreground"
    >
      {online ? (
        <IconCloudUpload className="size-4 shrink-0" aria-hidden />
      ) : (
        <IconWifiOff className="size-4 shrink-0" aria-hidden />
      )}
      {online
        ? `Sending ${what}…`
        : waiting
          ? `Offline. ${what} saved on this phone will send when you’re back.`
          : "Offline. You can still log contacts and add to-dos; they’ll send when you’re back."}
    </div>
  )
}
