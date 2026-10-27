"use client"

import { useDeferredValue, useState } from "react"
import { cn } from "@/lib/utils"
import { localToday } from "@/lib/format"
import {
  useProspects,
  useProspectsMeta,
  type ProspectFilters,
} from "@/lib/queries"
import { STAGES, STAGE_LABEL, TIERS } from "@/lib/types"
import { ProspectList } from "@/components/prospect-list"
import { EmptyNote, PageHeader, PageSection } from "@/components/section"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"

export default function ProspectsPage() {
  const [filters, setFilters] = useState<ProspectFilters>({})
  const q = useDeferredValue(filters.q)
  const { data, isError } = useProspects({ ...filters, q })
  const { data: meta } = useProspectsMeta()
  const set = (k: keyof ProspectFilters) => (v: string) =>
    setFilters((f) => ({ ...f, [k]: v || undefined }))

  const total = meta
    ? Object.values(meta.stageCounts).reduce((a, b) => a + b, 0)
    : 0

  return (
    <>
      <PageHeader
        title="Prospects"
        description="Everyone in your pipeline. Filter by tier, group or stage."
      />
      <div className="flex flex-wrap gap-2">
        <Input
          type="search"
          aria-label="Search"
          placeholder="Search name, company, notes"
          className="min-w-0 flex-[2_1_14rem]"
          value={filters.q ?? ""}
          onChange={(e) => set("q")(e.target.value)}
        />
        <NativeSelect
          aria-label="Tier"
          className="flex-[1_1_8rem]"
          value={filters.tier ?? ""}
          onChange={(e) => set("tier")(e.target.value)}
        >
          <NativeSelectOption value="">All tiers</NativeSelectOption>
          {TIERS.map((t) => (
            <NativeSelectOption key={t} value={t}>
              Tier {t}
            </NativeSelectOption>
          ))}
          <NativeSelectOption value="NONE">Not rated</NativeSelectOption>
        </NativeSelect>
        <NativeSelect
          aria-label="Group"
          className="flex-[1_1_8rem]"
          value={filters.group ?? ""}
          onChange={(e) => set("group")(e.target.value)}
        >
          <NativeSelectOption value="">All groups</NativeSelectOption>
          {meta?.groups.map((g) => (
            <NativeSelectOption key={g} value={g}>
              {g}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div
        className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1"
        role="group"
        aria-label="Stage"
      >
        <StageChip
          label="All"
          count={total}
          active={!filters.stage}
          onClick={() => set("stage")("")}
        />
        {STAGES.map((s) => (
          <StageChip
            key={s}
            label={STAGE_LABEL[s]}
            count={meta?.stageCounts[s] ?? 0}
            active={filters.stage === s}
            onClick={() => set("stage")(filters.stage === s ? "" : s)}
          />
        ))}
      </div>

      <PageSection
        className="mt-5"
        title={
          filters.stage
            ? STAGE_LABEL[filters.stage as keyof typeof STAGE_LABEL]
            : "All stages"
        }
        count={data?.length}
      >
        {isError ? (
          <EmptyNote>
            Couldn&apos;t load prospects. Refresh to try again.
          </EmptyNote>
        ) : !data ? (
          <Skeleton className="h-64 w-full" />
        ) : data.length ? (
          <ProspectList items={data} today={localToday()} trailing="stage" />
        ) : (
          <EmptyNote>No prospects match these filters.</EmptyNote>
        )}
      </PageSection>
    </>
  )
}

function StageChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-lg border bg-card px-3 py-1.5 text-left text-xs text-muted-foreground shadow-xs transition-colors hover:bg-muted",
        active && "border-primary/50 bg-primary/8 text-primary"
      )}
    >
      <span className="block text-base font-semibold text-foreground tabular-nums">
        {count}
      </span>
      {label}
    </button>
  )
}
