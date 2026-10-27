"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { IconPhoneCheck } from "@tabler/icons-react"
import { OUTCOMES, OUTCOME_LABEL, type Prospect } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useQuickLogDialog } from "@/components/quick-log"

const KEY = "coverage.pendingCall"
/** Coming back sooner than this means the call never really happened. */
const MIN_AWAY_MS = 4_000
/** A call tapped this long ago is too old to ask about. */
const MAX_AGE_MS = 2 * 60 * 60_000

interface Pending {
  prospect: Prospect
  at: number
}

const CallContext = createContext<(p: Prospect) => void>(() => {})

/**
 * Call this when a Call button is tapped. When the user comes back to the app
 * after the call, they're asked how it went and the answer goes into the log.
 */
export const useTrackCall = () => useContext(CallContext)

export function CallTrackerProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const quickLog = useQuickLogDialog()
  const [asking, setAsking] = useState<Prospect | null>(null)
  const pending = useRef<Pending | null>(null)
  const leftAt = useRef<number | null>(null)

  const track = useCallback((prospect: Prospect) => {
    pending.current = { prospect, at: Date.now() }
    leftAt.current = null
    try {
      // Survives the tab being reloaded by the phone while the dialler was open.
      sessionStorage.setItem(KEY, JSON.stringify(pending.current))
    } catch {}
  }, [])

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(KEY)
      if (saved) pending.current = JSON.parse(saved) as Pending
    } catch {}

    const clear = () => {
      pending.current = null
      try {
        sessionStorage.removeItem(KEY)
      } catch {}
    }

    const away = () => {
      if (pending.current) leftAt.current = Date.now()
    }
    const back = () => {
      const p = pending.current
      if (!p) return
      const now = Date.now()
      if (now - p.at > MAX_AGE_MS) return clear()
      // Reloaded tabs lose leftAt; time since the tap is the next best measure.
      const gone = now - (leftAt.current ?? p.at)
      if (gone < MIN_AWAY_MS) return
      clear()
      setAsking(p.prospect)
    }
    const onVisibility = () =>
      document.visibilityState === "hidden" ? away() : back()

    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("blur", away)
    window.addEventListener("focus", back)
    // A restored tab may already be visible with a call waiting.
    if (pending.current && document.visibilityState === "visible") back()
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("blur", away)
      window.removeEventListener("focus", back)
    }
  }, [])

  return (
    <CallContext.Provider value={track}>
      {children}
      <Dialog open={!!asking} onOpenChange={(o) => !o && setAsking(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <span className="mb-1 grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
              <IconPhoneCheck className="size-5" />
            </span>
            <DialogTitle>How did it go?</DialogTitle>
            <DialogDescription>Your call with {asking?.name}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {OUTCOMES.map((o) => (
              <Button
                key={o}
                variant="outline"
                className="h-auto justify-start py-2.5 whitespace-normal"
                onClick={() => {
                  const p = asking!
                  setAsking(null)
                  quickLog(p, { type: "CALL", outcome: o })
                }}
              >
                {OUTCOME_LABEL[o]}
              </Button>
            ))}
          </div>
          <Button variant="ghost" onClick={() => setAsking(null)}>
            I didn&apos;t call
          </Button>
        </DialogContent>
      </Dialog>
    </CallContext.Provider>
  )
}
