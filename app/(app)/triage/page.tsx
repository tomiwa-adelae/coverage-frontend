"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import {
  IconArrowBackUp,
  IconArrowRight,
  IconCircleCheck,
  IconPlayerSkipForward,
  IconX,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { addDays, nairaShort, niceDate } from "@/lib/format"
import { usePatchProspect, useToday } from "@/lib/queries"
import { TIERS, TIER_HINT, type Prospect, type Tier } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { Skeleton } from "@/components/ui/skeleton"
import { ProspectAvatar, TierPill } from "@/components/prospect-avatar"

type Mode = "rate" | "plan"

export default function TriagePage() {
  const params = useSearchParams()
  const mode: Mode = params.get("mode") === "plan" ? "plan" : "rate"
  const { data } = useToday()

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Rate &amp; plan
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "rate"
              ? "Give each prospect a tier so Coverage can rank who to call first."
              : "Give each rated prospect a next action and a date."}
          </p>
        </div>
        <div className="flex rounded-lg bg-muted p-1 text-sm font-medium">
          <ModeLink
            href="/triage"
            active={mode === "rate"}
            count={data?.unrated.length}
          >
            Rate
          </ModeLink>
          <ModeLink
            href="/triage?mode=plan"
            active={mode === "plan"}
            count={data?.noNextStep.length}
          >
            Plan
          </ModeLink>
        </div>
      </header>

      <div className="mt-6">
        {!data ? (
          <Skeleton className="mx-auto h-96 w-full max-w-xl rounded-2xl" />
        ) : (
          // Snapshot the queue once per mode so refetches don't reshuffle it mid-session.
          <Session
            key={mode}
            mode={mode}
            initial={mode === "rate" ? data.unrated : data.noNextStep}
            today={data.today}
          />
        )}
      </div>
    </div>
  )
}

function ModeLink({
  href,
  active,
  count,
  children,
}: {
  href: string
  active: boolean
  count?: number
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-muted-foreground transition-colors",
        active && "bg-background text-foreground shadow-sm"
      )}
    >
      {children}
      {count !== undefined && (
        <span className="text-xs tabular-nums opacity-70">{count}</span>
      )}
    </Link>
  )
}

interface Step {
  prospect: Prospect
  /** The fields as they were before this step, for undo. */
  before: Partial<Prospect> | null
  label: string
}

const PLAN_DATES: [string, number][] = [
  ["Tomorrow", 1],
  ["3 days", 3],
  ["1 week", 7],
  ["2 weeks", 14],
  ["1 month", 30],
]

