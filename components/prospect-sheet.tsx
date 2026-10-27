"use client"

import { useCallback, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  IconAlertTriangle,
  IconArrowRight,
  IconBrandGoogle,
  IconBrandWhatsapp,
  IconCalendarEvent,
  IconCalendarPlus,
  IconDownload,
  IconMail,
  IconMessageDots,
  IconMapPin,
  IconMessage,
  IconPhone,
  IconSparkles,
  IconTrash,
  IconUsers,
  IconX,
} from "@tabler/icons-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { telUrl, whatsappUrl } from "@/lib/contact"
import { downloadIcs, googleCalendarUrl } from "@/lib/calendar"
import { localToday, naira, niceDate, relativeDay } from "@/lib/format"
import { showFormError } from "@/lib/forms"
import {
  useAiStatus,
  useCreateProspect,
  useDeleteActivity,
  useDeleteProspect,
  useProspect,
  useProspectsMeta,
  useUpdateProspect,
} from "@/lib/queries"
import {
  OUTCOME_LABEL,
  STAGE_LABEL,
  TOUCH_LABEL,
  type Activity,
  type ProspectDetail,
  type Touch,
} from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProspectAvatar, TierPill } from "@/components/prospect-avatar"
import { useQuickLogDialog } from "@/components/quick-log"
import { useMessageDialog } from "@/components/message-dialog"
import { useTrackCall } from "@/components/call-tracker"
import { BriefDialog } from "@/components/ai-brief"
import { BalancesPanel } from "@/components/balances-panel"
import {
  ConsentFields,
  DetailsFields,
  LocationFields,
  NextStepFields,
  PlanField,
  RelationshipFields,
  StatusFields,
  prospectSchema,
  toDraft,
  toInput,
  type ProspectDraft,
} from "@/components/prospect-fields"

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
  // Lives here so saving (which remounts the form) keeps you on the same tab.
  const [tab, setTab] = useState("overview")
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
      tab={tab}
      onTab={setTab}
    />
  )
}

function ProspectForm({
  prospect,
  onClose,
  Title,
  tab,
  onTab,
}: {
  prospect?: ProspectDetail
  onClose?: () => void
  Title: React.ElementType
  tab?: string
  onTab?: (tab: string) => void
}) {
  const isNew = !prospect
  const open = useOpenProspect()
  const quickLog = useQuickLogDialog()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { data: meta } = useProspectsMeta()
  const form = useForm<ProspectDraft>({
    resolver: zodResolver(prospectSchema),
    defaultValues: toDraft(prospect),
  })

  const create = useCreateProspect()
  const update = useUpdateProspect(prospect?.id ?? "")
  const remove = useDeleteProspect(prospect?.id ?? "")

  const today = localToday()
  const dirty = form.formState.isDirty

  async function save(values: ProspectDraft) {
    try {
      if (isNew) {
        const p = await create.mutateAsync(toInput(values))
        toast.success(`Added ${p.name}`)
        open(p.id)
      } else {
        await update.mutateAsync(toInput(values))
        toast.success("Changes saved")
      }
    } catch (e) {
      showFormError(form, e)
    }
  }

  async function onDelete() {
    if (!confirmDelete) return setConfirmDelete(true)
    await remove.mutateAsync()
    toast.success(`Deleted ${prospect?.name}`)
    open(null)
  }

  const saving = form.formState.isSubmitting
  const nextStep = (
    <div className="space-y-5">
      <PlanField form={form} prospect={prospect} />
      <NextStepFields form={form} today={today} />
    </div>
  )
  const status = <StatusFields form={form} />
  const details = (
    <DetailsFields form={form} groups={meta?.groups} autoFocus={isNew} />
  )
  const relationship = <RelationshipFields form={form} selfId={prospect?.id} />
  const showBalances =
    !!prospect &&
    (prospect.stage === "ACCOUNT_OPENED" ||
      prospect.stage === "FUNDED" ||
      prospect.balances.length > 0)

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(save, () =>
        toast.error("Some details need fixing", {
          description: "Check the highlighted fields.",
        })
      )}
      className="flex min-h-full flex-col"
    >
      <header className="relative border-b p-5 sm:p-6">
        {onClose && (
          <Button
            type="button"
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
          <Section title="Relationship">{relationship}</Section>
        </div>
      ) : (
        <div className="flex-1 p-5 sm:p-6">
          <NextStepSummary prospect={prospect} today={today} />
          <Tabs
            value={tab}
            onValueChange={(v) => onTab?.(String(v))}
            className="mt-5"
          >
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
              {showBalances && (
                <TabsTrigger value="balances">Balances</TabsTrigger>
              )}
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
              <Section title="Relationship">
                {relationship}
                <Connections prospect={prospect} />
              </Section>
              <Section title="Location">
                <LocationFields form={form} areas={meta?.areas} />
              </Section>
              <Section title="Consent">
                <ConsentFields form={form} consentAt={prospect.consentAt} />
              </Section>
              <div className="rounded-lg border border-destructive/30 p-4">
                <p className="text-sm font-medium">Delete prospect</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Removes the prospect and its history. This can&apos;t be
                  undone.
                </p>
                <Button
                  type="button"
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
            {showBalances && (
              <TabsContent value="balances" className="pt-5">
                <BalancesPanel prospect={prospect} />
              </TabsContent>
            )}
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
            <Button type="button" variant="ghost" onClick={() => form.reset()}>
              Discard
            </Button>
          )}
          <Button
            type="submit"
            className={cn(isNew && "flex-1")}
            size="lg"
            disabled={saving}
          >
            {saving ? "Saving…" : isNew ? "Add prospect" : "Save changes"}
          </Button>
        </div>
      )}
    </form>
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
  const trackCall = useTrackCall()
  const { data: ai } = useAiStatus()
  const [prep, setPrep] = useState(false)
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
                Potential {naira(p.potential)}
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
              render={<a href={telUrl(p.phone)} onClick={() => trackCall(p)} />}
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
        {ai?.enabled && (
          <Button variant="outline" onClick={() => setPrep(true)}>
            <IconSparkles data-icon="inline-start" /> Prep
          </Button>
        )}
      </div>
      {ai?.enabled && (
        <BriefDialog
          prospectId={p.id}
          name={p.name}
          open={prep}
          onOpenChange={setPrep}
        />
      )}
    </>
  )
}

