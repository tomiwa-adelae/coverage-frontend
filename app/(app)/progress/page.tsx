"use client"

import Link from "next/link"
import { niceDate, nairaShort } from "@/lib/format"
import { useProgress } from "@/lib/queries"
import { STAGE_LABEL } from "@/lib/types"
import { EmptyNote, PageHeader, PageSection } from "@/components/section"
import { Skeleton } from "@/components/ui/skeleton"

export default function ProgressPage() {
  const { data, isError } = useProgress()

  if (isError)
    return (
      <EmptyNote>Couldn&apos;t load progress. Refresh to try again.</EmptyNote>
    )
  if (!data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )

  const pct = data.target ? Math.min(100, (data.funded / data.target) * 100) : 0
  const maxWeek = Math.max(5, ...data.weeks.map((w) => w.touches))
  const maxStage = Math.max(1, ...data.byStage.map((s) => s.count))

  return (
    <>
      <PageHeader
        title="Progress"
        description="How your pipeline is moving against your target."
      />
      <PageSection title="Against target">
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <p className="text-3xl font-semibold tracking-tight tabular-nums">
            {nairaShort(data.funded)}
            <span className="ml-2 text-base font-medium text-muted-foreground">
              of {nairaShort(data.target)}
            </span>
          </p>
          <div
            className="mt-3 h-3 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progress to target"
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {pct.toFixed(1)}% from funded balances you&apos;ve entered, since{" "}
            {niceDate(data.targetStartDate)}. Confirm with your line manager how
            the bank measures this (average balance or new money).{" "}
            <Link href="/settings" className="underline underline-offset-2">
              Change target
            </Link>
          </p>
        </div>
      </PageSection>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Contacts this week" value={data.touchesThisWeek} />
        <Stat label="Accounts opened" value={data.accountsOpened} />
        <Stat label="Forms out" value={data.formsOut} />
        <Stat label="Open potential" value={nairaShort(data.openPotential)} />
      </div>

      <PageSection
        title="Contacts logged per week"
        hint="Weeks start Monday. Each call, visit or message counts once."
      >
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex h-32 items-end gap-2">
            {data.weeks.map((w, i) => (
              <div
                key={w.weekStart}
                className="flex h-full flex-1 flex-col items-center justify-end gap-1"
              >
                <span className="text-xs tabular-nums">{w.touches}</span>
                <div
                  className={
                    i === data.weeks.length - 1
                      ? "w-full rounded-t bg-primary"
                      : "w-full rounded-t bg-primary/45"
                  }
                  style={{
                    height: `${Math.max(2, (w.touches / maxWeek) * 88)}px`,
                  }}
                />
                <span className="text-[10px] whitespace-nowrap text-muted-foreground">
                  {niceDate(w.weekStart).split(" ").slice(1).join(" ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </PageSection>

      <PageSection title="Pipeline by stage">
        <div className="space-y-2 rounded-xl border bg-card p-4 shadow-xs">
          {data.byStage.map((s) => (
            <div
              key={s.stage}
              className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3 text-sm"
            >
              <span className="truncate">{STAGE_LABEL[s.stage]}</span>
              <div className="h-2.5 overflow-hidden rounded bg-muted">
                <div
                  className="h-full rounded bg-foreground/60"
                  style={{ width: `${(s.count / maxStage) * 100}%` }}
                />
              </div>
              <span className="text-right tabular-nums">{s.count}</span>
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection
        title="Potential by tier"
        hint="Excludes declined prospects."
      >
        <div className="divide-y rounded-xl border bg-card shadow-xs">
          {data.byTier.map((t) => (
            <div
              key={t.tier ?? "none"}
              className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
            >
              <span className="font-medium">
                {t.tier ? `Tier ${t.tier}` : "Not rated"}
              </span>
              <span className="text-muted-foreground">{t.count} prospects</span>
              <span className="w-20 text-right font-semibold tabular-nums">
                {nairaShort(t.potential)}
              </span>
            </div>
          ))}
        </div>
      </PageSection>
    </>
  )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-3 shadow-xs">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}
