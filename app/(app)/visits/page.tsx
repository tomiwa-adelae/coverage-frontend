"use client"

import { useMemo, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import {
  IconCheck,
  IconMapPin,
  IconNavigation,
  IconRoute,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { localToday, relativeDay } from "@/lib/format"
import { useProspects } from "@/lib/queries"
import { STAGE_LABEL, type Prospect } from "@/lib/types"
import { EmptyNote, PageHeader, PageSection } from "@/components/section"
import { Chip } from "@/components/prospect-fields"
import { ProspectAvatar } from "@/components/prospect-avatar"
import { useOpenProspect } from "@/components/prospect-sheet"
import { useQuickLogDialog } from "@/components/quick-log"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"

const VisitMap = dynamic(
  () => import("@/components/visit-map").then((m) => m.VisitMap),
  { ssr: false, loading: () => <Skeleton className="h-72 w-full sm:h-96" /> }
)

/** Google Maps allows a destination plus up to 9 stops in a shared link. */
const MAX_STOPS = 10

// The country keeps Google from picking a same-named place elsewhere.
const placeOf = (p: Prospect) =>
  p.latitude !== null && p.longitude !== null
    ? `${p.latitude},${p.longitude}`
    : p.address || p.area
      ? [p.address, p.area, "Nigeria"].filter(Boolean).join(", ")
      : ""

function routeUrl(stops: Prospect[]) {
  const places = stops.map(placeOf).filter(Boolean)
  const qs = new URLSearchParams({ api: "1", travelmode: "driving" })
  qs.set("destination", places.at(-1)!)
  if (places.length > 1) qs.set("waypoints", places.slice(0, -1).join("|"))
  return `https://www.google.com/maps/dir/?${qs}`
}

export default function VisitsPage() {
  const { data, isError } = useProspects({})
  const open = useOpenProspect()
  const quickLog = useQuickLogDialog()
  const [area, setArea] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const today = localToday()

  const located = useMemo(
    () =>
      (data ?? []).filter(
        (p) =>
          p.stage !== "DECLINED" && (p.area || p.address || p.latitude !== null)
      ),
    [data]
  )
  const areas = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of located) {
      const a = p.area ?? "No area"
      counts.set(a, (counts.get(a) ?? 0) + 1)
    }
    return [...counts].sort((a, b) => b[1] - a[1])
  }, [located])

  const shown = located
    .filter((p) => !area || (p.area ?? "No area") === area)
    .sort(
      (a, b) =>
        // Due soonest first, then best tier.
        (a.nextDate ?? "9999").localeCompare(b.nextDate ?? "9999") ||
        (a.tier ?? "Z").localeCompare(b.tier ?? "Z")
    )
  const stops = selected
    .map((id) => located.find((p) => p.id === id))
    .filter((p): p is Prospect => !!p)
  const unlocated = (data ?? []).filter(
    (p) =>
      p.stage !== "DECLINED" && !p.area && !p.address && p.latitude === null
  ).length

  function toggle(id: string) {
    setSelected((s) =>
      s.includes(id)
        ? s.filter((x) => x !== id)
        : s.length >= MAX_STOPS
          ? s
          : [...s, id]
    )
  }

  return (
    <>
      <PageHeader
        title="Visits"
        description="Plan a day of visits by area and get directions for the whole route."
      />
      {isError ? (
        <EmptyNote>
          Couldn&apos;t load prospects. Refresh to try again.
        </EmptyNote>
      ) : !data ? (
        <Skeleton className="h-96 w-full" />
      ) : located.length === 0 ? (
        <EmptyNote>
          No prospects have an area or address yet. Open a prospect, go to
          Details, and add their area or pin their location when you visit.
        </EmptyNote>
      ) : (
        <>
          <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
            <Chip active={!area} onClick={() => setArea(null)}>
              All areas ({located.length})
            </Chip>
            {areas.map(([a, n]) => (
              <Chip key={a} active={area === a} onClick={() => setArea(a)}>
                {a} ({n})
              </Chip>
            ))}
          </div>

          <VisitMap pins={shown} selected={selected} onPick={toggle} />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Only prospects with a pinned location show on the map. Tap a dot to
            add it to your route.
          </p>

          <PageSection
            title="Prospects"
            count={shown.length}
            hint={`Tick up to ${MAX_STOPS} to build a route, in the order you'll visit.`}
          >
            <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
              {shown.map((p) => {
                const order = selected.indexOf(p.id)
                return (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 px-3 py-2.5 sm:px-4"
                  >
                    <Checkbox
                      checked={order >= 0}
                      onCheckedChange={() => toggle(p.id)}
                      aria-label={`Add ${p.name} to route`}
                    />
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      onClick={() => open(p.id)}
                    >
                      <ProspectAvatar name={p.name} tier={p.tier} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {order >= 0 && (
                            <span className="mr-1.5 inline-grid size-5 place-items-center rounded-full bg-brand text-[11px] font-bold text-brand-foreground">
                              {order + 1}
                            </span>
                          )}
                          {p.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[p.area, p.address, STAGE_LABEL[p.stage]]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                    </button>
                    {p.latitude !== null && (
                      <IconMapPin
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-label="Pinned on map"
                      />
                    )}
                    {p.nextDate && (
                      <span
                        className={cn(
                          "hidden shrink-0 text-xs sm:inline",
                          p.nextDate < today
                            ? "text-destructive"
                            : "text-muted-foreground"
                        )}
                      >
                        {relativeDay(p.nextDate, today)}
                      </span>
                    )}
                    <Button
                      size="icon-sm"
                      variant="outline"
                      className="text-primary"
                      aria-label={`Log a visit to ${p.name}`}
                      title="Log visit"
                      onClick={() => quickLog(p, { type: "VISIT" })}
                    >
                      <IconCheck />
                    </Button>
                  </li>
                )
              })}
            </ul>
          </PageSection>

          {unlocated > 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              {unlocated} other prospect{unlocated === 1 ? " has" : "s have"} no
              area or address yet.{" "}
              <Link href="/prospects" className="underline">
                Add them
              </Link>
            </p>
          )}

          {stops.length > 0 && (
            <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 mt-4 flex items-center gap-3 rounded-xl border bg-popover/95 p-3 shadow-lg backdrop-blur lg:bottom-4">
              <IconRoute className="size-5 shrink-0 text-primary" />
              <p className="min-w-0 flex-1 truncate text-sm">
                <span className="font-semibold">
                  {stops.length} stop{stops.length === 1 ? "" : "s"}
                </span>{" "}
                <span className="text-muted-foreground">
                  {stops.map((s) => s.name.split(" ")[0]).join(" → ")}
                </span>
              </p>
              <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
                Clear
              </Button>
              <Button
                size="sm"
                nativeButton={false}
                render={
                  <a href={routeUrl(stops)} target="_blank" rel="noreferrer" />
                }
              >
                <IconNavigation data-icon="inline-start" /> Directions
              </Button>
            </div>
          )}
        </>
      )}
    </>
  )
}
