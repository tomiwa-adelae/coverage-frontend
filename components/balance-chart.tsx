"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { monthName, naira, nairaShort } from "@/lib/format"
import type { TargetData } from "@/lib/types"

const H = 160

/** Next month after "YYYY-MM". */
const nextMonth = (ym: string) => {
  const [y, m] = ym.split("-").map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`
}

/**
 * Portfolio balance by month (solid), then where today's pace lands each month
 * to the deadline (outlined), against the target line.
 */
export function BalanceChart({ data }: { data: TargetData }) {
  const [hover, setHover] = useState<number | null>(null)

  const bars: { month: string; value: number; projected: boolean }[] =
    // The API carries balances forward through future months; show actuals only.
    data.series
      .filter((s) => s.month <= data.currentMonth)
      .map((s) => ({ month: s.month, value: s.total, projected: false }))
  let m = data.currentMonth
  for (let i = 1; i <= data.monthsLeft; i++) {
    m = nextMonth(m)
    bars.push({
      month: m,
      value: Math.max(0, Math.round(data.current + data.perMonth * i)),
      projected: true,
    })
  }

  const max = Math.max(data.target, ...bars.map((b) => b.value), 1) * 1.08
  const y = (v: number) => (v / max) * H
  const targetY = H - y(data.target)
  const active = hover !== null ? bars[hover] : null

  return (
    <div className="relative">
      <div className="relative" style={{ height: H }}>
        {/* Target line, labelled at the right in text ink. */}
        <div
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-foreground/40"
          style={{ top: targetY }}
        >
          <span className="absolute -top-5 right-0 bg-card pl-1 text-[11px] font-medium text-muted-foreground">
            Target {nairaShort(data.target)}
          </span>
        </div>
        <div className="flex h-full items-end gap-1">
          {bars.map((b, i) => (
            <button
              key={b.month}
              type="button"
              aria-label={`${monthName(b.month)}: ${naira(b.value)}${b.projected ? " projected" : ""}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="group flex h-full flex-1 items-end focus-visible:outline-none"
            >
              <span
                className={cn(
                  "block w-full rounded-t transition-opacity",
                  b.projected
                    ? "border-2 border-b-0 border-dashed border-primary/60 bg-primary/10"
                    : "bg-primary",
                  hover !== null && hover !== i && "opacity-50",
                  "group-focus-visible:ring-2 group-focus-visible:ring-ring"
                )}
                style={{ height: Math.max(2, y(b.value)) }}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex gap-1 border-t pt-1.5">
        {bars.map((b, i) => (
          <span
            key={b.month}
            className={cn(
              "flex-1 truncate text-center text-[10px] text-muted-foreground",
              // Thin the labels when there are many months.
              bars.length > 8 && i % 2 === 1 && "invisible"
            )}
          >
            {monthName(b.month).split(" ")[0]}
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-primary" /> Actual balance
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm border border-dashed border-primary/60 bg-primary/10" />
          At today&apos;s pace
        </span>
      </div>
      {active && (
        <div
          role="status"
          className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md"
        >
          <p className="text-muted-foreground">
            {monthName(active.month, true)}
            {active.projected && " (projected)"}
          </p>
          <p className="font-semibold tabular-nums">{naira(active.value)}</p>
        </div>
      )}
    </div>
  )
}
