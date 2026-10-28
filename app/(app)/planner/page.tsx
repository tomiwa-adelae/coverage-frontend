"use client"

import { useMemo, useSyncExternalStore } from "react"
import { cn } from "@/lib/utils"
import { monthName, naira, nairaShort } from "@/lib/format"
import { useProspects, useTarget } from "@/lib/queries"
import { STAGE_LABEL, type Prospect } from "@/lib/types"
import { EmptyNote, PageHeader, PageSection } from "@/components/section"
import { MoneyInput } from "@/components/inputs"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"
import { useOpenProspect } from "@/components/prospect-sheet"

/** Per prospect: the month it's expected to fund and how much. */
type Plan = Record<string, { month: string; amount: number | null }>

// A planning scratchpad, so it stays on this device.
const KEY = "coverage.balance-plan"
const listeners = new Set<() => void>()
const readPlan = () => {
  try {
    return localStorage.getItem(KEY) ?? "{}"
  } catch {
    return "{}"
  }
}
function writePlan(plan: Plan) {
  try {
    localStorage.setItem(KEY, JSON.stringify(plan))
  } catch {}
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

function usePlan() {
  const raw = useSyncExternalStore(subscribe, readPlan, () => "{}")
  return useMemo(() => {
    try {
      return JSON.parse(raw) as Plan
    } catch {
      return {}
    }
  }, [raw])
}

/**
 * Share of the period average that money landing in month `i` of `n` counts
 * for. The landing month counts half, as money arrives part-way through it.
 */
const weight = (i: number, n: number) => (n - i - 0.5) / n

export default function PlannerPage() {
  const { data: t } = useTarget()
  const { data: prospects } = useProspects({})
  const plan = usePlan()
  const open = useOpenProspect()

  const candidates = useMemo(
    () =>
      (prospects ?? [])
        .filter((p) => p.stage !== "FUNDED" && p.stage !== "DECLINED")
        .sort(
          (a, b) =>
            (b.potential ?? 0) - (a.potential ?? 0) ||
            a.name.localeCompare(b.name)
        ),
    [prospects]
  )

  if (!t || !prospects)
    return (
      <>
        <PageHeader title="Balance planner" />
        <Skeleton className="h-40 w-full" />
      </>
    )

  const months = t.series.map((s) => s.month)
  const n = months.length
  const ahead = months.filter((m) => m >= t.currentMonth)
  const amountOf = (p: Prospect) => plan[p.id]?.amount ?? p.potential ?? 0
  const planned = candidates.filter((p) =>
    ahead.includes(plan[p.id]?.month ?? "")
  )

  // Month totals with the planned money added from the month it lands.
  const totals = t.series.map((s, i) => {
    let total = s.total
    for (const p of planned) {
      const at = months.indexOf(plan[p.id].month)
      if (i > at) total += amountOf(p)
      else if (i === at) total += amountOf(p) / 2
    }
    return total
  })
  const average = totals.reduce((a, x) => a + x, 0) / n
  const end =
    t.series.at(-1)!.total + planned.reduce((a, p) => a + amountOf(p), 0)
  const gap = Math.max(0, t.target - average)
  const next = ahead[0] === t.currentMonth ? ahead[1] : ahead[0]

  function set(p: Prospect, patch: Partial<Plan[string]>) {
    const cur = plan[p.id] ?? { month: "", amount: null }
    const nextPlan = { ...plan, [p.id]: { ...cur, ...patch } }
    // Forget prospects that are no longer open.
    for (const id of Object.keys(nextPlan))
      if (!candidates.some((x) => x.id === id)) delete nextPlan[id]
    writePlan(nextPlan)
  }

  return (
    <>
      <PageHeader
        title="Balance planner"
        description="Pick when each open prospect is likely to fund and see where your average balance lands. Money that comes in earlier counts for more months."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Stat
          label={`Average balance, ${monthName(t.startMonth)} – ${monthName(t.endMonth)}`}
          value={average}
          target={t.target}
        />
        <Stat
          label={`Balance at the end of ${monthName(t.endMonth)}`}
          value={end}
          target={t.target}
        />
      </div>

      {gap > 0 && ahead.length > 0 && (
        <p className="mt-3 rounded-lg bg-muted/60 p-3 text-sm">
          To reach a {nairaShort(t.target)} average you still need about{" "}
          <span className="font-medium">
            {nairaShort(gap / weight(months.indexOf(ahead[0]), n))}
          </span>{" "}
          more landing in {monthName(ahead[0])}
          {next && (
            <>
              , or{" "}
              <span className="font-medium">
                {nairaShort(gap / weight(months.indexOf(next), n))}
              </span>{" "}
              if it lands in {monthName(next)}
            </>
          )}
          .
        </p>
      )}

      <PageSection
        title="Open prospects"
        hint="Amounts start at each prospect's potential. Your plan is kept on this device only."
      >
        {candidates.length === 0 ? (
          <EmptyNote>No open prospects to plan yet.</EmptyNote>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {candidates.map((p) => {
              const month = plan[p.id]?.month ?? ""
              const at = months.indexOf(month)
              const adds =
                ahead.includes(month) && at >= 0
                  ? amountOf(p) * weight(at, n)
                  : 0
              return (
                <li
                  key={p.id}
                  className="grid gap-2 p-3 sm:grid-cols-[1fr_10rem_9rem] sm:items-center"
                >
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => open(p.id)}
                      className="truncate text-left font-medium hover:underline"
                    >
                      {p.name}
                    </button>
                    <p className="text-xs text-muted-foreground">
                      {STAGE_LABEL[p.stage]}
                      {p.tier ? ` · Tier ${p.tier}` : ""}
                      {adds > 0 && (
                        <span className="text-emerald-700 dark:text-emerald-400">
                          {" "}
                          · adds {nairaShort(adds)} to your average
                        </span>
                      )}
                    </p>
                  </div>
                  <MoneyInput
                    aria-label={`Amount for ${p.name}`}
                    value={plan[p.id]?.amount ?? p.potential}
                    onChange={(v) => set(p, { amount: v })}
                  />
                  <NativeSelect
                    aria-label={`When ${p.name} funds`}
                    value={ahead.includes(month) ? month : ""}
                    onChange={(e) => set(p, { month: e.target.value })}
                    className="w-full"
                  >
                    <NativeSelectOption value="">
                      Not planned
                    </NativeSelectOption>
                    {ahead.map((m) => (
                      <NativeSelectOption key={m} value={m}>
                        {monthName(m)}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </li>
              )
            })}
          </ul>
        )}
      </PageSection>
    </>
  )
}

function Stat({
  label,
  value,
  target,
}: {
  label: string
  value: number
  target: number
}) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0
  const short = target - value
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {nairaShort(value)}
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full",
            short <= 0 ? "bg-emerald-600" : "bg-primary"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {short <= 0
          ? `On target (${naira(target)})`
          : `${nairaShort(short)} short of ${nairaShort(target)}`}
      </p>
    </div>
  )
}
