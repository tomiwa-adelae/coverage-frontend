"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  IconArrowRight,
  IconArrowsMove,
  IconCalendar,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { localToday, naira, nairaShort, relativeDay } from "@/lib/format"
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
import { useMediaQuery } from "@/hooks/use-media-query"

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
  const [tab, setTab] = useState<Stage | null>(null)
  const desktop = useMediaQuery("(min-width: 768px)")
  // Tablets and landscape phones get the board but can't drag or hover.
  const touch = useMediaQuery("(hover: none)")
  const today = localToday()

  function moveTo(p: Prospect, stage: Stage, undoable = true) {
    if (p.stage === stage) return
    const from = p.stage
    move.mutate(
      { id: p.id, stage },
      {
        onSuccess: () => {
          if (!undoable) return
          if (stage === "FUNDED" && !p.funded) {
            open(p.id)
            toast.success(`${p.name} funded`, {
              description:
                "Add the funded amount so it counts toward your target.",
            })
          } else {
            toast.success(`${p.name} moved to ${STAGE_LABEL[stage]}`, {
              action: {
                label: "Undo",
                onClick: () => moveTo({ ...p, stage }, from, false),
              },
            })
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

  const active =
    tab ??
    STAGES.find((s) => s !== "DECLINED" && byStage[s].length) ??
    "IDENTIFIED"

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 max-md:[&>header]:mb-4">
        <PageHeader
          title="Pipeline"
          // Phones need the room for cards; the buttons explain themselves.
          description={
            !desktop
              ? undefined
              : touch
                ? "Tap the arrows on a card to move it to another stage."
                : "Drag a card to move it to the next stage."
          }
        />
        <div
          className="flex gap-0.5 rounded-lg border bg-card p-1 sm:gap-1"
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
                "rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:px-2.5",
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
      ) : !desktop ? (
        <MobileBoard
          byStage={byStage}
          loaded={!!data}
          active={active}
          today={today}
          onSelect={setTab}
          onOpen={(p) => open(p.id)}
          onMove={moveTo}
        />
      ) : (
        <div className="-mx-4 mt-2 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-4 lg:-mx-8 lg:scroll-px-8 lg:px-8">
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
                      {naira(value)}
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
          className="size-9 text-xs"
        />
        <div className="min-w-0 flex-1 [@media(hover:none)]:pr-6">
          <p className="truncate text-sm font-medium">{p.name}</p>
          {p.company && (
            <p className="truncate text-xs text-muted-foreground">
              {p.company}
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            {money ? (
              <span className="font-semibold text-foreground tabular-nums">
                {naira(money)}
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
      <MoveMenu
        p={p}
        onMove={onMove}
        trigger={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Move ${p.name}`}
            className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100 [@media(hover:none)]:opacity-100"
          >
            <IconArrowsMove />
          </Button>
        }
      />
    </li>
  )
}

/** Next step in the funnel, for the one-tap "move forward" button. */
function nextStage(stage: Stage): Stage | null {
  const i = STAGES.indexOf(stage)
  return stage === "FUNDED" || stage === "DECLINED" ? null : STAGES[i + 1]
}

function MoveMenu({
  p,
  onMove,
  trigger,
}: {
  p: Prospect
  onMove: (s: Stage) => void
  trigger: React.ReactElement
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent align="end" className="w-48">
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
  )
}

/** Phones: one stage at a time, picked from a scrollable tab strip. */
function MobileBoard({
  byStage,
  loaded,
  active,
  today,
  onSelect,
  onOpen,
  onMove,
}: {
  byStage: Record<Stage, Prospect[]>
  loaded: boolean
  active: Stage
  today: string
  onSelect: (s: Stage) => void
  onOpen: (p: Prospect) => void
  onMove: (p: Prospect, s: Stage) => void
}) {
  const items = byStage[active]
  const value = columnValue(active, items)
  const tabs = useRef<HTMLDivElement>(null)
  const swipe = useRef<{ x: number; y: number } | null>(null)

  // Keep the chosen stage in view; most of the strip is off-screen on a phone.
  useEffect(() => {
    const list = tabs.current
    const tab = list?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!list || !tab) return
    list.scrollTo({
      left: tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2,
      behavior: "smooth",
    })
  }, [active])

  /** Swipe left or right on the list for the next or previous stage. */
  function endSwipe(e: React.TouchEvent) {
    const start = swipe.current
    swipe.current = null
    if (!start) return
    const dx = e.changedTouches[0].clientX - start.x
    const dy = e.changedTouches[0].clientY - start.y
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return
    const next = STAGES[STAGES.indexOf(active) + (dx < 0 ? 1 : -1)]
    if (next) onSelect(next)
  }

  return (
    <>
      {/* Pinned under the app header so long stages don't lose their tabs. */}
      <div className="sticky top-[calc(max(0.75rem,env(safe-area-inset-top))+3.0625rem)] z-10 -mx-4 bg-background/95 px-4 pt-1 pb-2 backdrop-blur">
        <div
          ref={tabs}
          role="tablist"
          aria-label="Stage"
          className="-mx-4 flex scroll-px-4 [scrollbar-width:none] gap-2 overflow-x-auto [mask-image:linear-gradient(to_right,#000_calc(100%-2rem),transparent)] px-4 [&::-webkit-scrollbar]:hidden"
        >
          {STAGES.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={s === active}
              onClick={() => onSelect(s)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                s === active &&
                  "border-primary bg-primary text-primary-foreground dark:border-brand dark:bg-brand dark:text-brand-foreground"
              )}
            >
              {STAGE_LABEL[s]}
              <span
                className={cn(
                  "rounded-full bg-muted px-1.5 text-xs text-muted-foreground tabular-nums",
                  s === active && "bg-white/20 text-current"
                )}
              >
                {loaded ? byStage[s].length : "–"}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-2 flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">{STAGE_LABEL[active]}</h2>
          {value > 0 && (
            <span
              className={cn(
                "text-sm font-semibold tabular-nums",
                WON.includes(active) ? "text-tier-a" : "text-muted-foreground"
              )}
            >
              {naira(value)}
            </span>
          )}
        </div>
      </div>

      <ol
        className="mt-1 grid min-h-[50svh] content-start gap-2"
        onTouchStart={(e) => {
          const t = e.touches[0]
          swipe.current = { x: t.clientX, y: t.clientY }
        }}
        onTouchEnd={endSwipe}
      >
        {!loaded ? (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </>
        ) : items.length === 0 ? (
          <li className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            Nobody in {STAGE_LABEL[active].toLowerCase()} yet.
          </li>
        ) : (
          items.map((p) => {
            const next = nextStage(p.stage)
            const late = p.nextDate && p.nextDate < today
            const money =
              WON.includes(p.stage) && p.funded ? p.funded : p.potential
            return (
              <li
                key={p.id}
                className="animate-in rounded-xl border bg-card shadow-xs fade-in"
              >
                <button
                  type="button"
                  onClick={() => onOpen(p)}
                  className="flex w-full items-center gap-3 rounded-t-xl p-3 text-left active:bg-muted/60"
                >
                  <ProspectAvatar name={p.name} tier={p.tier} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {p.company || p.nextAction || "No company added"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs">
                    {money ? (
                      <span className="block font-semibold tabular-nums">
                        {nairaShort(money)}
                      </span>
                    ) : null}
                    {p.nextDate && (
                      <span
                        className={cn(
                          "mt-0.5 inline-flex items-center gap-0.5 text-muted-foreground",
                          late && "font-medium text-destructive"
                        )}
                      >
                        <IconCalendar className="size-3" />
                        {relativeDay(p.nextDate, today)}
                      </span>
                    )}
                  </span>
                </button>
                <div className="flex gap-2 border-t p-2">
                  <MoveMenu
                    p={p}
                    onMove={(s) => onMove(p, s)}
                    trigger={
                      <Button variant="ghost" size="sm" className="flex-1">
                        <IconArrowsMove data-icon="inline-start" /> Move to…
                      </Button>
                    }
                  />
                  {next && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => onMove(p, next)}
                    >
                      {STAGE_LABEL[next]}
                      <IconArrowRight data-icon="inline-end" />
                    </Button>
                  )}
                </div>
              </li>
            )
          })
        )}
      </ol>
    </>
  )
}
