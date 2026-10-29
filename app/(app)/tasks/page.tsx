"use client"

import { useState } from "react"
import { localToday, addDays } from "@/lib/format"
import { useTasks } from "@/lib/queries"
import type { Task } from "@/lib/types"
import { EmptyNote, PageHeader, PageSection } from "@/components/section"
import { QuickAddTask, TaskList } from "@/components/tasks"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

type Filter = "all" | "general" | "prospects"

const FILTERS: [Filter, string][] = [
  ["all", "All"],
  ["general", "General"],
  ["prospects", "Prospects"],
]

export default function TasksPage() {
  const today = localToday()
  const { data, isError } = useTasks("open")
  const [filter, setFilter] = useState<Filter>("all")
  const [showDone, setShowDone] = useState(false)

  const tasks = (data ?? []).filter((t) =>
    filter === "general"
      ? !t.prospect
      : filter === "prospects"
        ? !!t.prospect
        : true
  )
  // A ticked task stays (struck through) until the list refreshes, so a
  // mis-tap can be undone where it was.
  const open = tasks
  const weekOut = addDays(today, 7)
  const groups: [string, Task[]][] = [
    ["Overdue", open.filter((t) => t.dueDate && t.dueDate < today)],
    ["Today", open.filter((t) => t.dueDate === today)],
    [
      "Next 7 days",
      open.filter(
        (t) => t.dueDate && t.dueDate > today && t.dueDate <= weekOut
      ),
    ],
    ["Later", open.filter((t) => t.dueDate && t.dueDate > weekOut)],
    ["Anytime", open.filter((t) => !t.dueDate)],
  ]

  return (
    <>
      <PageHeader
        title="To do"
        description="Your own jobs and the ones for each prospect, in one list. Type it the way you'd say it: “Collect CAC docs from Musa Friday 10am”."
      />
      <QuickAddTask />

      <div className="mt-4 flex gap-1.5" role="group" aria-label="Show">
        {FILTERS.map(([f, label]) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
          >
            {label}
          </Button>
        ))}
      </div>

      {isError ? (
        <EmptyNote>
          Couldn&apos;t load your to-dos. Refresh to try again.
        </EmptyNote>
      ) : !data ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : open.length === 0 ? (
        <div className="mt-6">
          <EmptyNote>
            Nothing to do{filter !== "all" ? " here" : ""}. Add one above, or
            say it in a debrief and it&apos;ll land here.
          </EmptyNote>
        </div>
      ) : (
        groups
          .filter(([, list]) => list.length)
          .map(([title, list]) => (
            <PageSection key={title} title={title} count={list.length}>
              <TaskList tasks={list} today={today} />
            </PageSection>
          ))
      )}

      <div className="mt-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDone((s) => !s)}
        >
          {showDone ? "Hide done" : "Show done"}
        </Button>
        {showDone && <Done today={today} filter={filter} />}
      </div>
    </>
  )
}

function Done({ today, filter }: { today: string; filter: Filter }) {
  const { data } = useTasks("done")
  if (!data) return <Skeleton className="mt-3 h-24 w-full" />
  const list = data.filter((t) =>
    filter === "general"
      ? !t.prospect
      : filter === "prospects"
        ? !!t.prospect
        : true
  )
  return list.length ? (
    <TaskList tasks={list} today={today} className="mt-3" />
  ) : (
    <p className="mt-3 text-sm text-muted-foreground">
      Nothing ticked off yet.
    </p>
  )
}
