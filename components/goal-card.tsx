"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { IconFlame } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { useToday } from "@/lib/queries"
import type { GoalData } from "@/lib/types"

const DAY_LETTER = ["M", "T", "W", "T", "F", "S", "S"]

function Ring({ value, max }: { value: number; max: number }) {
  const r = 26
  const c = 2 * Math.PI * r
  const pct = Math.min(1, max ? value / max : 0)
  return (
    <div className="relative size-[68px] shrink-0">
      <svg viewBox="0 0 64 64" className="size-full -rotate-90" aria-hidden>
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="6"
          className="stroke-muted"
        />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="stroke-brand transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-center leading-none">
        <span>
          <span className="block text-lg font-semibold tabular-nums">
            {value}
          </span>
          <span className="block text-[10px] text-muted-foreground tabular-nums">
            of {max}
          </span>
        </span>
      </span>
    </div>
  )
}

export function GoalCard({
  goal,
  touchesToday,
  today,
  className,
}: {
  goal: GoalData
  touchesToday: number
  today: string
  className?: string
}) {
  const left = Math.max(0, goal.daily - touchesToday)
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-xl border bg-card p-3 shadow-xs sm:p-4",
        className
      )}
      role="group"
      aria-label={`Daily goal: ${touchesToday} of ${goal.daily} contacts`}
    >
      <Ring value={touchesToday} max={goal.daily} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">
            {left ? `${left} more to hit your goal` : "Goal hit today"}
          </p>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
              goal.streak
                ? "bg-brand/15 text-tier-a"
                : "bg-muted text-muted-foreground"
            )}
            title="Days in a row you hit your goal (weekends don't break it)"
          >
            <IconFlame className="size-3.5" />
            {goal.streak}
          </span>
        </div>
        <ol className="mt-2.5 flex gap-1.5" aria-label="This week">
          {goal.week.map((d, i) => {
            const met = d.touches >= goal.daily
            const isToday = d.date === today
            const future = d.date > today
            return (
              <li
                key={d.date}
                className="flex flex-1 flex-col items-center gap-1"
                title={`${d.touches} contact${d.touches === 1 ? "" : "s"}`}
              >
                <span
                  className={cn(
                    "h-1.5 w-full rounded-full",
                    met
                      ? "bg-brand"
                      : d.touches
                        ? "bg-brand/35"
                        : future
                          ? "bg-muted/60"
                          : "bg-muted"
                  )}
                />
                <span
                  className={cn(
                    "text-[10px] text-muted-foreground",
                    isToday && "font-bold text-foreground"
                  )}
                >
                  {DAY_LETTER[i]}
                </span>
              </li>
            )
          })}
        </ol>
        <Link
          href="/settings"
          className="mt-0.5 hidden text-[11px] text-muted-foreground hover:underline sm:inline-block"
        >
          Daily goal: {goal.daily} contacts
        </Link>
      </div>
    </div>
  )
}

/** Celebrates the moment today's count crosses the daily goal. */
export function GoalWatcher() {
  const { data } = useToday()
  const prev = useRef<number | null>(null)
  const count = data?.touchesToday
  const daily = data?.goal.daily
  const streak = data?.goal.streak

  useEffect(() => {
    if (count == null || daily == null) return
    if (prev.current != null && prev.current < daily && count >= daily) {
      toast.success("Daily goal hit!", {
        description: streak
          ? `${count} contacts today · ${streak}-day streak`
          : `${count} contacts today`,
        icon: <IconFlame className="size-4 text-tier-a" />,
      })
    }
    prev.current = count
  }, [count, daily, streak])

  return null
}
