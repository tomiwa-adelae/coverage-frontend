"use client"

import { useState } from "react"
import {
  IconCalendar,
  IconFileCheck,
  IconClock,
  IconPlus,
  IconRepeat,
  IconTrash,
  IconUser,
  IconX,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { clock, localToday, relativeDay } from "@/lib/format"
import { parseTask } from "@/lib/quick-task"
import {
  useAddChecklist,
  useCreateTask,
  useDeleteTask,
  useProspects,
  useUpdateTask,
} from "@/lib/queries"
import {
  REPEAT_LABEL,
  type ChecklistKind,
  type ProspectDetail,
  type Repeat,
  type Task,
} from "@/lib/types"
import { useOpenProspect } from "@/components/prospect-sheet"
import { DictateButton, appendText, useDictation } from "@/components/dictate"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

/** Ticks a task, saying so when ticking it scheduled the next repeat. */
export function useToggleTask() {
  const update = useUpdateTask()
  return (t: Task) =>
    update.mutate(
      { id: t.id, done: !t.doneAt },
      {
        onSuccess: (res) => {
          if (res.next?.dueDate)
            toast.success(
              `Next one set for ${relativeDay(res.next.dueDate, localToday())}`
            )
        },
      }
    )
}

export function TaskRow({
  task,
  today,
  hideProspect,
}: {
  task: Task
  today: string
  hideProspect?: boolean
}) {
  const toggle = useToggleTask()
  const open = useOpenProspect()
  const [editing, setEditing] = useState(false)
  const done = !!task.doneAt
  const late = !done && task.dueDate && task.dueDate < today

  return (
    <li className="flex items-start gap-3 px-3 py-2.5">
      <Checkbox
        checked={done}
        onCheckedChange={() => toggle(task)}
        aria-label={
          done ? `Mark “${task.title}” not done` : `Mark “${task.title}” done`
        }
        className="mt-0.5 size-5 rounded-full"
      />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={cn(
            "block w-full text-left text-sm",
            done && "text-muted-foreground line-through"
          )}
        >
          {task.title}
        </button>
        {(task.dueDate || task.repeat || (task.prospect && !hideProspect)) && (
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {task.dueDate && (
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  late && "font-medium text-destructive"
                )}
              >
                <IconCalendar className="size-3.5" />
                {relativeDay(task.dueDate, today)}
                {task.dueTime && `, ${clock(task.dueTime)}`}
              </span>
            )}
            {task.repeat && (
              <span className="inline-flex items-center gap-1">
                <IconRepeat className="size-3.5" />
                {REPEAT_LABEL[task.repeat]}
              </span>
            )}
            {task.prospect && !hideProspect && (
              <button
                type="button"
                onClick={() => open(task.prospect!.id)}
                className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
              >
                <IconUser className="size-3.5" />
                {task.prospect.name}
              </button>
            )}
          </p>
        )}
      </div>
      {editing && <TaskDialog task={task} onClose={() => setEditing(false)} />}
    </li>
  )
}

export function TaskList({
  tasks,
  today,
  hideProspect,
  className,
}: {
  tasks: Task[]
  today: string
  hideProspect?: boolean
  className?: string
}) {
  return (
    <ul className={cn("divide-y rounded-xl border bg-card", className)}>
      {tasks.map((t) => (
        <TaskRow
          key={t.id}
          task={t}
          today={today}
          hideProspect={hideProspect}
        />
      ))}
    </ul>
  )
}

/**
 * One line to add a to-do in plain words ("Collect CAC docs from Musa Friday
 * 10am"). What it understood shows underneath and can be removed.
 */
