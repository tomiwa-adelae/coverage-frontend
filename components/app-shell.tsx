"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  IconBolt,
  IconCash,
  IconChartBar,
  IconDots,
  IconFileImport,
  IconLayoutKanban,
  IconMap2,
  IconMessageDots,
  IconMicrophone,
  IconPlus,
  IconReportAnalytics,
  IconRoute,
  IconSearch,
  IconSettings,
  IconShieldLock,
  IconSun,
  IconUsers,
  IconUsersGroup,
  type Icon,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { UserAvatar } from "@/components/user-avatar"
import {
  useMe,
  useNotificationConfig,
  useProspect,
  useToday,
} from "@/lib/queries"
import { syncPush } from "@/lib/push"
import { useMediaQuery } from "@/hooks/use-media-query"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { ProspectPanel, useOpenProspect } from "@/components/prospect-sheet"
import { QuickLogProvider, useQuickLogDialog } from "@/components/quick-log"
import { CallTrackerProvider } from "@/components/call-tracker"
import { BrandLockup } from "@/components/brand"
import { GoalWatcher } from "@/components/goal-card"
import { MessageProvider } from "@/components/message-dialog"
import { AddProspectProvider, useAddProspect } from "@/components/add-prospect"
import {
  CommandPaletteProvider,
  useCommandPalette,
} from "@/components/command-palette"

interface NavItem {
  href: string
  label: string
  short: string
  icon: Icon
  badge?: number
  urgent?: boolean
}

function useNav(): NavItem[] {
  const { data } = useToday()
  const due = data ? data.overdue.length + data.dueToday.length : 0
  const toTriage = data ? data.unrated.length + data.noNextStep.length : 0
  return [
    {
      href: "/",
      label: "Today",
      short: "Today",
      icon: IconSun,
      badge: due,
      urgent: !!data?.overdue.length,
    },
    {
      href: "/prospects",
      label: "Prospects",
      short: "Prospects",
      icon: IconUsers,
    },
    {
      href: "/pipeline",
      label: "Pipeline",
      short: "Pipeline",
      icon: IconLayoutKanban,
    },
    {
      href: "/triage",
      label: "Rate & plan",
      short: "Triage",
      icon: IconBolt,
      badge: toTriage,
    },
    {
      href: "/progress",
      label: "Progress",
      short: "Progress",
      icon: IconChartBar,
    },
  ]
}

const TOOLS: NavItem[] = [
  {
    href: "/debrief",
    label: "Debrief",
    short: "Debrief",
    icon: IconMicrophone,
  },
  { href: "/balances", label: "Balances", short: "Balances", icon: IconCash },
  { href: "/visits", label: "Visits", short: "Visits", icon: IconMap2 },
  { href: "/plans", label: "Follow-up plans", short: "Plans", icon: IconRoute },
  {
    href: "/templates",
    label: "Message templates",
    short: "Templates",
    icon: IconMessageDots,
  },
  {
    href: "/report",
    label: "Weekly report",
    short: "Report",
    icon: IconReportAnalytics,
  },
  {
    href: "/import",
    label: "Import & export",
    short: "Import",
    icon: IconFileImport,
  },
  { href: "/team", label: "Team", short: "Team", icon: IconUsersGroup },
]

/** On phones, these live under "More" instead of the tab bar. */
const MORE_EXTRA: NavItem[] = [
  {
    href: "/security",
    label: "Security",
    short: "Security",
    icon: IconShieldLock,
  },
  {
    href: "/settings",
    label: "Settings",
    short: "Settings",
    icon: IconSettings,
  },
]

const isActive = (href: string, pathname: string) =>
  href === "/" ? pathname === "/" : pathname.startsWith(href)

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AddProspectProvider>
      <Shell>{children}</Shell>
    </AddProspectProvider>
  )
}

/** Keeps this device's push subscription current with the server. */
function PushSync() {
  const { data } = useNotificationConfig()
  const key = data?.pushKey
  useEffect(() => {
    if (key) void syncPush(key)
  }, [key])
  return null
}

/** `?log=<id>` (from a "How did it go?" notification) opens the quick log. */
function QuickLogFromUrl() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const quickLog = useQuickLogDialog()
  const id = params.get("log")
  const { data } = useProspect(id)
  const opened = useRef<string | null>(null)
  useEffect(() => {
    if (!id || !data || opened.current === id) return
    opened.current = id
    quickLog(data)
    const rest = new URLSearchParams(params)
    rest.delete("log")
    const q = rest.toString()
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
  }, [id, data, params, pathname, quickLog, router])
  return null
}

