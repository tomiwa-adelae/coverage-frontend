"use client"

import { useState } from "react"
import Link from "next/link"
import {
  IconChevronLeft,
  IconChevronRight,
  IconCopy,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { localToday, monthName, naira } from "@/lib/format"
import { useBalanceSheet, useSaveBalanceSheet } from "@/lib/queries"
import type { BalanceSheet } from "@/lib/types"
import { EmptyNote, PageHeader } from "@/components/section"
import { MoneyInput } from "@/components/inputs"
import { ProspectAvatar } from "@/components/prospect-avatar"
import { useOpenProspect } from "@/components/prospect-sheet"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

const shift = (ym: string, by: number) => {
  const [y, m] = ym.split("-").map(Number)
  const d = new Date(y, m - 1 + by, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export default function BalancesPage() {
  const current = localToday().slice(0, 7)
  const [month, setMonth] = useState(current)
  const { data, isError, dataUpdatedAt } = useBalanceSheet(month)

  return (
    <>
      <PageHeader
        title="Balances"
        description="Record each customer's month-end balance from your core banking report. The latest month counts toward your target."
      />
      <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border bg-card p-2 shadow-xs">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Previous month"
          onClick={() => setMonth(shift(month, -1))}
        >
          <IconChevronLeft />
        </Button>
        <p className="font-semibold">{monthName(month, true)}</p>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Next month"
          disabled={month >= current}
          onClick={() => setMonth(shift(month, 1))}
        >
          <IconChevronRight />
        </Button>
      </div>

      {isError ? (
        <EmptyNote>
          Couldn&apos;t load balances. Refresh to try again.
        </EmptyNote>
      ) : !data || data.month !== month ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : data.rows.length === 0 ? (
        <EmptyNote>
          No customers yet. Prospects show up here once you mark them Account
          opened or Funded.{" "}
          <Link href="/pipeline" className="underline">
            Open the pipeline
          </Link>
        </EmptyNote>
      ) : (
        // Remount after each save so "changed" compares against saved values.
        <Sheet key={`${data.month}-${dataUpdatedAt}`} sheet={data} />
      )}
    </>
  )
}

function Sheet({ sheet }: { sheet: BalanceSheet }) {
  const open = useOpenProspect()
  const save = useSaveBalanceSheet()
  const initial = Object.fromEntries(sheet.rows.map((r) => [r.id, r.amount]))
  const [values, setValues] = useState<Record<string, number | null>>(initial)

  const changed = sheet.rows.filter((r) => values[r.id] !== initial[r.id])
  const total = sheet.rows.reduce(
    (a, r) => a + (values[r.id] ?? r.previous?.amount ?? 0),
    0
  )
  const blanksWithHistory = sheet.rows.filter(
    (r) => values[r.id] === null && r.previous
  )

  function copyPrevious() {
    setValues((v) => {
      const next = { ...v }
      for (const r of blanksWithHistory) next[r.id] = r.previous!.amount
      return next
    })
  }

  async function submit() {
    try {
      await save.mutateAsync({
        month: sheet.month,
        rows: changed.map((r) => ({ prospectId: r.id, amount: values[r.id] })),
      })
      toast.success(
        `Saved ${changed.length} balance${changed.length === 1 ? "" : "s"} for ${monthName(sheet.month)}`
      )
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="pb-20">
      {blanksWithHistory.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed p-3 text-sm">
          <span className="text-muted-foreground">
            {blanksWithHistory.length} customer
            {blanksWithHistory.length === 1 ? " has" : "s have"} no balance for
            this month yet.
          </span>
          <Button size="sm" variant="outline" onClick={copyPrevious}>
            <IconCopy data-icon="inline-start" /> Copy last known balances
          </Button>
        </div>
      )}
      <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
        {sheet.rows.map((r) => (
          <li
            key={r.id}
            className="grid gap-2 px-3 py-3 sm:grid-cols-[1fr_13rem] sm:items-center sm:px-4"
          >
            <button
              type="button"
              className="flex min-w-0 items-center gap-3 text-left"
              onClick={() => open(r.id)}
            >
              <ProspectAvatar name={r.name} tier={r.tier} />
              <span className="min-w-0">
                <span className="block truncate font-medium hover:underline">
                  {r.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {r.previous
                    ? `${monthName(r.previous.month)}: ${naira(r.previous.amount)}`
                    : r.company || "No earlier balance"}
                </span>
              </span>
            </button>
            <MoneyInput
              aria-label={`${r.name} balance for ${monthName(sheet.month)}`}
              value={values[r.id]}
              onChange={(v) => setValues((s) => ({ ...s, [r.id]: v }))}
              placeholder={
                r.previous ? naira(r.previous.amount).slice(1) : "Balance"
              }
            />
          </li>
        ))}
      </ul>

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 mt-4 flex items-center gap-3 rounded-xl border bg-popover/95 p-3 shadow-lg backdrop-blur lg:bottom-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">
            Portfolio for {monthName(sheet.month)}
          </p>
          <p className="font-semibold tabular-nums">{naira(total)}</p>
        </div>
        <Button onClick={submit} disabled={!changed.length || save.isPending}>
          {save.isPending
            ? "Saving…"
            : changed.length
              ? `Save ${changed.length}`
              : "Saved"}
        </Button>
      </div>
    </div>
  )
}
