"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import {
  IconBolt,
  IconChartBar,
  IconLayoutKanban,
  IconMessageDots,
  IconPlus,
  IconSettings,
  IconSun,
  IconUsers,
  type Icon,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { initials } from "@/lib/format"
import { useMe, useToday } from "@/lib/queries"
import { useMediaQuery } from "@/hooks/use-media-query"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { ProspectPanel, useOpenProspect } from "@/components/prospect-sheet"
import { QuickLogProvider } from "@/components/quick-log"
import { BrandLockup } from "@/components/brand"
import { GoalWatcher } from "@/components/goal-card"
import { MessageProvider } from "@/components/message-dialog"

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

const isActive = (href: string, pathname: string) =>
  href === "/" ? pathname === "/" : pathname.startsWith(href)

export function AppShell({ children }: { children: React.ReactNode }) {
  const params = useSearchParams()
  const open = useOpenProspect()
  const wide = useMediaQuery("(min-width: 1280px)")
  const tablet = useMediaQuery("(min-width: 768px)")
  const id = params.get("p")
  const pathname = usePathname()
  const fullWidth = pathname.startsWith("/pipeline")

  return (
    <QuickLogProvider>
      <MessageProvider>
        <GoalWatcher />
        <div className="min-h-svh lg:grid lg:grid-cols-[15.5rem_1fr]">
          <Sidebar onAdd={() => open("new")} />

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
          onClick={() => open("new")}
          aria-label="Add prospect"
          className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 size-14 rounded-full shadow-lg lg:hidden"
        >
          <IconPlus className="size-6" />
        </Button>

        {!wide && (
          <Sheet open={!!id} onOpenChange={(o) => !o && open(null)}>
            <SheetContent
              side={tablet ? "right" : "bottom"}
              className={cn(
                "gap-0 overflow-y-auto p-0",
                tablet ? "w-full sm:max-w-lg" : "max-h-[92dvh] rounded-t-2xl"
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
      </MessageProvider>
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

  return (
    <aside className="sticky top-0 hidden h-svh flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 text-sidebar-foreground lg:flex">
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
      <Link
        href="/templates"
        aria-current={pathname === "/templates" ? "page" : undefined}
        className={cn(
          "mt-1 flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          pathname === "/templates" &&
            "bg-sidebar-accent text-sidebar-accent-foreground"
        )}
      >
        <IconMessageDots
          className={cn(
            "size-[18px]",
            pathname === "/templates" && "text-sidebar-primary"
          )}
        />
        Message templates
      </Link>

      <div className="mt-auto border-t border-sidebar-border pt-3">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-sidebar-accent",
            pathname === "/settings" && "bg-sidebar-accent"
          )}
        >
          <span className="grid size-8 place-items-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
            {me ? initials(me.name) : ""}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {me?.name ?? " "}
            </span>
            <span className="block truncate text-xs text-sidebar-foreground/60">
              {me?.email ?? " "}
            </span>
          </span>
          <IconSettings className="size-4 text-sidebar-foreground/60" />
        </Link>
      </div>
    </aside>
  )
}

function MobileHeader() {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/90 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur lg:hidden">
      <Brand />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Settings"
        nativeButton={false}
        render={<Link href="/settings" />}
      >
        <IconSettings />
      </Button>
    </header>
  )
}

function MobileTabBar() {
  const pathname = usePathname()
  const nav = useNav()
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
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
              <item.icon className="size-[22px]" stroke={active ? 2.2 : 1.8} />
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
    </nav>
  )
}
