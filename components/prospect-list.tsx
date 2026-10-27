"use client"

import {
  IconBrandWhatsapp,
  IconMessageDots,
  IconCheck,
  IconClockPause,
  IconDots,
  IconPhone,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { telUrl, whatsappUrl } from "@/lib/contact"
import { addDays, naira, niceDate, relativeDay, timeAgo } from "@/lib/format"
import { usePatchProspect } from "@/lib/queries"
import { STAGE_LABEL, type Prospect } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ProspectAvatar } from "@/components/prospect-avatar"
import { useOpenProspect } from "@/components/prospect-sheet"
import { useQuickLogDialog } from "@/components/quick-log"
import { useMessageDialog } from "@/components/message-dialog"
import { useTrackCall } from "@/components/call-tracker"

export function DueChip({
  date,
  today,
}: {
  date: string | null
  today: string
}) {
  if (!date)
    return <span className="text-xs text-muted-foreground">No date</span>
  const late = date < today
  const now = date === today
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        late && "bg-destructive/10 text-destructive",
        now &&
          "bg-warning/15 text-[color-mix(in_oklch,var(--warning),black_35%)] dark:text-warning",
        !late && !now && "bg-muted text-muted-foreground"
      )}
    >
      {relativeDay(date, today)}
    </span>
  )
}

const SNOOZE: [string, number][] = [
  ["Tomorrow", 1],
  ["In 3 days", 3],
  ["Next week", 7],
  ["In 2 weeks", 14],
]

export function ProspectList<P extends Prospect>({
  items,
  today,
  trailing = "date",
  actions = false,
  subtitle,
}: {
  items: P[]
  today: string
  trailing?: "date" | "stage"
  /** Show Call / WhatsApp / Done / Snooze on each row. */
  actions?: boolean
  /** Replaces the default "next action · last contact" line. */
  subtitle?: (p: P) => string
}) {
  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
      {items.map((p) => (
        <ProspectRow
          key={p.id}
          p={p}
          today={today}
          trailing={trailing}
          actions={actions}
          subtitle={subtitle?.(p)}
        />
      ))}
    </ul>
  )
}

function ProspectRow({
  p,
  today,
  trailing,
  actions,
  subtitle,
}: {
  p: Prospect
  today: string
  trailing: "date" | "stage"
  actions: boolean
  subtitle?: string
}) {
  const open = useOpenProspect()
  const quickLog = useQuickLogDialog()
  const message = useMessageDialog()
  const patch = usePatchProspect()
  const trackCall = useTrackCall()

  async function snooze(days: number) {
    const nextDate = addDays(today, days)
    await patch.mutateAsync({ id: p.id, nextDate })
    toast.success(`${p.name} moved to ${niceDate(nextDate)}`)
  }

  const meta = [
    p.nextAction || (trailing === "date" ? STAGE_LABEL[p.stage] : p.company),
    p.lastContactAt ? `Contacted ${timeAgo(p.lastContactAt)}` : null,
  ].filter(Boolean)

  return (
    <li className="group relative flex items-center gap-3 px-3 py-3 transition-colors hover:bg-muted/50 sm:px-4">
      {/* Whole row opens the card; action buttons sit above this layer. */}
      <button
        type="button"
        onClick={() => open(p.id)}
        className="absolute inset-0 focus-visible:bg-muted/60 focus-visible:outline-none"
        aria-label={`Open ${p.name}`}
      />
      <ProspectAvatar name={p.name} tier={p.tier} />
      <div className="pointer-events-none min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate font-medium">{p.name}</span>
          {p.group && (
            <span className="shrink-0 rounded bg-muted px-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              {p.group}
            </span>
          )}
        </div>
        <p className="truncate text-sm text-muted-foreground">
          {subtitle ?? (meta.join(" · ") || "—")}
        </p>
      </div>

      <div className="pointer-events-none flex flex-col items-end gap-1">
        {trailing === "date" ? (
          <DueChip date={p.nextDate} today={today} />
        ) : (
          <span className="text-xs whitespace-nowrap text-muted-foreground">
            {STAGE_LABEL[p.stage]}
          </span>
        )}
        {p.potential ? (
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {naira(p.potential)}
          </span>
        ) : null}
      </div>

      {actions && (
        <div className="relative z-10 flex items-center gap-0.5">
          {p.phone && (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                className="hidden sm:inline-flex"
                aria-label={`Call ${p.name}`}
                nativeButton={false}
                render={
                  <a href={telUrl(p.phone)} onClick={() => trackCall(p)} />
                }
              >
                <IconPhone />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="hidden sm:inline-flex"
                aria-label={`WhatsApp ${p.name}`}
                nativeButton={false}
                render={
                  <a
                    href={whatsappUrl(p.phone)}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                <IconBrandWhatsapp />
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="icon-sm"
            className="text-primary"
            aria-label={`Log contact with ${p.name}`}
            title="Log contact"
            onClick={() => quickLog(p)}
          >
            <IconCheck />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`More for ${p.name}`}
                />
              }
            >
              <IconDots />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {p.phone && (
                <>
                  <DropdownMenuGroup className="sm:hidden">
                    <DropdownMenuItem
                      render={
                        <a
                          href={telUrl(p.phone)}
                          onClick={() => trackCall(p)}
                        />
                      }
                    >
                      <IconPhone /> Call
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      render={
                        <a
                          href={whatsappUrl(p.phone)}
                          target="_blank"
                          rel="noreferrer"
                        />
                      }
                    >
                      <IconBrandWhatsapp /> WhatsApp
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator className="sm:hidden" />
                </>
              )}
              <DropdownMenuItem onClick={() => message(p)}>
                <IconMessageDots /> Send message…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel className="flex items-center gap-1.5">
                  <IconClockPause className="size-3.5" /> Snooze
                </DropdownMenuLabel>
                {SNOOZE.map(([label, n]) => (
                  <DropdownMenuItem key={n} onClick={() => snooze(n)}>
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </li>
  )
}