function Shell({ children }: { children: React.ReactNode }) {
  const addProspect = useAddProspect()
  const params = useSearchParams()
  const open = useOpenProspect()
  const wide = useMediaQuery("(min-width: 1280px)")
  const tablet = useMediaQuery("(min-width: 768px)")
  const id = params.get("p")
  const pathname = usePathname()
  const fullWidth = pathname.startsWith("/pipeline")

  return (
    <QuickLogProvider>
      <CallTrackerProvider>
        <MessageProvider>
          <CommandPaletteProvider>
            <GoalWatcher />
            <PushSync />
            <QuickLogFromUrl />
            <div className="min-h-svh lg:grid lg:grid-cols-[15.5rem_1fr] print:block">
              <Sidebar onAdd={() => addProspect()} />

              <div className="flex min-w-0">
                <div className="min-w-0 flex-1">
                  <MobileHeader />
                  <main
                    className={cn(
                      "mx-auto px-4 pt-5 pb-36 lg:px-8 lg:pt-10 lg:pb-16",
                      !fullWidth && "max-w-3xl"
                    )}
                  >
                    {children}
                  </main>
                </div>

                {wide && id && (
                  <aside
                    key={id}
                    className="sticky top-0 h-svh w-[30rem] shrink-0 animate-in overflow-y-auto border-l bg-card fade-in slide-in-from-right-4"
                  >
                    <ProspectPanel id={id} onClose={() => open(null)} />
                  </aside>
                )}
              </div>
            </div>

            <MobileTabBar />

            <Button
              size="lg"
              onClick={() => addProspect()}
              aria-label="Add prospect"
              className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 size-14 rounded-full shadow-lg lg:hidden print:hidden"
            >
              <IconPlus className="size-6" />
            </Button>

            {!wide && (
              <Sheet open={!!id} onOpenChange={(o) => !o && open(null)}>
                <SheetContent
                  side={tablet ? "right" : "bottom"}
                  className={cn(
                    "gap-0 overflow-y-auto p-0",
                    tablet
                      ? "w-full sm:max-w-lg"
                      : "max-h-[92dvh] rounded-t-2xl"
                  )}
                >
                  {!tablet && (
                    <div
                      className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-muted"
                      aria-hidden
                    />
                  )}
                  {id && <ProspectPanel id={id} Title={SheetTitle} />}
                </SheetContent>
              </Sheet>
            )}
          </CommandPaletteProvider>
        </MessageProvider>
      </CallTrackerProvider>
    </QuickLogProvider>
  )
}

function Brand() {
  return (
    <Link href="/" aria-label="Coverage home">
      <BrandLockup />
    </Link>
  )
}