export function QuickAddTask({
  prospect,
  placeholder = "Add a to-do, e.g. “Collect utility bill from Musa Friday 10am”",
  autoFocus,
}: {
  /** Fixed prospect (on a prospect card); otherwise found from the text. */
  prospect?: { id: string; name: string }
  placeholder?: string
  autoFocus?: boolean
}) {
  const [text, setText] = useState("")
  const [dropped, setDropped] = useState<Set<string>>(new Set())
  const { data: prospects } = useProspects({})
  const create = useCreateTask()
  const dictation = useDictation((t) => setText((cur) => appendText(cur, t)))
  const today = localToday()

  const parsed = parseTask(text, today, prospect ? [] : (prospects ?? []))
  const keep = (k: string) => !dropped.has(k)
  // Removing a chip puts its words back in the title.
  const title = dropped.size ? text.trim() : parsed.title
  const dueDate = keep("date") ? parsed.dueDate : null
  const who = prospect ?? (keep("who") ? parsed.prospect : null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    dictation.stop()
    const draft = text
    // Cleared at once; it shows in the list even with no signal.
    setText("")
    setDropped(new Set())
    create.mutate(
      {
        id: crypto.randomUUID(),
        title: title.trim(),
        dueDate,
        dueTime: dueDate && keep("time") ? parsed.dueTime : null,
        repeat: dueDate && keep("repeat") ? parsed.repeat : null,
        prospectId: who?.id ?? null,
      },
      { onError: () => setText((cur) => cur || draft) }
    )
  }

  const chips = [
    dueDate && {
      k: "date",
      icon: IconCalendar,
      label: relativeDay(dueDate, today),
    },
    dueDate &&
      parsed.dueTime &&
      keep("time") && {
        k: "time",
        icon: IconClock,
        label: clock(parsed.dueTime),
      },
    dueDate &&
      parsed.repeat &&
      keep("repeat") && {
        k: "repeat",
        icon: IconRepeat,
        label: REPEAT_LABEL[parsed.repeat],
      },
    !prospect && who && { k: "who", icon: IconUser, label: who.name },
  ].filter(Boolean) as { k: string; icon: typeof IconCalendar; label: string }[]

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            if (!e.target.value) setDropped(new Set())
          }}
          placeholder={placeholder}
          aria-label="New to-do"
          autoFocus={autoFocus}
          maxLength={200}
          enterKeyHint="done"
        />
        <DictateButton dictation={dictation} className="shrink-0" />
        <Button
          type="submit"
          size="icon"
          disabled={!title.trim() || create.isPending}
          aria-label="Add to-do"
          className="shrink-0"
        >
          <IconPlus />
        </Button>
      </div>
      {text.trim() && chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map(({ k, icon: Icon, label }) => (
            <span
              key={k}
              className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pr-1 pl-2 text-xs"
            >
              <Icon className="size-3.5" />
              {label}
              <button
                type="button"
                onClick={() => setDropped((d) => new Set(d).add(k))}
                aria-label={`Remove ${label}`}
                className="rounded-full p-0.5 hover:bg-background"
              >
                <IconX className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </form>
  )
}

function TaskDialog({ task, onClose }: { task: Task; onClose: () => void }) {
  const update = useUpdateTask()
  const remove = useDeleteTask()
  const [title, setTitle] = useState(task.title)
  const [dueDate, setDueDate] = useState(task.dueDate ?? "")
  const [dueTime, setDueTime] = useState(task.dueTime ?? "")
  const [repeat, setRepeat] = useState<Repeat | "">(task.repeat ?? "")

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    update.mutate(
      {
        id: task.id,
        title: title.trim(),
        dueDate: dueDate || null,
        dueTime: dueDate && dueTime ? dueTime : null,
        repeat: dueDate && repeat ? repeat : null,
      },
      { onSuccess: onClose }
    )
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={save} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Edit to-do</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="task-title">What needs doing</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-date">Date</Label>
              <Input
                id="task-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-time">Time (reminder)</Label>
              <Input
                id="task-time"
                type="time"
                value={dueTime}
                disabled={!dueDate}
                onChange={(e) => setDueTime(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-repeat">Repeat</Label>
            <NativeSelect
              id="task-repeat"
              value={repeat}
              disabled={!dueDate}
              onChange={(e) => setRepeat(e.target.value as Repeat | "")}
              className="w-full"
            >
              <NativeSelectOption value="">Doesn’t repeat</NativeSelectOption>
              {(Object.keys(REPEAT_LABEL) as Repeat[]).map((r) => (
                <NativeSelectOption key={r} value={r}>
                  {REPEAT_LABEL[r]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          {task.prospect && (
            <p className="text-sm text-muted-foreground">
              For {task.prospect.name}
            </p>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              className="text-destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate(task.id, { onSuccess: onClose })}
            >
              <IconTrash data-icon="inline-start" /> Delete
            </Button>
            <Button type="submit" disabled={!title.trim() || update.isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const CHECKLIST_LABEL: Record<ChecklistKind, string> = {
  INDIVIDUAL: "personal account",
  BUSINESS: "business account",
}

/**
 * A prospect's to-dos on their card: the account-opening documents (with
 * progress) and anything else to do for them. Ticked ones move to Activity.
 */
export function ProspectTasks({
  prospect,
  today,
}: {
  prospect: ProspectDetail
  today: string
}) {
  const add = useAddChecklist(prospect.id)
  const docs = prospect.tasks.filter((t) => t.checklist)
  const kind = docs[0]?.checklist ?? null
  const collected = docs.filter((t) => t.doneAt).length
  const others = prospect.tasks.filter((t) => !t.checklist && !t.doneAt)
  const other: ChecklistKind = kind === "BUSINESS" ? "INDIVIDUAL" : "BUSINESS"

  return (
    <div className="space-y-3">
      {others.length > 0 && (
        <TaskList tasks={others} today={today} hideProspect />
      )}
      <QuickAddTask
        prospect={prospect}
        placeholder={`Add a to-do for ${prospect.name.split(" ")[0]}, e.g. “Send forms Friday”`}
      />

      {kind ? (
        <div className="rounded-xl border bg-card">
          <div className="p-3 pb-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium">
                Documents for a {CHECKLIST_LABEL[kind]}
              </span>
              <span className="text-muted-foreground tabular-nums">
                {collected} of {docs.length}
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={collected}
              aria-valuemin={0}
              aria-valuemax={docs.length}
              aria-label="Documents collected"
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-success transition-[width]"
                style={{ width: `${(collected / docs.length) * 100}%` }}
              />
            </div>
          </div>
          <ul className="divide-y border-t">
            {docs.map((t) => (
              <TaskRow key={t.id} task={t} today={today} hideProspect />
            ))}
          </ul>
          {collected === 0 && (
            <button
              type="button"
              disabled={add.isPending}
              onClick={() => add.mutate(other)}
              className="w-full border-t px-3 py-2 text-left text-xs text-muted-foreground hover:text-foreground"
            >
              Opening a {CHECKLIST_LABEL[other]} instead? Switch the list
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <IconFileCheck className="size-4" />
          Account-opening documents:
          <Button
            size="xs"
            variant="outline"
            disabled={add.isPending}
            onClick={() => add.mutate("INDIVIDUAL")}
          >
            Personal
          </Button>
          <Button
            size="xs"
            variant="outline"
            disabled={add.isPending}
            onClick={() => add.mutate("BUSINESS")}
          >
            Business
          </Button>
        </div>
      )}
    </div>
  )
}
