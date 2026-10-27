"use client"

import Link from "next/link"
import {
  IconArrowRight,
  IconTrendingDown,
  IconTrendingUp,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { monthName, naira, nairaShort, niceDate } from "@/lib/format"
import { useProgress } from "@/lib/queries"
import {
  PRODUCT_LABEL,
  SOURCE_LABEL,
  STAGE_LABEL,
  type ProgressData,
} from "@/lib/types"
import { EmptyNote, PageHeader, PageSection } from "@/components/section"
import { BalanceChart } from "@/components/balance-chart"
import { Button } from "@/components/ui/button"
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

  const t = data.targetStatus
  const pct = t.target ? Math.min(100, (t.current / t.target) * 100) : 0
  const maxWeek = Math.max(5, ...data.weeks.map((w) => w.touches))
  const maxStage = Math.max(1, ...data.byStage.map((s) => s.count))
  const Trend = t.onPace ? IconTrendingUp : IconTrendingDown

  return (
    <>
      <PageHeader
        title="Progress"
        description="How your balances and pipeline are moving against your target."
      />
      <PageSection title="Against target">
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-3xl font-semibold tracking-tight tabular-nums">
              {naira(t.current)}
              <span className="ml-2 text-base font-medium text-muted-foreground">
                of {naira(t.target)}
              </span>
            </p>
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href="/balances" />}
            >
              Update balances <IconArrowRight data-icon="inline-end" />
            </Button>
          </div>
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
          <p
            className={cn(
              "mt-3 flex items-start gap-1.5 text-sm font-medium",
              t.onPace ? "text-success" : "text-destructive"
            )}
          >
            <Trend className="mt-0.5 size-4 shrink-0" />
            {t.onPace
              ? `On pace: about ${naira(t.projected)} by ${monthName(t.endMonth, true)}.`
              : `Behind pace: about ${naira(t.projected)} by ${monthName(t.endMonth, true)}, ${naira(t.target - t.projected)} short.`}
          </p>
          {!t.onPace && t.monthsLeft > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              To finish on target, add about {naira(t.neededPerMonth)} a month
              for the next {t.monthsLeft} month{t.monthsLeft === 1 ? "" : "s"}.
            </p>
          )}
          <div className="mt-5">
            <BalanceChart data={t} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            From the month-end balances you record, {monthName(t.startMonth)} to{" "}
            {monthName(t.endMonth)}. Confirm with your line manager how the bank
            measures this (average balance or new money).{" "}
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
        <Stat
          label="Days to open, on average"
          value={data.avgDaysToOpen ?? "—"}
        />
      </div>

      <Forecast data={data} />

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

      <Sources data={data} />
      <Reasons data={data} />
      <Products data={data} />

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
              <span className="w-24 text-right font-semibold tabular-nums">
                {naira(t.potential)}
              </span>
            </div>
          ))}
        </div>
      </PageSection>
    </>
  )
}