function Sidebar({ onAdd }: { onAdd: () => void }) {
  const pathname = usePathname()
  const nav = useNav()
  const { data: me } = useMe()
  const search = useCommandPalette()

  return (
    <aside className="sticky top-0 hidden h-svh flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 text-sidebar-foreground lg:flex print:!hidden">
      <div className="px-2">
        <Brand />
      </div>

      <Button
        className="mt-6 w-full justify-start bg-sidebar-primary font-semibold text-sidebar-primary-foreground hover:bg-sidebar-primary/90"
        size="lg"
        onClick={onAdd}
      >
        <IconPlus data-icon="inline-start" /> Add prospect
      </Button>
      <button
        type="button"
        onClick={search}
        className="mt-2 flex items-center gap-2 rounded-md border border-sidebar-border px-2.5 py-1.5 text-sm text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <IconSearch className="size-4" />
        <span className="flex-1 text-left">Search</span>
        <kbd className="rounded border border-sidebar-border px-1 font-sans text-[10px]">
          Ctrl K
        </kbd>
      </button>

      <nav className="mt-6 flex flex-col gap-0.5" aria-label="Main">
        {nav.map((item) => {
          const active = isActive(item.href, pathname)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                active &&
                  "relative bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:inset-y-1.5 before:-left-3 before:w-1 before:rounded-r-full before:bg-sidebar-primary"
              )}
            >
              <item.icon
                className={cn("size-[18px]", active && "text-sidebar-primary")}
              />
              {item.label}
              {!!item.badge && (
                <span
                  className={cn(
                    "ml-auto rounded-full px-1.5 text-xs font-semibold tabular-nums",
                    item.urgent
                      ? "bg-destructive text-white"
                      : "bg-sidebar-foreground/10 text-sidebar-foreground/80"
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <p className="mt-6 px-2.5 text-[11px] font-semibold tracking-wider text-sidebar-foreground/50 uppercase">
        Tools
      </p>
      <nav
        className="mt-1 flex flex-col gap-0.5 overflow-y-auto"
        aria-label="Tools"
      >
        {TOOLS.map((item) => {
          const active = isActive(item.href, pathname)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-2.5 py-1.5 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                active && "bg-sidebar-accent text-sidebar-accent-foreground"
              )}
            >
              <item.icon
                className={cn("size-[18px]", active && "text-sidebar-primary")}
              />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto flex items-center gap-1 border-t border-sidebar-border pt-3">
        <Link
          href="/profile"
          className={cn(
            "flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-sidebar-accent",
            pathname === "/profile" && "bg-sidebar-accent"
          )}
        >
          <UserAvatar me={me} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {me?.name ?? " "}
            </span>
            <span className="block truncate text-xs text-sidebar-foreground/60">
              {me?.jobTitle || me?.email || " "}
            </span>
          </span>
        </Link>
        <Link
          href="/settings"
          aria-label="Settings"
          title="Settings"
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            pathname === "/settings" &&
              "bg-sidebar-accent text-sidebar-accent-foreground"
          )}
        >
          <IconSettings className="size-[18px]" />
        </Link>
      </div>
    </aside>
  )
}

function MobileHeader() {
  const { data: me } = useMe()
  const search = useCommandPalette()
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/90 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur lg:hidden print:hidden">
      <Brand />
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Search"
          onClick={search}
        >
          <IconSearch />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Debrief"
          nativeButton={false}
          render={<Link href="/debrief" />}
        >
          <IconMicrophone />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Settings"
          nativeButton={false}
          render={<Link href="/settings" />}
        >
          <IconSettings />
        </Button>
        <Link
          href="/profile"
          aria-label="Profile"
          className="rounded-full focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <UserAvatar me={me} />
        </Link>
      </div>
    </header>
  )
}

function MobileTabBar() {
  const pathname = usePathname()
  const all = useNav()
  const [moreOpen, setMoreOpen] = useState(false)
  // Triage moves under More on phones; its badge rides along on the More tab.
  const triage = all.find((n) => n.href === "/triage")!
  const nav = all.filter((n) => n !== triage)
  const more = [triage, ...TOOLS, ...MORE_EXTRA]
  const moreActive = more.some((m) => isActive(m.href, pathname))
  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden"
      >
        {nav.map((item) => {
          const active = isActive(item.href, pathname)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center gap-0.5 pt-2.5 pb-2 text-[11px] font-medium text-muted-foreground",
                active && "text-primary"
              )}
            >
              <span className="relative">
                <item.icon
                  className="size-[22px]"
                  stroke={active ? 2.2 : 1.8}
                />
                {!!item.badge && (
                  <span
                    className={cn(
                      "absolute -top-1.5 left-3.5 min-w-4 rounded-full px-1 text-center text-[10px] leading-4 font-semibold text-white tabular-nums",
                      item.urgent ? "bg-destructive" : "bg-primary"
                    )}
                  >
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </span>
              {item.short}
            </Link>
          )
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          className={cn(
            "relative flex flex-col items-center gap-0.5 pt-2.5 pb-2 text-[11px] font-medium text-muted-foreground",
            moreActive && "text-primary"
          )}
        >
          <span className="relative">
            <IconDots className="size-[22px]" stroke={moreActive ? 2.2 : 1.8} />
            {!!triage.badge && (
              <span className="absolute -top-1.5 left-3.5 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 font-semibold text-white tabular-nums">
                {triage.badge > 99 ? "99+" : triage.badge}
              </span>
            )}
          </span>
          More
        </button>
      </nav>
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] gap-0 overflow-y-auto rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)]"
        >
          <div
            className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-muted"
            aria-hidden
          />
          <SheetTitle className="px-5 pt-3 pb-1 text-base">More</SheetTitle>
          <nav aria-label="More" className="grid grid-cols-3 gap-2 p-4">
            {more.map((item) => {
              const active = isActive(item.href, pathname)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-xs font-medium transition-colors hover:bg-muted",
                    active && "border-primary bg-primary/5 text-primary"
                  )}
                >
                  <item.icon className="size-6" stroke={1.7} />
                  {item.short}
                  {!!item.badge && (
                    <span className="absolute top-1.5 right-1.5 min-w-4 rounded-full bg-primary px-1 text-[10px] leading-4 font-semibold text-white tabular-nums">
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  )
}
