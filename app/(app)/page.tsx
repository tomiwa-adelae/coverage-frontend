"use client"

import Link from "next/link"
import {
  IconArrowRight,
  IconBolt,
  IconBrandWhatsapp,
  IconCake,
  IconCalendarPlus,
  IconChecks,
  IconMicrophone,
  IconTrendingDown,
  IconTrendingUp,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { whatsappUrl } from "@/lib/contact"
import { clock, longDate, monthName, naira, nairaShort } from "@/lib/format"
import { STAGE_LABEL, type TodayData } from "@/lib/types"
import { useMe, useTasks, useToday } from "@/lib/queries"
import { GoalCard } from "@/components/goal-card"
import { QuickAddTask, TaskList } from "@/components/tasks"
import { ProspectList } from "@/components/prospect-list"
import { EmptyNote, PageSection } from "@/components/section"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { useOpenProspect } from "@/components/prospect-sheet"

const NO_STEP_LIMIT = 8

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
}

export default function TodayPage() {
  const { data, isError } = useToday()
  const { data: me } = useMe()

  if (isError)
    return (
      <EmptyNote>
        Couldn&apos;t load today&apos;s list. Check your connection and refresh.
      </EmptyNote>
    )
  if (!data) return <TodaySkeleton />

  const { today, overdue, focus, noNextStep, upcoming, unrated, stale } = data
  const actNow = focus.length
  const firstName = me?.name.split(" ")[0]

  return (
    <div className="animate-in duration-300 fade-in">
      <header>
        <p className="text-sm text-muted-foreground">{longDate(today)}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          {greeting()}
          {firstName ? `, ${firstName}` : ""}
        </h1>
      </header>

      <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        <GoalCard
          goal={data.goal}
          touchesToday={data.touchesToday}
          today={today}
          className="col-span-2"
        />
        <Stat
          label="To reach today"
          value={actNow}
          tone={actNow ? "primary" : undefined}
        />
        <Stat
          label="Overdue"
          value={overdue.length}
          tone={overdue.length ? "danger" : undefined}
        />
      </div>

      <PaceCard pace={data.pace} />

      {data.birthdays.length > 0 && <Birthdays people={data.birthdays} />}

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        <Prompt
          href="/debrief"
          icon={IconMicrophone}
          title="Debrief your day"
          body="Talk it through; Coverage updates each person for you."
        />
        {unrated.length > 0 && (
          <Prompt
            href="/triage"
            icon={IconBolt}
            title={`Rate ${unrated.length} prospect${unrated.length === 1 ? "" : "s"}`}
            body="One tap each. Takes a few minutes."
          />
        )}
        {noNextStep.length > 0 && (
          <Prompt
            href="/triage?mode=plan"
            icon={IconCalendarPlus}
            title={`Plan ${noNextStep.length} next step${noNextStep.length === 1 ? "" : "s"}`}
            body="Rated prospects with nothing scheduled."
          />
        )}
      </div>

      {data.appointments.length > 0 && (
        <PageSection
          title="Booked today"
          count={data.appointments.length}
          hint="You’ll get a reminder before each one."
          className="mt-8"
        >
          <ProspectList
            items={data.appointments}
            today={today}
            actions
            subtitle={(p) =>
              `${p.nextTime ? clock(p.nextTime) : ""}${p.nextAction ? ` · ${p.nextAction}` : ""}`
            }
          />
        </PageSection>
      )}

      <TodayTasks today={today} />

      {actNow === 0 ? (
        <Empty className="mt-8 rounded-xl border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-primary/10 text-primary">
              <IconChecks />
            </EmptyMedia>
            <EmptyTitle>You&apos;re all caught up</EmptyTitle>
            <EmptyDescription>
              Nothing due today. Use the time to plan next steps or add new
              businesses to your pipeline.
            </EmptyDescription>
          </EmptyHeader>
          {noNextStep.length > 0 && (
            <EmptyContent>
              <Button
                nativeButton={false}
                render={<Link href="/triage?mode=plan" />}
              >
                Plan next steps <IconArrowRight data-icon="inline-end" />
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <PageSection
          title="Today’s calls"
          count={focus.length}
          hint="Most valuable first: deposit potential, stage and how late."
          className="mt-8"
        >
          <ProspectList items={focus} today={today} actions />
        </PageSection>
      )}

      {stale.length > 0 && (
        <PageSection
          title="Going cold"
          count={data.staleCount}
          hint="Stuck in the same stage longer than usual. A nudge now keeps them warm."
          className="mt-8"
        >
          <ProspectList
            items={stale}
            today={today}
            actions
            subtitle={(p) =>
              `${p.daysInStage} days in ${STAGE_LABEL[p.stage]}${p.nextAction ? ` · ${p.nextAction}` : ""}`
            }
          />
        </PageSection>
      )}

      <PageSection
        title="Coming up this week"
        count={upcoming.length}
        className="mt-8"
      >
        {upcoming.length ? (
          <ProspectList items={upcoming} today={today} actions />
        ) : (
          <EmptyNote>Nothing booked for the next 7 days.</EmptyNote>
        )}
      </PageSection>

      {noNextStep.length > 0 && (
        <PageSection
          title="No next step"
          count={noNextStep.length}
          hint="Highest tier and potential first."
          className="mt-8"
        >
          <ProspectList
            items={noNextStep.slice(0, NO_STEP_LIMIT)}
            today={today}
            actions
          />
          {noNextStep.length > NO_STEP_LIMIT && (
            <Link
              href="/triage?mode=plan"
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Plan all {noNextStep.length} <IconArrowRight className="size-4" />
            </Link>
          )}
        </PageSection>
      )}
    </div>
  )
}

/** Balance against target, and where the current pace lands by the deadline. */
/** Late and due-today to-dos, next to the day's calls, with a quick add. */
function TodayTasks({ today }: { today: string }) {
  const { data } = useTasks("open")
  if (!data) return null
  const due = data.filter((t) => t.dueDate && t.dueDate <= today)
  const later = data.length - due.length
  return (
    <PageSection title="To do" count={due.length || undefined} className="mt-8">
      <QuickAddTask />
      {due.length > 0 && (
        <TaskList tasks={due} today={today} className="mt-3" />
      )}
      <Link
        href="/tasks"
        className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        {later
          ? `${later} more to-do${later === 1 ? "" : "s"} for later`
          : "All to-dos"}{" "}
        <IconArrowRight className="size-4" />
      </Link>
    </PageSection>
  )
}

function PaceCard({ pace }: { pace: TodayData["pace"] }) {
  const pct = pace.target
    ? Math.min(100, (pace.current / pace.target) * 100)
    : 0
  const projectedPct = pace.target
    ? Math.min(100, (pace.projected / pace.target) * 100)
    : 0
  const Trend = pace.onPace ? IconTrendingUp : IconTrendingDown
  return (
    <Link
      href="/progress"
      className="group mt-2.5 block rounded-xl border bg-card p-4 shadow-xs transition-colors hover:bg-muted/40 sm:mt-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm">
          <span className="text-lg font-semibold tabular-nums">
            {nairaShort(pace.current)}
          </span>{" "}
          <span className="text-muted-foreground">
            of {nairaShort(pace.target)} target
          </span>
        </p>
        <p
          className={cn(
            "inline-flex items-center gap-1 text-xs font-medium",
            pace.onPace ? "text-success" : "text-destructive"
          )}
        >
          <Trend className="size-4" />
          {pace.onPace ? "On pace" : "Behind pace"}: {naira(pace.projected)} by{" "}
          {monthName(pace.endMonth)}
        </p>
      </div>
      <div
        className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Balance against target"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary/25"
          style={{ width: `${projectedPct}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Light bar shows where you&apos;ll be at today&apos;s pace.{" "}
        <span className="font-medium text-primary group-hover:underline">
          See progress
        </span>
      </p>
    </Link>
  )
}

function Birthdays({ people }: { people: TodayData["birthdays"] }) {
  const open = useOpenProspect()
  return (
    <div className="mt-4 rounded-xl border border-warning/40 bg-warning/10 p-3.5">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <IconCake className="size-4" /> Birthdays this week
      </p>
      <ul className="mt-2 space-y-1.5">
        {people.map((p) => (
          <li key={p.id} className="flex items-center gap-2 text-sm">
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left hover:underline"
              onClick={() => open(p.id)}
            >
              <span className="font-medium">{p.name}</span>{" "}
              <span className="text-muted-foreground">
                {p.inDays === 0
                  ? "today 🎉"
                  : p.inDays === 1
                    ? "tomorrow"
                    : `in ${p.inDays} days`}
              </span>
            </button>
            {p.phone && (
              <Button
                size="xs"
                variant="outline"
                nativeButton={false}
                render={
                  <a
                    href={`${whatsappUrl(p.phone)}?text=${encodeURIComponent(
                      `Happy birthday ${p.name.split(" ")[0]}! Wishing you a wonderful year ahead.`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                <IconBrandWhatsapp data-icon="inline-start" /> Wish
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: "primary" | "danger"
}) {
  return (
    <div className="flex flex-col justify-between rounded-xl border bg-card p-3 shadow-xs sm:p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums sm:text-3xl",
          tone === "primary" && "text-primary",
          tone === "danger" && "text-destructive"
        )}
      >
        {value}
      </p>
    </div>
  )
}

function Prompt({
  href,
  icon: Icon,
  title,
  body,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  body: string
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border bg-secondary/60 p-3.5 transition-colors hover:bg-secondary"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-secondary-foreground">
          {title}
        </span>
        <span className="block text-xs text-muted-foreground">{body}</span>
      </span>
      <IconArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}

function TodaySkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Skeleton className="col-span-2 h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  )
}
