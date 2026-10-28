"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"
import { useRouter } from "next/navigation"
import { defaultFilter } from "cmdk"
import {
  IconBolt,
  IconCash,
  IconChartBar,
  IconFileImport,
  IconLayoutKanban,
  IconMap2,
  IconMessageDots,
  IconMicrophone,
  IconPlus,
  IconReportAnalytics,
  IconRoute,
  IconSettings,
  IconShieldLock,
  IconSun,
  IconUser,
  IconUsers,
  IconUsersGroup,
  type Icon,
} from "@tabler/icons-react"
import { useProspects } from "@/lib/queries"
import { STAGE_LABEL } from "@/lib/types"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import { ProspectAvatar } from "@/components/prospect-avatar"
import { useOpenProspect } from "@/components/prospect-sheet"
import { useAddProspect } from "@/components/add-prospect"

export const PAGES: {
  href: string
  label: string
  icon: Icon
  keywords?: string
}[] = [
  { href: "/", label: "Today", icon: IconSun, keywords: "home due calls" },
  {
    href: "/debrief",
    label: "Debrief",
    icon: IconMicrophone,
    keywords: "record voice day summary speak",
  },
  {
    href: "/prospects",
    label: "Prospects",
    icon: IconUsers,
    keywords: "list all",
  },
  {
    href: "/pipeline",
    label: "Pipeline",
    icon: IconLayoutKanban,
    keywords: "board stages",
  },
  {
    href: "/triage",
    label: "Rate & plan",
    icon: IconBolt,
    keywords: "triage tier",
  },
  {
    href: "/progress",
    label: "Progress",
    icon: IconChartBar,
    keywords: "target forecast",
  },
  {
    href: "/balances",
    label: "Balances",
    icon: IconCash,
    keywords: "deposits month",
  },
  {
    href: "/visits",
    label: "Visits",
    icon: IconMap2,
    keywords: "map route area",
  },
  {
    href: "/plans",
    label: "Follow-up plans",
    icon: IconRoute,
    keywords: "cadence sequence",
  },
  { href: "/templates", label: "Message templates", icon: IconMessageDots },
  {
    href: "/report",
    label: "Weekly report",
    icon: IconReportAnalytics,
    keywords: "manager",
  },
  {
    href: "/import",
    label: "Import and export",
    icon: IconFileImport,
    keywords: "csv excel",
  },
  {
    href: "/team",
    label: "Team",
    icon: IconUsersGroup,
    keywords: "leaderboard",
  },
  {
    href: "/security",
    label: "Security",
    icon: IconShieldLock,
    keywords: "two-step 2fa devices",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: IconSettings,
    keywords: "notifications calendar",
  },
  {
    href: "/profile",
    label: "Profile",
    icon: IconUser,
    keywords: "password photo",
  },
]

const PaletteContext = createContext<() => void>(() => {})

/** Opens the search-everything palette (also Ctrl/⌘ K). */
export const useCommandPalette = () => useContext(PaletteContext)

export function CommandPaletteProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const show = useCallback(() => setOpen(true), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  return (
    <PaletteContext.Provider value={show}>
      {children}
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search"
        description="Find a prospect or go to a page"
      >
        {open && <Palette onDone={() => setOpen(false)} />}
      </CommandDialog>
    </PaletteContext.Provider>
  )
}

const ID = / [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Digits only, with +234 written as a leading 0: "+234 803 123" -> "0803123". */
const localDigits = (s: string) => {
  const d = s.replace(/\D/g, "")
  return d.startsWith("234") ? `0${d.slice(3)}` : d
}

/**
 * Numbers match the phone exactly (fuzzy matching finds "0803" scattered
 * across any number); everything else uses the usual fuzzy search.
 */
function search(value: string, query: string, keywords?: string[]) {
  const digits = localDigits(query)
  if (/^[+\d\s().-]+$/.test(query.trim()) && digits.length >= 3)
    return keywords?.some((k) => k.includes(digits)) ? 1 : 0
  // The id only keeps values unique; its letters shouldn't match anything.
  return defaultFilter(value.replace(ID, ""), query, keywords)
}

function Palette({ onDone }: { onDone: () => void }) {
  const router = useRouter()
  const openProspect = useOpenProspect()
  const addProspect = useAddProspect()
  const { data: prospects } = useProspects({})

  const run = (fn: () => void) => () => {
    onDone()
    fn()
  }

  return (
    <Command filter={search}>
      <CommandInput placeholder="Search prospects, phone numbers, pages…" />
      <CommandList className="max-h-[min(60dvh,26rem)]">
        <CommandEmpty>Nothing found.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem value="add new prospect" onSelect={run(addProspect)}>
            <IconPlus /> Add prospect
          </CommandItem>
        </CommandGroup>
        {prospects && prospects.length > 0 && (
          <CommandGroup heading="Prospects">
            {prospects.map((p) => (
              <CommandItem
                key={p.id}
                value={`${p.name} ${p.company ?? ""} ${p.email ?? ""} ${p.group ?? ""} ${p.area ?? ""} ${p.id}`}
                keywords={p.phone ? [localDigits(p.phone)] : undefined}
                onSelect={run(() => openProspect(p.id))}
              >
                <ProspectAvatar name={p.name} tier={p.tier} size="sm" />
                <span className="min-w-0 flex-1 truncate">
                  {p.name}
                  {p.company && (
                    <span className="text-muted-foreground">
                      {" "}
                      · {p.company}
                    </span>
                  )}
                </span>
                <CommandShortcut>{STAGE_LABEL[p.stage]}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading="Go to">
          {PAGES.map((page) => (
            <CommandItem
              key={page.href}
              value={`${page.label} ${page.keywords ?? ""}`}
              onSelect={run(() => router.push(page.href))}
            >
              <page.icon /> {page.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  )
}