function Session({
  mode,
  initial,
  today,
}: {
  mode: Mode
  initial: Prospect[]
  today: string
}) {
  const [queue] = useState(initial)
  const [index, setIndex] = useState(0)
  const [history, setHistory] = useState<Step[]>([])
  const [action, setAction] = useState(initial[0]?.nextAction ?? "")
  const patch = usePatchProspect()

  const current = queue[index] as Prospect | undefined

  const advance = useCallback(
    (step: Step) => {
      setHistory((h) => [...h, step])
      setIndex((i) => i + 1)
      setAction(queue[index + 1]?.nextAction ?? "")
    },
    [queue, index]
  )

  const rate = useCallback(
    (tier: Tier) => {
      if (!current) return
      patch.mutate({ id: current.id, tier })
      advance({
        prospect: current,
        before: { tier: current.tier },
        label: `Tier ${tier}`,
      })
    },
    [current, patch, advance]
  )

  const decline = useCallback(() => {
    if (!current) return
    patch.mutate({ id: current.id, stage: "DECLINED" })
    advance({
      prospect: current,
      before: { stage: current.stage },
      label: "Declined",
    })
  }, [current, patch, advance])

  const plan = useCallback(
    (days: number) => {
      if (!current) return
      const nextDate = addDays(today, days)
      patch.mutate({
        id: current.id,
        nextDate,
        nextAction: action.trim() || null,
      })
      advance({
        prospect: current,
        before: { nextDate: current.nextDate, nextAction: current.nextAction },
        label: niceDate(nextDate),
      })
    },
    [current, patch, advance, today, action]
  )

  const skip = useCallback(() => {
    if (!current) return
    advance({ prospect: current, before: null, label: "Skipped" })
  }, [current, advance])

  const undo = useCallback(() => {
    const last = history.at(-1)
    if (!last) return
    if (last.before) patch.mutate({ id: last.prospect.id, ...last.before })
    setHistory((h) => h.slice(0, -1))
    setIndex((i) => i - 1)
    setAction(last.prospect.nextAction ?? "")
  }, [history, patch])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const typing =
        e.target instanceof HTMLElement &&
        e.target.matches("input, textarea, select")
      if (typing) return
      const k = e.key.toLowerCase()
      if (k === "u") return undo()
      if (k === "s") return skip()
      if (mode === "rate") {
        if (k === "1") return rate("A")
        if (k === "2") return rate("B")
        if (k === "3") return rate("C")
        if (k === "d") return decline()
      } else {
        const n = Number(k)
        if (n >= 1 && n <= PLAN_DATES.length) return plan(PLAN_DATES[n - 1][1])
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [mode, rate, decline, plan, skip, undo])

  if (!queue.length)
    return (
      <Finished
        title={
          mode === "rate"
            ? "Everyone is rated"
            : "Every rated prospect has a next step"
        }
        body={
          mode === "rate"
            ? "Nice. Now give the rated ones a next step."
            : "Your pipeline is fully planned."
        }
        next={
          mode === "rate"
            ? { href: "/triage?mode=plan", label: "Plan next steps" }
            : undefined
        }
      />
    )

  if (!current)
    return (
      <Finished
        title="Session complete"
        body={summary(history)}
        next={
          mode === "rate"
            ? { href: "/triage?mode=plan", label: "Plan next steps" }
            : { href: "/", label: "Back to Today" }
        }
        onUndo={undo}
      />
    )

  const pct = (index / queue.length) * 100

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="text-muted-foreground tabular-nums">
          {index + 1} of {queue.length}
        </span>
        {history.at(-1) && (
          <span className="truncate text-muted-foreground">
            {history.at(-1)!.prospect.name}: {history.at(-1)!.label}
          </span>
        )}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div
        key={current.id}
        className="mt-5 animate-in rounded-2xl border bg-card p-6 shadow-sm duration-200 fade-in slide-in-from-right-3 sm:p-8"
      >
        <div className="flex flex-col items-center text-center">
          <ProspectAvatar name={current.name} tier={current.tier} size="lg" />
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">
            {current.name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {[current.company, current.group].filter(Boolean).join(" · ") ||
              "No company or group"}
          </p>
          {mode === "plan" && (
            <div className="mt-3 flex items-center gap-2">
              <TierPill tier={current.tier} />
              {current.potential ? (
                <span className="text-xs text-muted-foreground tabular-nums">
                  Potential {nairaShort(current.potential)}
                </span>
              ) : null}
            </div>
          )}
          {current.notes && (
            <p className="mt-4 max-w-sm rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
              {current.notes}
            </p>
          )}
        </div>

        {mode === "rate" ? (
          <div className="mt-8 grid grid-cols-3 gap-2.5">
            {TIERS.map((t, i) => (
              <button
                key={t}
                type="button"
                onClick={() => rate(t)}
                className={cn(
                  "group flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-4 transition-all hover:-translate-y-0.5 active:translate-y-0",
                  t === "A" &&
                    "border-tier-a/40 hover:border-tier-a hover:bg-tier-a/10",
                  t === "B" &&
                    "border-tier-b/35 hover:border-tier-b hover:bg-tier-b/10",
                  t === "C" &&
                    "border-tier-c/35 hover:border-tier-c hover:bg-tier-c/10"
                )}
              >
                <span
                  className={cn(
                    "text-3xl font-bold",
                    t === "A" && "text-tier-a",
                    t === "B" && "text-tier-b",
                    t === "C" && "text-tier-c"
                  )}
                >
                  {t}
                </span>
                <span className="text-center text-[11px] leading-tight text-muted-foreground">
                  {TIER_HINT[t]}
                </span>
                <Kbd className="mt-1 hidden sm:inline-flex">{i + 1}</Kbd>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            <Input
              aria-label="Next action"
              placeholder="Next action, e.g. Call to introduce the bank"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && plan(7)}
            />
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {PLAN_DATES.map(([label, n], i) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => plan(n)}
                  className="flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-sm font-medium transition-colors hover:border-primary hover:bg-primary/5"
                >
                  {label}
                  <span className="text-[11px] font-normal text-muted-foreground">
                    {niceDate(addDays(today, n))}
                  </span>
                  <Kbd className="hidden sm:inline-flex">{i + 1}</Kbd>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center justify-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={undo}
            disabled={!history.length}
          >
            <IconArrowBackUp data-icon="inline-start" /> Undo
            <Kbd className="ml-1 hidden sm:inline-flex">U</Kbd>
          </Button>
          <Button variant="ghost" size="sm" onClick={skip}>
            <IconPlayerSkipForward data-icon="inline-start" /> Skip
            <Kbd className="ml-1 hidden sm:inline-flex">S</Kbd>
          </Button>
          {mode === "rate" && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={decline}
            >
              <IconX data-icon="inline-start" /> Decline
              <Kbd className="ml-1 hidden sm:inline-flex">D</Kbd>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function summary(history: Step[]) {
  const counts = new Map<string, number>()
  for (const s of history) counts.set(s.label, (counts.get(s.label) ?? 0) + 1)
  const parts = [...counts].map(([label, n]) => `${n} ${label.toLowerCase()}`)
  return parts.length
    ? `You went through ${history.length}: ${parts.join(", ")}.`
    : "Nothing changed."
}

function Finished({
  title,
  body,
  next,
  onUndo,
}: {
  title: string
  body: string
  next?: { href: string; label: string }
  onUndo?: () => void
}) {
  return (
    <div className="mx-auto max-w-md animate-in rounded-2xl border bg-card p-8 text-center shadow-sm zoom-in-95 fade-in">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
        <IconCircleCheck className="size-7" />
      </span>
      <h2 className="mt-4 text-xl font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      <div className="mt-6 flex justify-center gap-2">
        {onUndo && (
          <Button variant="outline" onClick={onUndo}>
            <IconArrowBackUp data-icon="inline-start" /> Undo last
          </Button>
        )}
        {next && (
          <Button nativeButton={false} render={<Link href={next.href} />}>
            {next.label} <IconArrowRight data-icon="inline-end" />
          </Button>
        )}
      </div>
    </div>
  )
}
