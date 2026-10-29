"use client"

import { createContext, useCallback, useContext, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { IconRoute, IconSparkles } from "@tabler/icons-react"
import { toast } from "sonner"
import { z } from "zod"
import { careDays, followUpDays } from "@/lib/contact"
import { sendOrQueue } from "@/lib/offline-queue"
import { useQueryClient } from "@tanstack/react-query"
import { addDays, clock, localToday, niceDate } from "@/lib/format"
import { planProgress } from "@/lib/plans"
import {
  useAiStatus,
  useCadences,
  useQuickLog,
  useTidyNote,
} from "@/lib/queries"
import { showFormError } from "@/lib/forms"
import {
  OUTCOMES,
  OUTCOME_LABEL,
  TOUCHES,
  TOUCH_LABEL,
  type Outcome,
  type Prospect,
  type Touch,
} from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import { FormField } from "@/components/form-field"
import { Chip } from "@/components/prospect-fields"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { DictateButton, appendText, useDictation } from "@/components/dictate"

export interface QuickLogPreset {
  type?: Touch
  outcome?: Outcome
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

/** Outcomes where nobody was reached: try again soon, keep the plan where it is. */
const UNREACHED: Outcome[] = ["NO_ANSWER", "WRONG_NUMBER"]

const quickLogSchema = z.object({
  type: z.enum(TOUCHES),
  outcome: z.enum(["", ...OUTCOMES]),
  note: z.string().trim().max(1000, "Keep the note under 1,000 characters"),
  nextDate: z.string().min(1, "Pick the next follow-up date"),
  nextTime: z.string(),
  nextAction: z.string().trim().max(200, "Keep it under 200 characters"),
})
type QuickLogValues = z.infer<typeof quickLogSchema>

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
  const qc = useQueryClient()
  const log = useQuickLog()
  const tidy = useTidyNote()
  const { data: ai } = useAiStatus()
  const { data: cadences } = useCadences()
  const plan = planProgress(prospect, cadences, today)

  /** What to schedule next, given how the contact went. */
  const defaultsFor = (outcome: Outcome | "") =>
    UNREACHED.includes(outcome as Outcome)
      ? {
          nextDate: addDays(today, 1),
          nextAction: prospect.nextAction ?? "",
        }
      : plan?.next
        ? { nextDate: plan.next.nextDate, nextAction: plan.next.nextAction }
        : {
            nextDate: addDays(
              today,
              prospect.stage === "FUNDED"
                ? careDays(prospect.tier)
                : followUpDays(prospect.tier)
            ),
            nextAction: prospect.nextAction ?? "",
          }

  const form = useForm<QuickLogValues>({
    resolver: zodResolver(quickLogSchema),
    defaultValues: {
      type: preset.type ?? plan?.current?.type ?? "CALL",
      outcome: preset.outcome ?? "",
      note: preset.note ?? "",
      nextTime: "",
      ...defaultsFor(preset.outcome ?? ""),
    },
  })
  const [nextDate, outcome, note] = useWatch({
    control: form.control,
    name: ["nextDate", "outcome", "note"],
  })
  const dictation = useDictation((text) =>
    form.setValue("note", appendText(form.getValues("note"), text))
  )

  function pickOutcome(o: Outcome | "") {
    form.setValue("outcome", o)
    // Only move the dates while they're still the defaults the user hasn't touched.
    if (!form.getFieldState("nextDate").isDirty) {
      const d = defaultsFor(o)
      form.setValue("nextDate", d.nextDate)
      if (!form.getFieldState("nextAction").isDirty)
        form.setValue("nextAction", d.nextAction)
    }
  }

  async function tidyNote() {
    dictation.stop()
    try {
      const r = await tidy.mutateAsync({
        text: form.getValues("note"),
        prospectId: prospect.id,
      })
      form.setValue("note", r.note, { shouldDirty: true })
      if (r.outcome && !form.getValues("outcome")) pickOutcome(r.outcome)
      if (r.nextAction)
        form.setValue("nextAction", r.nextAction, { shouldDirty: true })
      if (r.nextInDays !== null && r.nextInDays >= 0)
        form.setValue("nextDate", addDays(today, Math.max(1, r.nextInDays)), {
          shouldDirty: true,
        })
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function submit(values: QuickLogValues) {
    dictation.stop()
    try {
      const how = await sendOrQueue(qc, log.mutateAsync, {
        id: prospect.id,
        ...values,
        outcome: values.outcome || undefined,
        note: values.note || undefined,
        nextTime: values.nextTime || undefined,
        clientId: crypto.randomUUID(),
      })
      const next = `Next follow-up ${niceDate(values.nextDate)}${values.nextTime ? ` at ${clock(values.nextTime)}` : ""}`
      if (how === "queued")
        toast.info(`Saved on this phone for ${prospect.name}`, {
          description: `No connection, so it’ll send when you’re back online. ${next}`,
        })
      else toast.success(`Logged for ${prospect.name}`, { description: next })
      onDone()
    } catch (e) {
      showFormError(form, e)
    }
  }

  const unreached = UNREACHED.includes(outcome as Outcome)

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(submit)}
      className="grid gap-5"
    >
      <DialogHeader>
        <DialogTitle>Log contact</DialogTitle>
        <DialogDescription>{prospect.name}</DialogDescription>
      </DialogHeader>

      <FieldGroup className="gap-5">
        <FormField
          control={form.control}
          name="type"
          label="How did you reach them?"
          render={({ value, onChange }) => (
            <div
              className="flex flex-wrap gap-1.5"
              role="radiogroup"
              aria-label="How you reached them"
            >
              {TOUCHES.map((t) => (
                <Button
                  key={t}
                  type="button"
                  size="sm"
                  role="radio"
                  aria-checked={value === t}
                  variant={value === t ? "default" : "outline"}
                  onClick={() => onChange(t)}
                >
                  {TOUCH_LABEL[t]}
                </Button>
              ))}
            </div>
          )}
        />

        <FormField
          control={form.control}
          name="outcome"
          label="How did it go?"
          description={
            unreached
              ? "Not counted as a contact. The plan stays on this step."
              : undefined
          }
          render={({ value }) => (
            <div className="flex flex-wrap gap-1.5">
              {OUTCOMES.map((o) => (
                <Chip
                  key={o}
                  active={value === o}
                  onClick={() => pickOutcome(value === o ? "" : o)}
                >
                  {OUTCOME_LABEL[o]}
                </Chip>
              ))}
            </div>
          )}
        />

        <FormField
          control={form.control}
          name="note"
          label="What happened"
          render={(field) => (
            <>
              <Textarea
                {...field}
                rows={3}
                autoFocus
                placeholder="e.g. Interested, wants the forms on Friday"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                    form.handleSubmit(submit)()
                }}
              />
              <div className="flex flex-wrap gap-1.5">
                <DictateButton dictation={dictation} />
                {ai?.enabled && note.trim().length > 15 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={tidy.isPending}
                    onClick={tidyNote}
                  >
                    <IconSparkles data-icon="inline-start" />
                    {tidy.isPending ? "Tidying…" : "Tidy up & fill in"}
                  </Button>
                )}
              </div>
            </>
          )}
        />

        <FormField
          control={form.control}
          name="nextDate"
          label="Next follow-up"
          render={(field) => (
            <>
              {plan?.next && !unreached && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <IconRoute className="size-3.5" />
                  {plan.plan.name}: step {plan.index + 2} of{" "}
                  {plan.plan.steps.length}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {NEXT_OPTIONS.map(([label, n]) => {
                  const d = addDays(today, n)
                  return (
                    <Chip
                      key={n}
                      active={nextDate === d}
                      onClick={() =>
                        form.setValue("nextDate", d, {
                          shouldValidate: true,
                          shouldDirty: true,
                        })
                      }
                    >
                      {label}
                    </Chip>
                  )
                })}
              </div>
              <div className="flex gap-2">
                <Input {...field} type="date" min={today} className="flex-1" />
                <Input
                  {...form.register("nextTime")}
                  type="time"
                  className="w-32"
                  aria-label="Time (optional)"
                  title="Add a time to get a reminder before it"
                />
              </div>
            </>
          )}
        />

        <FormField
          control={form.control}
          name="nextAction"
          label="Next action"
          render={(field) => (
            <Input {...field} placeholder="e.g. Send account opening package" />
          )}
        />
      </FieldGroup>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving…" : "Log & schedule"}
        </Button>
      </DialogFooter>
    </form>
  )
}