/** Open pipeline weighted by how likely each stage is to fund. */
function Forecast({ data }: { data: ProgressData }) {
  const f = data.targetStatus.forecast
  const gap = data.targetStatus.gap
  const missing = f.byStage.reduce((a, s) => a + s.missingPotential, 0)
  return (
    <PageSection
      title="Pipeline forecast"
      hint="Each prospect's deposit potential times the usual chance of funding from their stage."
    >
      <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
          <Figure label="Likely from pipeline" value={naira(f.weighted)} />
          <Figure label="Balance + likely" value={naira(f.expected)} />
          <Figure
            label={gap ? "Covers of the gap" : "Gap to target"}
            value={gap ? `${Math.round(f.coverage * 100)}%` : "Closed"}
            tone={gap && f.coverage < 1 ? "danger" : "good"}
            className="col-span-2 sm:col-span-1"
          />
        </div>
        <table className="w-full text-sm">
          <caption className="sr-only">Forecast by stage</caption>
          <thead className="border-y bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Stage</th>
              <th className="px-2 py-2 text-right font-medium">Chance</th>
              <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">
                Potential
              </th>
              <th className="px-4 py-2 text-right font-medium">Likely</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {f.byStage.map((s) => (
              <tr key={s.stage}>
                <td className="px-4 py-2">
                  {STAGE_LABEL[s.stage]}{" "}
                  <span className="text-xs text-muted-foreground">
                    ({s.count})
                  </span>
                </td>
                <td className="px-2 py-2 text-right text-muted-foreground tabular-nums">
                  {Math.round(s.probability * 100)}%
                </td>
                <td className="hidden px-2 py-2 text-right tabular-nums sm:table-cell">
                  {nairaShort(s.potential)}
                </td>
                <td className="px-4 py-2 text-right font-medium tabular-nums">
                  {nairaShort(s.weighted)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {missing > 0 && (
        <p className="mt-2 text-sm text-muted-foreground">
          {missing} open prospect{missing === 1 ? " has" : "s have"} no deposit
          potential, so they don&apos;t count yet.{" "}
          <Link href="/prospects" className="underline underline-offset-2">
            Add estimates
          </Link>
        </p>
      )}
    </PageSection>
  )
}

function Sources({ data }: { data: ProgressData }) {
  if (!data.bySource.some((s) => s.source)) return null
  return (
    <PageSection
      title="Where your customers come from"
      hint="Win rate counts accounts opened against declines."
    >
      <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Source</th>
              <th className="px-2 py-2 text-right font-medium">Prospects</th>
              <th className="px-2 py-2 text-right font-medium">Win rate</th>
              <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">
                Balance
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.bySource.map((s) => (
              <tr key={s.source ?? "none"}>
                <td className="px-4 py-2">
                  {s.source ? SOURCE_LABEL[s.source] : "Not recorded"}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{s.count}</td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {s.winRate === null ? "—" : `${Math.round(s.winRate * 100)}%`}
                </td>
                <td className="hidden px-4 py-2 text-right tabular-nums sm:table-cell">
                  {nairaShort(s.balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageSection>
  )
}

function Reasons({ data }: { data: ProgressData }) {
  if (!data.lostReasons.length && !data.wonReasons.length) return null
  return (
    <div className="mt-7 grid gap-3 sm:grid-cols-2">
      <ReasonList title="Why they said yes" items={data.wonReasons} />
      <ReasonList title="Why they said no" items={data.lostReasons} />
    </div>
  )
}

function ReasonList({
  title,
  items,
}: {
  title: string
  items: { reason: string; count: number }[]
}) {
  const max = Math.max(1, ...items.map((i) => i.count))
  return (
    <section className="rounded-xl border bg-card p-4 shadow-xs">
      <h2 className="text-sm font-semibold">{title}</h2>
      {items.length ? (
        <ul className="mt-3 space-y-2">
          {items.map((r) => (
            <li key={r.reason} className="text-sm">
              <div className="flex justify-between gap-2">
                <span className="truncate">{r.reason}</span>
                <span className="text-muted-foreground tabular-nums">
                  {r.count}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-foreground/50"
                  style={{ width: `${(r.count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Nothing recorded yet. You&apos;re asked when a prospect opens or
          declines.
        </p>
      )}
    </section>
  )
}

function Products({ data }: { data: ProgressData }) {
  const rows = data.products.filter((p) => p.wanted || p.held)
  if (!rows.length) return null
  return (
    <PageSection
      title="Products"
      hint="Interested but not yet held is your cross-sell list."
    >
      <div className="divide-y rounded-xl border bg-card shadow-xs">
        {rows.map((p) => (
          <div
            key={p.product}
            className="flex items-center gap-3 px-4 py-2.5 text-sm"
          >
            <span className="min-w-0 flex-1 truncate font-medium">
              {PRODUCT_LABEL[p.product]}
            </span>
            <span className="text-muted-foreground tabular-nums">
              {p.wanted} interested
            </span>
            <span className="w-16 text-right text-muted-foreground tabular-nums">
              {p.held} hold
            </span>
          </div>
        ))}
      </div>
    </PageSection>
  )
}

function Figure({
  label,
  value,
  tone,
  className,
}: {
  label: string
  value: React.ReactNode
  tone?: "good" | "danger"
  className?: string
}) {
  return (
    <div className={cn("bg-card p-4", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-lg font-semibold tabular-nums",
          tone === "good" && "text-success",
          tone === "danger" && "text-destructive"
        )}
      >
        {value}
      </p>
    </div>
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
