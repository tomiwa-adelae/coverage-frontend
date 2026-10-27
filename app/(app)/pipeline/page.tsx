"use client"

import { useState } from "react"
import { toast } from "sonner"
import { IconArrowsMove, IconCalendar } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { localToday, nairaShort, relativeDay } from "@/lib/format"
import { prospectsKey, useMoveStage, useProspects } from "@/lib/queries"
import {
  STAGES,
  STAGE_LABEL,
  TIERS,
  type Prospect,
  type Stage,
} from "@/lib/types"
import { ProspectAvatar } from "@/components/prospect-avatar"
import { useOpenProspect } from "@/components/prospect-sheet"
import { EmptyNote, PageHeader } from "@/components/section"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"

const WON: Stage[] = ["ACCOUNT_OPENED", "FUNDED"]
const DRAG_TYPE = "application/x-coverage-prospect"

/** Opened and funded columns show money in; the rest show what's possible. */
const columnValue = (stage: Stage, items: Prospect[]) =>
  items.reduce(
    (sum, p) =>
      sum +
      ((WON.includes(stage) ? p.funded || p.potential : p.potential) ?? 0),
    0
  )

export default function PipelinePage() {
  const [tier, setTier] = useState("")
  const filters = { tier: tier || undefined }
  const { data, isError } = useProspects(filters)
  const move = useMoveStage(prospectsKey(filters))
  const open = useOpenProspect()
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<Stage | null>(null)
  const today = localToday()

  function moveTo(p: Prospect, stage: Stage) {
    if (p.stage === stage) return
    move.mutate(
      { id: p.id, stage },
      {
        onSuccess: () => {
          if (stage === "FUNDED" && !p.funded) {
            open(p.id)
            toast.success(`${p.name} funded`, {
              description:
                "Add the funded amount so it counts toward your target.",
            })
          } else {
            toast.success(`${p.name} → ${STAGE_LABEL[stage]}`)
          }
        },
      }
    )
  }

  function drop(e: React.DragEvent, stage: Stage) {
    e.preventDefault()
    setOver(null)
    const id = e.dataTransfer.getData(DRAG_TYPE)
    const p = data?.find((x) => x.id === id)
    if (p) moveTo(p, stage)
  }

  const byStage = Object.fromEntries(
    STAGES.map((s) => [s, [] as Prospect[]])
  ) as Record<Stage, Prospect[]>
  for (const p of data ?? []) byStage[p.stage].push(p)
  for (const s of STAGES)
    byStage[s].sort(
      (a, b) =>
        (a.tier ?? "Z").localeCompare(b.tier ?? "Z") ||
        (b.potential ?? 0) - (a.potential ?? 0)
    )

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <PageHeader
          title="Pipeline"
          description="Drag a card to move it to the next stage."
        />
        <div
          className="flex gap-1 rounded-lg border bg-card p-1"
          role="group"
          aria-label="Tier"
        >
          {["", ...TIERS].map((t) => (
            <button
              key={t || "all"}
              type="button"
              aria-pressed={tier === t}
              onClick={() => setTier(t)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
                tier === t &&
                  "bg-primary text-primary-foreground hover:text-primary-foreground"
              )}
            >
              {t ? `Tier ${t}` : "All"}
            </button>
          ))}
        </div>
      </div>

      {isError ? (
        <EmptyNote>
          Couldn&apos;t load the pipeline. Refresh to try again.
        </EmptyNote>
      ) : (
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 lg:-mx-8 lg:px-8">
          {STAGES.map((stage) => {
            const items = byStage[stage]
            const value = columnValue(stage, items)
            const declined = stage === "DECLINED"
            return (
              <section
                key={stage}
                aria-label={STAGE_LABEL[stage]}
                onDragOver={(e) => {
                  if (!dragging) return
                  e.preventDefault()
                  e.dataTransfer.dropEffect = "move"
                  setOver(stage)
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node))
                    setOver((o) => (o === stage ? null : o))
                }}
                onDrop={(e) => drop(e, stage)}
                className={cn(
                  "flex w-[17rem] shrink-0 snap-start flex-col rounded-xl border bg-muted/40 transition-colors",
                  declined && "opacity-75",
                  over === stage && "border-brand bg-brand/10"
                )}
              >
                <header className="flex items-baseline justify-between gap-2 border-b px-3 py-2.5">
                  <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                    {stage === "FUNDED" && (
                      <span
                        className="size-2 rounded-full bg-brand"
                        aria-hidden
                      />
                    )}
                    {STAGE_LABEL[stage]}
                    <span className="text-xs font-medium text-muted-foreground tabular-nums">
                      {data ? items.length : ""}
                    </span>
                  </h2>
                  {value > 0 && (
                    <span
                      className={cn(
                        "text-xs font-semibold tabular-nums",
                        WON.includes(stage)
                          ? "text-tier-a"
                          : "text-muted-foreground"
                      )}
                    >
                      {nairaShort(value)}
                    </span>
                  )}
                </header>
                <ol className="flex min-h-24 flex-1 flex-col gap-2 p-2">
                  {!data ? (
                    <>
                      <Skeleton className="h-16" />
                      <Skeleton className="h-16" />
                    </>
                  ) : items.length === 0 ? (
                    <li className="grid flex-1 place-items-center rounded-lg border border-dashed px-2 py-4 text-center text-xs text-muted-foreground">
                      {dragging ? "Drop here" : "Nobody here yet"}
                    </li>
                  ) : (
                    items.map((p) => (
                      <Card
                        key={p.id}
                        p={p}
                        today={today}
                        dragging={dragging === p.id}
                        onOpen={() => open(p.id)}
                        onMove={(s) => moveTo(p, s)}
                        onDragStart={(e) => {
                          e.dataTransfer.setData(DRAG_TYPE, p.id)
                          e.dataTransfer.effectAllowed = "move"
                          setDragging(p.id)
                        }}
                        onDragEnd={() => {
                          setDragging(null)
                          setOver(null)
                        }}
                      />
                    ))
                  )}
                </ol>
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}

function Card({
  p,
  today,
  dragging,
  onOpen,
  onMove,
  onDragStart,
  onDragEnd,
}: {
  p: Prospect
  today: string
  dragging: boolean
  onOpen: () => void
  onMove: (s: Stage) => void
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
}) {
  const late = p.nextDate && p.nextDate < today
  const money = WON.includes(p.stage) && p.funded ? p.funded : p.potential
  return (
    <li
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "group relative cursor-grab rounded-lg border bg-card p-2.5 shadow-xs transition-[opacity,box-shadow] hover:shadow-sm active:cursor-grabbing",
        dragging && "opacity-40"
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="absolute inset-0 rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label={`Open ${p.name}`}
      />
      <div className="pointer-events-none flex items-start gap-2.5">
        <ProspectAvatar
          name={p.name}
          tier={p.tier}
          className="size-8 text-xs"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{p.name}</p>
          {p.company && (
            <p className="truncate text-xs text-muted-foreground">
              {p.company}
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            {money ? (
              <span className="font-semibold text-foreground tabular-nums">
                {nairaShort(money)}
              </span>
            ) : null}
            {p.nextDate && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5",
                  late && "font-medium text-destructive"
                )}
              >
                <IconCalendar className="size-3" />
                {relativeDay(p.nextDate, today)}
              </span>
            )}
          </div>
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Move ${p.name}`}
              className="absolute top-1.5 right-1.5 opacity-100 data-popup-open:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
            />
          }
        >
          <IconArrowsMove />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Move to</DropdownMenuLabel>
            {STAGES.filter((s) => s !== p.stage).map((s) => (
              <DropdownMenuItem key={s} onClick={() => onMove(s)}>
                {STAGE_LABEL[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}
