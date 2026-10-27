"use client"

import { createContext, useCallback, useContext, useState } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { followUpDays } from "@/lib/contact"
import { addDays, localToday, niceDate } from "@/lib/format"
import { useQuickLog } from "@/lib/queries"
import { TOUCHES, TOUCH_LABEL, type Prospect, type Touch } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export interface QuickLogPreset {
  type?: Touch
  note?: string
}

const QuickLogContext = createContext<
  (p: Prospect, preset?: QuickLogPreset) => void
>(() => {})

/** Open the "log a contact and schedule the next one" dialog for a prospect. */
export const useQuickLogDialog = () => useContext(QuickLogContext)

export function QuickLogProvider({ children }: { children: React.ReactNode }) {
  const [prospect, setProspect] = useState<Prospect | null>(null)
  const [preset, setPreset] = useState<QuickLogPreset>({})
  const open = useCallback((p: Prospect, preset: QuickLogPreset = {}) => {
    setPreset(preset)
    setProspect(p)
  }, [])

  return (
    <QuickLogContext.Provider value={open}>
      {children}
      <Dialog open={!!prospect} onOpenChange={(o) => !o && setProspect(null)}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
          {prospect && (
            <QuickLogForm
              key={prospect.id}
              prospect={prospect}
              preset={preset}
              onDone={() => setProspect(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </QuickLogContext.Provider>
  )
}

const NEXT_OPTIONS: [string, number][] = [
  ["Tomorrow", 1],
  ["3 days", 3],
  ["1 week", 7],
  ["2 weeks", 14],
  ["1 month", 30],
]

function QuickLogForm({
  prospect,
  preset,
  onDone,
}: {
  prospect: Prospect
  preset: QuickLogPreset
  onDone: () => void
}) {
  const today = localToday()
  const [type, setType] = useState<Touch>(preset.type ?? "CALL")
  const [note, setNote] = useState(preset.note ?? "")
  const [nextDate, setNextDate] = useState(
    addDays(today, followUpDays(prospect.tier))
  )
  const [nextAction, setNextAction] = useState(prospect.nextAction ?? "")
  const log = useQuickLog()

  async function submit(e?: React.FormEvent) {
    e?.preventDefault()
    await log.mutateAsync({
      id: prospect.id,
      type,
      note: note || undefined,
      nextDate,
      nextAction,
    })
    toast.success(`Logged for ${prospect.name}`, {
      description: `Next follow-up ${niceDate(nextDate)}`,
    })
    onDone()
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <DialogHeader>
        <DialogTitle>Log contact</DialogTitle>
        <DialogDescription>{prospect.name}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4">
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="How you reached them"
        >
          {TOUCHES.map((t) => (
            <Button
              key={t}
              type="button"
              size="sm"
              variant={type === t ? "default" : "outline"}
              aria-pressed={type === t}
              onClick={() => setType(t)}
            >
              {TOUCH_LABEL[t]}
            </Button>
          ))}
        </div>

        <Field>
          <FieldLabel htmlFor="ql-note">What happened</FieldLabel>
          <Textarea
            id="ql-note"
            rows={2}
            autoFocus
            placeholder="e.g. Interested, wants the forms on Friday"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit()
            }}
          />
        </Field>

        <Field>
          <FieldLabel>Next follow-up</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {NEXT_OPTIONS.map(([label, n]) => {
              const d = addDays(today, n)
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNextDate(d)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted",
                    nextDate === d &&
                      "border-primary bg-primary/10 text-primary"
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <Input
            type="date"
            aria-label="Follow-up date"
            value={nextDate}
            min={today}
            onChange={(e) => setNextDate(e.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="ql-action">Next action</FieldLabel>
          <Input
            id="ql-action"
            placeholder="e.g. Send account opening package"
            value={nextAction}
            onChange={(e) => setNextAction(e.target.value)}
          />
        </Field>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={log.isPending || !nextDate}>
          {log.isPending ? "Saving…" : `Log & schedule`}
        </Button>
      </DialogFooter>
    </form>
  )
}
