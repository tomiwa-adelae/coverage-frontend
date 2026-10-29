"use client"

import Link from "next/link"
import { toast } from "sonner"
import { IconPrinter, IconSend } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { addDays, longDate, monthName, naira, niceDate } from "@/lib/format"
import { useMe, useSendWeeklyReport, useWeeklyReport } from "@/lib/queries"
import { STAGE_LABEL } from "@/lib/types"
import { EmptyNote } from "@/components/section"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

export default function ReportPage() {
  const { data: r, isError } = useWeeklyReport()
  const { data: me } = useMe()
  const send = useSendWeeklyReport()

  if (isError)
    return (
      <EmptyNote>
        Couldn&apos;t load the report. Refresh to try again.
      </EmptyNote>
    )
  if (!r) return <Skeleton className="h-[32rem] w-full" />

  const pct = r.target ? Math.min(100, (r.balance / r.target) * 100) : 0

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <h1 className="text-2xl font-semibold tracking-tight">Weekly report</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <IconPrinter data-icon="inline-start" /> Print or PDF
          </Button>
          {me?.managerEmail ? (
            <Button
              disabled={send.isPending}
              onClick={() =>
                send.mutate(undefined, {
                  onSuccess: () => toast.success(`Sent to ${me.managerEmail}`),
                  onError: (e) => toast.error(e.message),
                })
              }
            >
              <IconSend data-icon="inline-start" />
              {send.isPending ? "Sending…" : "Send to manager"}
            </Button>
          ) : (
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/settings" />}
            >
              Add manager&apos;s email
            </Button>
          )}
        </div>
      </div>

      <article className="rounded-xl border bg-card p-5 shadow-xs sm:p-7 print:border-0 print:p-0 print:shadow-none">
        <header className="border-b pb-4">
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Weekly update
          </p>
          <h2 className="mt-1 text-xl font-semibold">{r.user.name}</h2>
          <p className="text-sm text-muted-foreground">
            {[r.user.jobTitle, r.user.branch].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-1 text-sm">
            Week of {niceDate(r.weekStart)} to{" "}
            {niceDate(addDays(r.weekStart, 6))}
          </p>
        </header>

        <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Fact label="Contacts made" value={r.contacts} />
          <Fact label="Accounts opened" value={r.accountsOpened} />
          <Fact
            label="Likely from pipeline"
            value={naira(r.weightedPipeline)}
          />
          <Fact
            label="On pace for"
            value={naira(r.projected)}
            tone={r.onPace ? "good" : "bad"}
          />
        </dl>

        <section className="mt-6">
          <h3 className="text-sm font-semibold">Deposit balance</h3>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {naira(r.balance)}{" "}
            <span className="text-base font-medium text-muted-foreground">
              of {naira(r.target)} ({pct.toFixed(0)}%)
            </span>
          </p>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted print:border">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {r.onPace
              ? `On pace to reach the target by ${monthName(r.endMonth, true)}.`
              : `At the current pace, ${naira(r.target - r.projected)} short by ${monthName(r.endMonth, true)}.`}
          </p>
        </section>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <section>
            <h3 className="text-sm font-semibold">Pipeline</h3>
            <table className="mt-2 w-full text-sm">
              <tbody className="divide-y">
                {r.stages.map((s) => (
                  <tr key={s.stage}>
                    <td className="py-1.5">{STAGE_LABEL[s.stage]}</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {s.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section>
            <h3 className="text-sm font-semibold">Biggest opportunities</h3>
            {r.opportunities.length ? (
              <ol className="mt-2 space-y-2 text-sm">
                {r.opportunities.map((o, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {o.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[o.company, STAGE_LABEL[o.stage]]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {naira(o.potential)}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                No open prospects with a deposit estimate yet.
              </p>
            )}
          </section>
        </div>

        <section className="mt-6">
          <h3 className="text-sm font-semibold">
            To-dos completed: {r.tasksDone}
          </h3>
          {r.documentsCollected > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              Including {r.documentsCollected} account-opening document
              {r.documentsCollected === 1 ? "" : "s"} collected.
            </p>
          )}
          {r.completed.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {r.completed.map((t, i) => (
                <li key={i}>
                  {t.title}
                  {t.prospect && (
                    <span className="text-muted-foreground">
                      {" "}
                      ({t.prospect})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="mt-8 border-t pt-3 text-xs text-muted-foreground">
          Prepared with Coverage on{" "}
          {longDate(new Date().toLocaleDateString("en-CA"))}.
        </footer>
      </article>
    </>
  )
}

function Fact({
  label,
  value,
  tone,
}: {
  label: string
  value: React.ReactNode
  tone?: "good" | "bad"
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 text-lg font-semibold tabular-nums",
          tone === "good" && "text-success",
          tone === "bad" && "text-destructive"
        )}
      >
        {value}
      </dd>
    </div>
  )
}
