"use client"

import { useCallback, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  IconAlertTriangle,
  IconArrowRight,
  IconBrandWhatsapp,
  IconCalendarEvent,
  IconMail,
  IconMessageDots,
  IconMapPin,
  IconMessage,
  IconPhone,
  IconTrash,
  IconUsers,
  IconX,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { telUrl, whatsappUrl } from "@/lib/contact"
import {
  addDays,
  localToday,
  naira,
  nairaShort,
  niceDate,
  parseMoney,
  relativeDay,
} from "@/lib/format"
import {
  useCreateProspect,
  useDeleteActivity,
  useDeleteProspect,
  useProspect,
  useUpdateProspect,
} from "@/lib/queries"
import {
  STAGES,
  STAGE_LABEL,
  TIERS,
  TIER_HINT,
  TOUCH_LABEL,
  type Activity,
  type ProspectDetail,
  type ProspectInput,
  type Touch,
} from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ProspectAvatar, TierPill } from "@/components/prospect-avatar"
import { useQuickLogDialog } from "@/components/quick-log"
import { useMessageDialog } from "@/components/message-dialog"

/** Open a prospect card (or "new") from anywhere; state lives in ?p= so Back closes it. */
export function useOpenProspect() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  return useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(params)
      if (id) next.set("p", id)
      else next.delete("p")
      const qs = next.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname, params]
  )
}

/**
 * The card body, independent of its container (inline panel on wide screens,
 * sheet elsewhere). `Title` lets sheets supply their accessible title element.
 */
export function ProspectPanel({
  id,
  onClose,
  Title = "h2",
}: {
  id: string
  onClose?: () => void
  Title?: React.ElementType
}) {
  if (id === "new")
    return <ProspectForm key="new" onClose={onClose} Title={Title} />
  return <ExistingProspect id={id} onClose={onClose} Title={Title} />
}

