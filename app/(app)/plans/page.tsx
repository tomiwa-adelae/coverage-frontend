"use client"

import { useState } from "react"
import { useFieldArray, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  IconPencil,
  IconPlus,
  IconRoute,
  IconTrash,
  IconX,
} from "@tabler/icons-react"
import { showFormError } from "@/lib/forms"
import { planSummary } from "@/lib/plans"
import { useCadences, useDeleteCadence, useSaveCadence } from "@/lib/queries"
import { TOUCHES, TOUCH_LABEL, type Cadence } from "@/lib/types"
import { EmptyNote, PageHeader } from "@/components/section"
import { FormField } from "@/components/form-field"
import { NumberInput } from "@/components/inputs"
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
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"

export default function PlansPage() {
  const { data, isError } = useCadences()
  const remove = useDeleteCadence()
  const [editing, setEditing] = useState<Cadence | "new" | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)

  return (
    <>
      <PageHeader
        title="Follow-up plans"
        description="Pick a plan on a prospect and each contact you log schedules the next step for you."
      />
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <IconPlus data-icon="inline-start" /> New plan
        </Button>
      </div>

      {isError ? (
        <EmptyNote>Couldn&apos;t load plans. Refresh to try again.</EmptyNote>
      ) : !data ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : data.length === 0 ? (
        <EmptyNote>No plans yet. Create one to get started.</EmptyNote>
      ) : (
        <div className="space-y-3">
          {data.map((c) => (
            <article
              key={c.id}
              className="rounded-xl border bg-card p-4 shadow-xs"
            >
              <header className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                  <IconRoute className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{c.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {planSummary(c.steps)} · {c.prospectCount} prospect
                    {c.prospectCount === 1 ? "" : "s"} on it
                  </p>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Edit ${c.name}`}
                  onClick={() => setEditing(c)}
                >
                  <IconPencil />
                </Button>
                <Button
                  size={confirm === c.id ? "sm" : "icon-sm"}
                  variant={confirm === c.id ? "destructive" : "ghost"}
                  aria-label={`Delete ${c.name}`}
                  onClick={() => {
                    if (confirm !== c.id) return setConfirm(c.id)
                    remove.mutate(c.id, {
                      onSuccess: () => toast.success(`Deleted ${c.name}`),
                    })
                    setConfirm(null)
                  }}
                >
                  <IconTrash />
                  {confirm === c.id && "Confirm"}
                </Button>
              </header>
              <ol className="mt-3 space-y-1.5 border-l-2 border-primary/20 pl-4 text-sm">
                {c.steps.map((s, i) => (
                  <li key={i}>
                    <span className="font-medium tabular-nums">
                      Day {s.day}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      · {TOUCH_LABEL[s.type]} ·
                    </span>{" "}
                    {s.action}
                  </li>
                ))}
              </ol>
              {confirm === c.id && c.prospectCount > 0 && (
                <p className="mt-2 text-xs text-destructive">
                  {c.prospectCount} prospect{c.prospectCount === 1 ? "" : "s"}{" "}
                  will come off this plan. Their next steps stay as they are.
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
          {editing && (
            <PlanForm
              key={editing === "new" ? "new" : editing.id}
              plan={editing === "new" ? null : editing}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

const planSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the plan a name")
    .max(80, "Keep it under 80 characters"),
  steps: z
    .array(
      z.object({
        day: z
          .number({ error: "Enter a day" })
          .int()
          .min(0, "Day can’t be negative")
          .max(365, "Keep steps within a year"),
        type: z.enum(TOUCHES),
        action: z
          .string()
          .trim()
          .min(1, "Describe the step")
          .max(200, "Keep it under 200 characters"),
      })
    )
    .min(1, "Add at least one step")
    .max(20, "Keep plans to 20 steps or fewer")
    .refine(
      (steps) => steps.every((s, i) => i === 0 || s.day >= steps[i - 1].day),
      "Put the steps in day order"
    ),
})
type PlanValues = z.infer<typeof planSchema>

function PlanForm({
  plan,
  onDone,
}: {
  plan: Cadence | null
  onDone: () => void
}) {
  const save = useSaveCadence()
  const form = useForm<PlanValues>({
    resolver: zodResolver(planSchema),
    defaultValues: plan
      ? { name: plan.name, steps: plan.steps }
      : {
          name: "",
          steps: [{ day: 0, type: "CALL", action: "Introductory call" }],
        },
  })
  const steps = useFieldArray({ control: form.control, name: "steps" })
  const stepsError =
    form.formState.errors.steps?.root ?? form.formState.errors.steps

  async function submit(values: PlanValues) {
    try {
      await save.mutateAsync({ id: plan?.id, ...values })
      toast.success(plan ? "Plan saved" : `Created ${values.name}`)
      onDone()
    } catch (e) {
      showFormError(form, e)
    }
  }

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(submit)}
      className="grid gap-5"
    >
      <DialogHeader>
        <DialogTitle>{plan ? "Edit plan" : "New plan"}</DialogTitle>
        <DialogDescription>
          Day 0 is the day the plan starts. Changes apply to the next step each
          prospect reaches.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup className="gap-5">
        <FormField
          control={form.control}
          name="name"
          label="Name"
          render={(field) => (
            <Input {...field} autoFocus placeholder="e.g. SME owner, 3 weeks" />
          )}
        />
        <div className="space-y-3">
          <p className="text-sm font-medium">Steps</p>
          {steps.fields.map((f, i) => (
            <div
              key={f.id}
              className="grid grid-cols-[4.5rem_7.5rem_1fr_auto] items-start gap-2"
            >
              <FormField
                control={form.control}
                name={`steps.${i}.day`}
                render={({ value, onChange, ...field }) => (
                  <NumberInput
                    {...field}
                    aria-label={`Step ${i + 1} day`}
                    value={value}
                    onChange={(v) => onChange(v ?? 0)}
                    placeholder="Day"
                  />
                )}
              />
              <FormField
                control={form.control}
                name={`steps.${i}.type`}
                render={(field) => (
                  <NativeSelect {...field} aria-label={`Step ${i + 1} how`}>
                    {TOUCHES.map((t) => (
                      <NativeSelectOption key={t} value={t}>
                        {TOUCH_LABEL[t]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                )}
              />
              <FormField
                control={form.control}
                name={`steps.${i}.action`}
                render={(field) => (
                  <Input
                    {...field}
                    aria-label={`Step ${i + 1} action`}
                    placeholder="What to do"
                  />
                )}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Remove step ${i + 1}`}
                disabled={steps.fields.length === 1}
                onClick={() => steps.remove(i)}
              >
                <IconX />
              </Button>
            </div>
          ))}
          {stepsError?.message && (
            <p className="text-sm text-destructive">{stepsError.message}</p>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={steps.fields.length >= 20}
            onClick={() => {
              const last = form.getValues("steps").at(-1)
              steps.append({
                day: (last?.day ?? 0) + 3,
                type: "CALL",
                action: "",
              })
            }}
          >
            <IconPlus data-icon="inline-start" /> Add step
          </Button>
        </div>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving…" : "Save plan"}
        </Button>
      </DialogFooter>
    </form>
  )
}
