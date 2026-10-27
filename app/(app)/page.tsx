"use client"

import Link from "next/link"
import {
  IconArrowRight,
  IconBolt,
  IconCalendarPlus,
  IconChecks,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { longDate } from "@/lib/format"
import { useMe, useToday } from "@/lib/queries"
import { GoalCard } from "@/components/goal-card"
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

  const { today, overdue, dueToday, noNextStep, upcoming, unrated } = data
  const actNow = overdue.length + dueToday.length
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

      {(unrated.length > 0 || noNextStep.length > 0) && (
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
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
      )}

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
        <>
          {overdue.length > 0 && (
            <PageSection
              title="Overdue"
              count={overdue.length}
              className="mt-8"
            >
              <ProspectList items={overdue} today={today} actions />
            </PageSection>
          )}
          {dueToday.length > 0 && (
            <PageSection
              title="Due today"
              count={dueToday.length}
              className="mt-8"
            >
              <ProspectList items={dueToday} today={today} actions />
            </PageSection>
          )}
        </>
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