function ExistingProspect({
  id,
  onClose,
  Title,
}: {
  id: string
  onClose?: () => void
  Title: React.ElementType
}) {
  const { data, isError } = useProspect(id)
  if (isError)
    return (
      <div className="p-6">
        <Title className="text-lg font-semibold">Prospect not found</Title>
        <p className="mt-1 text-sm text-muted-foreground">
          It may have been deleted.
        </p>
      </div>
    )
  if (!data)
    return (
      <div className="space-y-4 p-6">
        <Title className="sr-only">Loading prospect</Title>
        <div className="flex items-center gap-3">
          <Skeleton className="size-14 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  // Remount whenever the server copy changes so fields show saved values.
  return (
    <ProspectForm
      key={data.updatedAt}
      prospect={data}
      onClose={onClose}
      Title={Title}
    />
  )
}

type Draft = {
  name: string
  company: string
  group: string
  phone: string
  email: string
  tier: string
  stage: string
  potential: string
  funded: string
  nextAction: string
  nextDate: string
  notes: string
}

function toDraft(p?: ProspectDetail): Draft {
  return {
    name: p?.name ?? "",
    company: p?.company ?? "",
    group: p?.group ?? "",
    phone: p?.phone ?? "",
    email: p?.email ?? "",
    tier: p?.tier ?? "",
    stage: p?.stage ?? "IDENTIFIED",
    potential: p?.potential != null ? String(p.potential) : "",
    funded: p?.funded != null ? String(p.funded) : "",
    nextAction: p?.nextAction ?? "",
    nextDate: p?.nextDate ?? "",
    notes: p?.notes ?? "",
  }
}

function toInput(d: Draft): ProspectInput {
  const s = (v: string) => v.trim() || null
  return {
    name: d.name.trim(),
    company: s(d.company),
    group: s(d.group),
    phone: s(d.phone),
    email: s(d.email),
    tier: (d.tier || null) as ProspectInput["tier"],
    stage: d.stage as ProspectInput["stage"],
    potential: parseMoney(d.potential),
    funded: parseMoney(d.funded),
    nextAction: s(d.nextAction),
    nextDate: d.nextDate || null,
    notes: s(d.notes),
  }
}

const QUICK_DATES: [string, number][] = [
  ["Tomorrow", 1],
  ["3 days", 3],
  ["1 week", 7],
  ["2 weeks", 14],
  ["1 month", 30],
]

function ProspectForm({
  prospect,
  onClose,
  Title,
}: {
  prospect?: ProspectDetail
  onClose?: () => void
  Title: React.ElementType
}) {
  const isNew = !prospect
  const open = useOpenProspect()
  const quickLog = useQuickLogDialog()
  const [draft, setDraft] = useState(() => toDraft(prospect))
  const [confirmDelete, setConfirmDelete] = useState(false)

  const create = useCreateProspect()
  const update = useUpdateProspect(prospect?.id ?? "")
  const remove = useDeleteProspect(prospect?.id ?? "")

  const today = localToday()
  const dirty =
    JSON.stringify(toInput(draft)) !==
    JSON.stringify(toInput(toDraft(prospect)))
  const set = (k: keyof Draft) => (v: string) =>
    setDraft((d) => ({ ...d, [k]: v }))
  const bind = (k: keyof Draft) => ({
    value: draft[k],
    onChange: (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => set(k)(e.target.value),
  })

  async function save() {
    if (!draft.name.trim()) return toast.error("Add a name first.")
    if (isNew) {
      const p = await create.mutateAsync(toInput(draft))
      toast.success(`Added ${p.name}`)
      open(p.id)
    } else {
      await update.mutateAsync(toInput(draft))
      toast.success("Changes saved")
    }
  }

  async function onDelete() {
    if (!confirmDelete) return setConfirmDelete(true)
    await remove.mutateAsync()
    toast.success(`Deleted ${prospect?.name}`)
    open(null)
  }

  const saving = create.isPending || update.isPending

  const nextStep = (
    <NextStepEditor draft={draft} set={set} bind={bind} today={today} />
  )
  const status = <StatusEditor draft={draft} set={set} bind={bind} />
  const details = <DetailsEditor bind={bind} autoFocus={isNew} />

  return (
    <div className="flex min-h-full flex-col">
      <header className="relative border-b p-5 sm:p-6">
        {onClose && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute top-4 right-4"
            aria-label="Close"
            onClick={onClose}
          >
            <IconX />
          </Button>
        )}
        {isNew ? (
          <>
            <Title className="text-xl font-semibold tracking-tight">
              New prospect
            </Title>
            <p className="mt-1 text-sm text-muted-foreground">
              Start with a name. Everything else can come later.
            </p>
          </>
        ) : (
          <ProspectHeader
            prospect={prospect}
            Title={Title}
            onLog={() => quickLog(prospect)}
          />
        )}
      </header>

      {isNew ? (
        <div className="flex-1 space-y-7 p-5 sm:p-6">
          <Section title="Details">{details}</Section>
          <Section title="Status">{status}</Section>
          <Section title="Next step">{nextStep}</Section>
        </div>
      ) : (
        <div className="flex-1 p-5 sm:p-6">
          <NextStepSummary prospect={prospect} today={today} />
          <Tabs defaultValue="overview" className="mt-5">
            <TabsList className="w-full">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activity">
                Activity
                {prospect.activities.length > 0 && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {prospect.activities.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="space-y-7 pt-5">
              <Section title="Next step">{nextStep}</Section>
              <Section title="Status">{status}</Section>
            </TabsContent>
            <TabsContent value="activity" className="pt-5">
              <Timeline
                activities={prospect.activities}
                prospectId={prospect.id}
              />
            </TabsContent>
            <TabsContent value="details" className="space-y-7 pt-5">
              {details}
              <div className="rounded-lg border border-destructive/30 p-4">
                <p className="text-sm font-medium">Delete prospect</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Removes the prospect and its history. This can&apos;t be
                  undone.
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  className="mt-3"
                  onClick={onDelete}
                  disabled={remove.isPending}
                >
                  <IconTrash data-icon="inline-start" />
                  {confirmDelete ? "Tap again to confirm" : "Delete"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {(isNew || dirty) && (
        <div className="sticky bottom-0 z-10 flex animate-in items-center gap-2 border-t bg-popover/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur fade-in slide-in-from-bottom-2">
          {!isNew && (
            <span className="mr-auto text-sm text-muted-foreground">
              Unsaved changes
            </span>
          )}
          {!isNew && (
            <Button variant="ghost" onClick={() => setDraft(toDraft(prospect))}>
              Discard
            </Button>
          )}
          <Button
            className={cn(isNew && "flex-1")}
            size="lg"
            onClick={save}
            disabled={saving}
          >
            {saving ? "Saving…" : isNew ? "Add prospect" : "Save changes"}
          </Button>
        </div>
      )}
    </div>
  )
}

function ProspectHeader({
  prospect: p,
  Title,
  onLog,
}: {
  prospect: ProspectDetail
  Title: React.ElementType
  onLog: () => void
}) {
  const message = useMessageDialog()
  return (
    <>
      <div className="flex items-center gap-4 pr-8">
        <ProspectAvatar name={p.name} tier={p.tier} size="lg" />
        <div className="min-w-0">
          <Title className="text-xl leading-tight font-semibold tracking-tight break-words">
            {p.name}
          </Title>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {[p.company, p.group].filter(Boolean).join(" · ") ||
              "No company or group yet"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <TierPill tier={p.tier} />
            <span className="inline-flex h-5 items-center rounded-full bg-secondary px-2 text-[11px] font-semibold text-secondary-foreground">
              {STAGE_LABEL[p.stage]}
            </span>
            {p.potential ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                Potential {nairaShort(p.potential)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button onClick={onLog}>
          <IconCalendarEvent data-icon="inline-start" /> Log contact
        </Button>
        {p.phone && (
          <>
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href={telUrl(p.phone)} />}
            >
              <IconPhone data-icon="inline-start" /> Call
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={
                <a
                  href={whatsappUrl(p.phone)}
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              <IconBrandWhatsapp data-icon="inline-start" /> WhatsApp
            </Button>
          </>
        )}
        {p.email && (
          <Button
            variant="outline"
            nativeButton={false}
            render={<a href={`mailto:${p.email}`} />}
          >
            <IconMail data-icon="inline-start" /> Email
          </Button>
        )}
        <Button variant="outline" onClick={() => message(p)}>
          <IconMessageDots data-icon="inline-start" /> Message
        </Button>
      </div>
    </>
  )
}

function NextStepSummary({
  prospect: p,
  today,
}: {
  prospect: ProspectDetail
  today: string
}) {
  const live = p.stage !== "DECLINED"
  const late = !!p.nextDate && p.nextDate < today
  const missing = live && !p.nextDate
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4",
        late && "border-destructive/30 bg-destructive/5",
        missing && "border-warning/40 bg-warning/10"
      )}
    >
      {(late || missing) && (
        <IconAlertTriangle
          className={cn(
            "mt-0.5 size-4 shrink-0",
            late ? "text-destructive" : "text-warning"
          )}
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Next step
        </p>
        {missing ? (
          <p className="mt-1 text-sm font-medium">
            Nothing scheduled. Set an action and a date below.
          </p>
        ) : !live ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Declined. No follow-up needed.
          </p>
        ) : (
          <p className="mt-1 text-sm font-medium">
            {p.nextAction || "Follow up"}
          </p>
        )}
      </div>
      {p.nextDate && (
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
            late
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-muted-foreground"
          )}
        >
          {relativeDay(p.nextDate, today)}
        </span>
      )}
    </div>
  )
}

type Bind = (k: keyof Draft) => {
  value: string
  onChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => void
}

function NextStepEditor({
  draft,
  set,
  bind,
  today,
}: {
  draft: Draft
  set: (k: keyof Draft) => (v: string) => void
  bind: Bind
  today: string
}) {
  return (
    <div className="space-y-3">
      <Field>
        <FieldLabel htmlFor="nextAction">Action</FieldLabel>
        <Input
          id="nextAction"
          placeholder="e.g. Send account opening package"
          {...bind("nextAction")}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="nextDate">Date</FieldLabel>
        <Input id="nextDate" type="date" {...bind("nextDate")} />
      </Field>
      <div className="flex flex-wrap gap-1.5">
        {QUICK_DATES.map(([label, n]) => {
          const d = addDays(today, n)
          return (
            <button
              key={n}
              type="button"
              onClick={() => set("nextDate")(d)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted",
                draft.nextDate === d &&
                  "border-primary bg-primary/10 text-primary"
              )}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StatusEditor({
  draft,
  set,
  bind,
}: {
  draft: Draft
  set: (k: keyof Draft) => (v: string) => void
  bind: Bind
}) {
  return (
    <div className="space-y-4">
      <Field>
        <FieldLabel>Tier</FieldLabel>
        <div
          className="grid grid-cols-4 gap-1.5"
          role="radiogroup"
          aria-label="Tier"
        >
          {[...TIERS, ""].map((t) => (
            <button
              key={t || "none"}
              type="button"
              role="radio"
              aria-checked={draft.tier === t}
              title={t ? TIER_HINT[t as keyof typeof TIER_HINT] : "Not rated"}
              onClick={() => set("tier")(t)}
              className={cn(
                "h-9 rounded-md border text-sm font-semibold transition-colors hover:bg-muted",
                draft.tier === t &&
                  t === "A" &&
                  "border-tier-a bg-tier-a/15 text-tier-a",
                draft.tier === t &&
                  t === "B" &&
                  "border-tier-b bg-tier-b/12 text-tier-b",
                draft.tier === t &&
                  t === "C" &&
                  "border-tier-c bg-tier-c/12 text-tier-c",
                draft.tier === t && !t && "border-foreground/30 bg-muted"
              )}
            >
              {t || "—"}
            </button>
          ))}
        </div>
        {draft.tier && (
          <FieldDescription>
            {TIER_HINT[draft.tier as keyof typeof TIER_HINT]}
          </FieldDescription>
        )}
      </Field>
      <Field>
        <FieldLabel htmlFor="stage">Stage</FieldLabel>
        <NativeSelect id="stage" {...bind("stage")}>
          {STAGES.map((s) => (
            <NativeSelectOption key={s} value={s}>
              {STAGE_LABEL[s]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyField
          id="potential"
          label="Deposit potential"
          {...bind("potential")}
        />
        <MoneyField id="funded" label="Funded balance" {...bind("funded")} />
      </div>
    </div>
  )
}

function DetailsEditor({
  bind,
  autoFocus,
}: {
  bind: Bind
  autoFocus: boolean
}) {
  return (
    <div className="space-y-4">
      <Field>
        <FieldLabel htmlFor="name">Name</FieldLabel>
        <Input id="name" autoFocus={autoFocus} {...bind("name")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="company">Company or business</FieldLabel>
          <Input id="company" {...bind("company")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="group">Group</FieldLabel>
          <Input
            id="group"
            placeholder="e.g. NYSC, Family"
            {...bind("group")}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="phone">Phone</FieldLabel>
          <Input id="phone" type="tel" inputMode="tel" {...bind("phone")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" type="email" {...bind("email")} />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="notes">Notes</FieldLabel>
        <Textarea
          id="notes"
          rows={4}
          placeholder="Who they are, who they know, what they need"
          {...bind("notes")}
        />
      </Field>
    </div>
  )
}

const TOUCH_ICON = {
  CALL: IconPhone,
  WHATSAPP: IconBrandWhatsapp,
  VISIT: IconMapPin,
  MEETING: IconUsers,
  EMAIL: IconMail,
  SMS: IconMessage,
  STAGE_CHANGE: IconArrowRight,
} as const

function Timeline({
  activities,
  prospectId,
}: {
  activities: Activity[]
  prospectId: string
}) {
  const removeActivity = useDeleteActivity(prospectId)
  if (!activities.length)
    return (
      <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        No contact logged yet. Use{" "}
        <span className="font-medium text-foreground">Log contact</span> after
        every call, message or visit.
      </p>
    )
  return (
    <ol className="relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-border">
      {activities.map((a) => {
        const Icon = TOUCH_ICON[a.type]
        const isStage = a.type === "STAGE_CHANGE"
        return (
          <li key={a.id} className="group relative flex gap-3">
            <span
              className={cn(
                "relative z-10 grid size-8 shrink-0 place-items-center rounded-full border bg-card",
                isStage ? "text-muted-foreground" : "text-primary"
              )}
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p className="text-xs text-muted-foreground">
                {isStage ? "Stage changed" : TOUCH_LABEL[a.type as Touch]} ·{" "}
                {niceDate(a.occurredAt.slice(0, 10))}
              </p>
              <p
                className={cn(
                  "mt-0.5 text-sm",
                  isStage && "text-muted-foreground"
                )}
              >
                {isStage
                  ? `${STAGE_LABEL[a.fromStage!]} → ${STAGE_LABEL[a.toStage!]}`
                  : a.note || "No note"}
              </p>
            </div>
            {!isStage && (
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label="Delete this entry"
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                onClick={() => removeActivity.mutate(a.id)}
              >
                <IconTrash />
              </Button>
            )}
          </li>
        )
      })}
    </ol>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}

function MoneyField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: React.ChangeEventHandler<HTMLInputElement>
}) {
  const n = parseMoney(value)
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label} (₦)</FieldLabel>
      <Input
        id={id}
        inputMode="numeric"
        placeholder="0"
        value={value}
        onChange={onChange}
      />
      {n ? <FieldDescription>{naira(n)}</FieldDescription> : null}
    </Field>
  )
}