/** Who referred them, who they referred, and others at the same company. */
function Connections({ prospect: p }: { prospect: ProspectDetail }) {
  const open = useOpenProspect()
  const rows: [string, { id: string; name: string }[]][] = [
    ["Referred by", p.referredBy ? [p.referredBy] : []],
    ["Referred", p.referrals],
    [`Also at ${p.company}`, p.sameCompany],
  ]
  const shown = rows.filter(([, list]) => list.length)
  if (!shown.length) return null
  return (
    <dl className="mt-5 space-y-3 rounded-lg bg-muted/50 p-4 text-sm">
      {shown.map(([label, list]) => (
        <div key={label}>
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            {list.map((r) => (
              <button
                key={r.id}
                type="button"
                className="rounded-full border bg-card px-2.5 py-0.5 text-xs font-medium hover:bg-muted"
                onClick={() => open(r.id)}
              >
                {r.name}
              </button>
            ))}
          </dd>
        </div>
      ))}
    </dl>
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
      {p.nextDate && live && <AddToCalendar prospect={p} date={p.nextDate} />}
    </div>
  )
}

function AddToCalendar({
  prospect: p,
  date,
}: {
  prospect: ProspectDetail
  date: string
}) {
  const event = {
    title: `${p.nextAction || "Follow up"}: ${p.name}`,
    date,
    details: [
      p.company,
      p.phone && `Phone: ${p.phone}`,
      `Stage: ${STAGE_LABEL[p.stage]}`,
    ]
      .filter(Boolean)
      .join("\n"),
    location: p.address ?? undefined,
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="-my-0.5 shrink-0"
            aria-label="Add to calendar"
            title="Add to calendar"
          />
        }
      >
        <IconCalendarPlus />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem
          render={
            <a
              href={googleCalendarUrl(event)}
              target="_blank"
              rel="noreferrer"
            />
          }
        >
          <IconBrandGoogle /> Google Calendar
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => downloadIcs(event, `followup-${p.id}-${date}`)}
        >
          <IconDownload /> Apple, Outlook (.ics)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
                {isStage ? "Stage changed" : TOUCH_LABEL[a.type as Touch]}
                {a.outcome && ` · ${OUTCOME_LABEL[a.outcome]}`} ·{" "}
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
