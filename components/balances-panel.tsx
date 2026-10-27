"use client"

import { useState } from "react"
import { IconTrash } from "@tabler/icons-react"
import { toast } from "sonner"
import { localToday, monthName, naira } from "@/lib/format"
import { useRemoveBalance, useSetBalance } from "@/lib/queries"
import type { ProspectDetail } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/inputs"

const monthLabel = monthName

export const thisMonth = () => localToday().slice(0, 7)

/** Month-end balances for one customer; the latest feeds the target. */
export function BalancesPanel({ prospect }: { prospect: ProspectDetail }) {
  const [month, setMonth] = useState(thisMonth())
  const existing = prospect.balances.find((b) => b.month === month)
  const [amount, setAmount] = useState<number | null>(existing?.amount ?? null)
  const save = useSetBalance(prospect.id)
  const remove = useRemoveBalance(prospect.id)
  const peak = Math.max(1, ...prospect.balances.map((b) => b.amount))

  function pickMonth(m: string) {
    setMonth(m)
    setAmount(prospect.balances.find((b) => b.month === m)?.amount ?? null)
  }

  async function submit(e?: React.SyntheticEvent) {
    // This panel sits inside the prospect form; don't submit that too.
    e?.preventDefault()
    e?.stopPropagation()
    if (amount === null) return toast.error("Enter the balance")
    try {
      await save.mutateAsync({ month, amount })
      toast.success(`Balance for ${monthLabel(month)} saved`)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Enter the month-end (or average) balance from the core banking report.
        The latest month counts toward your target.
      </p>

      <div
        role="group"
        aria-label="Record a balance"
        className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[9rem_1fr_auto] sm:items-end"
      >
        <div className="grid gap-1.5">
          <Label htmlFor="bal-month">Month</Label>
          <Input
            id="bal-month"
            type="month"
            value={month}
            max={thisMonth()}
            onChange={(e) => e.target.value && pickMonth(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bal-amount">Balance</Label>
          <MoneyInput
            id="bal-amount"
            value={amount}
            onChange={setAmount}
            placeholder="e.g. 12,500,000"
            onKeyDown={(e) => {
              if (e.key === "Enter") submit(e)
            }}
          />
        </div>
        <Button
          type="button"
          onClick={() => submit()}
          disabled={save.isPending}
        >
          {save.isPending ? "Saving…" : existing ? "Update" : "Save"}
        </Button>
      </div>

      {prospect.balances.length ? (
        <ul className="divide-y rounded-xl border">
          {prospect.balances.map((b) => (
            <li
              key={b.month}
              className="group flex items-center gap-3 px-4 py-2.5"
            >
              <button
                type="button"
                className="w-20 shrink-0 text-left text-sm hover:underline"
                onClick={() => pickMonth(b.month)}
              >
                {monthLabel(b.month)}
              </button>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${(b.amount / peak) * 100}%` }}
                />
              </span>
              <span className="w-32 text-right text-sm font-medium tabular-nums">
                {naira(b.amount)}
              </span>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={`Remove ${monthLabel(b.month)} balance`}
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                onClick={() => remove.mutate(b.month)}
              >
                <IconTrash />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          No balances yet. Record one above once they fund.
        </p>
      )}
    </div>
  )
}
