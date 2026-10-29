"use client"

import { useMemo, useState } from "react"
import {
  IconAlertTriangle,
  IconSearch,
  IconUserPlus,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { clock, naira, niceDate, relativeDay } from "@/lib/format"
import { useApplyDebrief, useProspect, useProspects } from "@/lib/queries"
import {
  OUTCOME_LABEL,
  PRODUCT_LABEL,
  STAGE_LABEL,
  TOUCH_LABEL,
  type Debrief,
  type DebriefApplyItem,
  type DebriefSuggestion,
  type SuggestedTask,
} from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Chip } from "@/components/prospect-fields"

/** Who a card is about: a prospect already in the list, a new one, or not decided. */
type Target =
  | { kind: "existing"; id: string; name: string; company: string | null }
  | { kind: "new" }
  | { kind: "choose" }

type Change =
  | "contact"
  | "note"
  | "stage"
  | "potential"
  | "funded"
  | "tier"
  | "products"
  | "referral"
  | "next"

interface Draft {
  include: boolean
  target: Target
  newProspect: DebriefSuggestion["newProspect"]
  on: Record<Change, boolean>
  contactNote: string
  note: string
  nextAction: string
  nextDate: string
  nextTime: string
  /** Suggested to-dos, each one kept or not. */
  tasks: (SuggestedTask & { include: boolean })[]
}

function initialDraft(s: DebriefSuggestion): Draft {
  const picked = s.candidates.find((c) => c.id === s.prospectId)
  const target: Target =
    s.match === "NEW"
      ? { kind: "new" }
      : s.match === "EXISTING" && picked
        ? { kind: "existing", ...picked }
        : { kind: "choose" }
  return {
    include: true,
    target,
    newProspect: s.newProspect,
    on: {
      contact: !!s.contact,
      note: !!s.note && !s.contact,
      stage: !!s.stage,
      potential: s.potential !== null,
      funded: s.funded !== null,
      tier: !!s.tier,
      products: s.wantsProducts.length + s.holdsProducts.length > 0,
      referral: !!s.referredById,
      next: !!(s.nextAction || s.nextDate),
    },
    contactNote: s.contact?.note ?? "",
    note: s.note,
    nextAction: s.nextAction,
    nextDate: s.nextDate ?? "",
    nextTime: s.nextTime ?? "",
    tasks: (s.tasks ?? []).map((t) => ({ ...t, include: true })),
  }
}

/** The kept to-dos, in the shape the server takes. */
const keptTasks = (tasks: (SuggestedTask & { include: boolean })[]) =>
  tasks
    .filter((t) => t.include && t.title.trim())
    .map((t) => ({
      title: t.title.trim(),
      ...(t.dueDate && { dueDate: t.dueDate }),
      ...(t.dueDate && t.dueTime && { dueTime: t.dueTime }),
    }))

function toItem(s: DebriefSuggestion, d: Draft): DebriefApplyItem {
  const item: DebriefApplyItem = {}
  if (d.target.kind === "existing") item.prospectId = d.target.id
  else {
    const n = d.newProspect
    item.newProspect = {
      name: n.name.trim(),
      ...(n.company.trim() && { company: n.company.trim() }),
      ...(n.phone.trim() && { phone: n.phone.trim() }),
      ...(n.area.trim() && { area: n.area.trim() }),
    }
  }
  if (d.on.contact && s.contact)
    item.contact = {
      type: s.contact.type,
      date: s.contact.date,
      ...(s.contact.outcome && { outcome: s.contact.outcome }),
      ...(d.contactNote.trim() && { note: d.contactNote.trim() }),
    }
  if (d.on.note && d.note.trim()) item.note = d.note.trim()
  if (d.on.stage && s.stage) {
    item.stage = s.stage
    if (s.outcomeReason) item.outcomeReason = s.outcomeReason
  }
  if (d.on.potential && s.potential !== null) item.potential = s.potential
  if (d.on.funded && s.funded !== null) item.funded = s.funded
  if (d.on.tier && s.tier) item.tier = s.tier
  if (d.on.products) {
    if (s.wantsProducts.length) item.wantsProducts = s.wantsProducts
    if (s.holdsProducts.length) item.holdsProducts = s.holdsProducts
  }
  if (d.on.referral && s.referredById) item.referredById = s.referredById
  if (d.on.next) {
    if (d.nextAction.trim()) item.nextAction = d.nextAction.trim()
    if (d.nextDate) {
      item.nextDate = d.nextDate
      if (d.nextTime) item.nextTime = d.nextTime
    }
  }
  const tasks = keptTasks(d.tasks)
  if (tasks.length) item.tasks = tasks
  return item
}

/** Why a card can't be saved yet, if it can't. */
function problem(d: Draft) {
  if (!d.include) return null
  if (d.target.kind === "choose") return "Choose who this is"
  if (d.target.kind === "new" && !d.newProspect.name.trim())
    return "Enter the new prospect’s name"
  return null
}

export function DebriefReview({
  debrief,
  today,
}: {
  debrief: Debrief
  today: string
}) {
  const items = useMemo(() => debrief.result?.items ?? [], [debrief.result])
  const other = debrief.result?.other ?? []
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(items.map((s) => [s.key, initialDraft(s)]))
  )
  const apply = useApplyDebrief(debrief.id)
  const [general, setGeneral] = useState(() =>
    (debrief.result?.tasks ?? []).map((t) => ({ ...t, include: true }))
  )

  const included = items.filter((s) => drafts[s.key]?.include)
  const blocked = included
    .map((s) => problem(drafts[s.key]))
    .filter(Boolean).length

  const set = (key: string, patch: Partial<Draft>) =>
    setDrafts((all) => ({ ...all, [key]: { ...all[key], ...patch } }))

  function save() {
    apply.mutate({
      items: included.map((s) => toItem(s, drafts[s.key])),
      tasks: keptTasks(general),
    })
  }

  if (!items.length && !general.length)
    return (
      <div className="rounded-2xl border border-dashed p-8 text-center">
        <p className="font-medium">No one to update</p>
        <p className="mt-1 text-sm text-muted-foreground">
          We didn’t pick out any customers or prospects in this debrief. Edit
          the transcript below if a name was misheard, then read it again.
        </p>
        {other.length > 0 && <OtherNotes notes={other} />}
      </div>
    )

  return (
    <div className="pb-24">
      <p className="text-sm text-muted-foreground">
        Here’s what we heard. Untick anything that’s wrong, fix names, then
        save. Nothing changes until you press save.
      </p>
      <div className="mt-4 space-y-3">
        {items.map((s) => (
          <PersonCard
            key={s.key}
            s={s}
            d={drafts[s.key]}
            today={today}
            onChange={(patch) => set(s.key, patch)}
          />
        ))}
      </div>
      {general.length > 0 && (
        <div className="mt-6 rounded-xl border bg-card p-4">
          <p className="text-sm font-medium">Your to-dos</p>
          <p className="text-xs text-muted-foreground">
            Not about anyone in particular. Added to your to-do list.
          </p>
          <TaskChecks
            tasks={general}
            today={today}
            onChange={(i, patch) =>
              setGeneral((all) =>
                all.map((t, j) => (j === i ? { ...t, ...patch } : t))
              )
            }
          />
        </div>
      )}
      {other.length > 0 && <OtherNotes notes={other} />}

      <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {blocked
              ? `${blocked} card${blocked > 1 ? "s" : ""} need${blocked > 1 ? "" : "s"} a choice`
              : items.length
                ? `${included.length} of ${items.length} selected`
                : `${keptTasks(general).length} to-do${keptTasks(general).length === 1 ? "" : "s"}`}
          </p>
          <Button
            onClick={save}
            disabled={
              (!included.length && !keptTasks(general).length) ||
              blocked > 0 ||
              apply.isPending
            }
          >
            {apply.isPending
              ? "Saving…"
              : `Save ${included.length} ${included.length === 1 ? "person" : "people"}`}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Suggested to-dos, each with a tick to keep it and an editable title. */
function TaskChecks({
  tasks,
  today,
  onChange,
}: {
  tasks: (SuggestedTask & { include: boolean })[]
  today: string
  onChange: (
    index: number,
    patch: Partial<SuggestedTask & { include: boolean }>
  ) => void
}) {
  return (
    <ul className="mt-2 space-y-2">
      {tasks.map((t, i) => (
        <Row
          key={i}
          on={t.include}
          onToggle={() => onChange(i, { include: !t.include })}
        >
          <Input
            value={t.title}
            onChange={(e) => onChange(i, { title: e.target.value })}
            aria-label="To-do"
            maxLength={200}
            className="h-8"
          />
          {t.dueDate && (
            <p className="mt-1 text-xs text-muted-foreground">
              Due {relativeDay(t.dueDate, today)}
              {t.dueTime && `, ${clock(t.dueTime)}`}
            </p>
          )}
        </Row>
      ))}
    </ul>
  )
}

function OtherNotes({ notes }: { notes: string[] }) {
  return (
    <div className="mt-6 rounded-xl bg-muted/50 p-4 text-left">
      <p className="text-sm font-medium">Also mentioned</p>
      <p className="text-xs text-muted-foreground">
        Not about a particular person, so not saved anywhere.
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        {notes.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ul>
    </div>
  )
}

function PersonCard({
  s,
  d,
  today,
  onChange,
}: {
  s: DebriefSuggestion
  d: Draft
  today: string
  onChange: (patch: Partial<Draft>) => void
}) {
  const toggle = (c: Change) => onChange({ on: { ...d.on, [c]: !d.on[c] } })
  const title =
    d.target.kind === "existing"
      ? d.target.name
      : d.target.kind === "new"
        ? d.newProspect.name || s.mention
        : s.mention
  const issue = problem(d)

  return (
    <section
      className={cn(
        "rounded-2xl border bg-card p-4 transition-opacity",
        !d.include && "opacity-60"
      )}
    >
      <header className="flex items-start gap-3">
        <Checkbox
          className="mt-1"
          checked={d.include}
          onCheckedChange={(v) => onChange({ include: !!v })}
          aria-label={`Include ${title}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold">{title}</h3>
            {d.target.kind === "new" && (
              <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-medium text-brand-foreground dark:text-brand">
                New prospect
              </span>
            )}
          </div>
          {d.target.kind === "existing" && d.target.company && (
            <p className="text-sm text-muted-foreground">{d.target.company}</p>
          )}
          {s.mention.toLowerCase() !== title.toLowerCase() && (
            <p className="text-xs text-muted-foreground">
              You said “{s.mention}”
            </p>
          )}
        </div>
      </header>

      {d.include && (
        <div className="mt-3 space-y-3 pl-7">
          <MatchPicker s={s} d={d} onChange={onChange} />

          {issue && (
            <p className="flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-400">
              <IconAlertTriangle className="size-4" /> {issue}
            </p>
          )}
          {s.check.map((q, i) => (
            <p
              key={i}
              className="flex gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
            >
              <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
              {q}
            </p>
          ))}

          <ul className="space-y-2">
            {s.contact && (
              <Row on={d.on.contact} onToggle={() => toggle("contact")}>
                <span>
                  Log {TOUCH_LABEL[s.contact.type].toLowerCase()}{" "}
                  {s.contact.date === today
                    ? "today"
                    : `on ${niceDate(s.contact.date)}`}
                  {s.contact.outcome &&
                    ` · ${OUTCOME_LABEL[s.contact.outcome].toLowerCase()}`}
                </span>
                {d.on.contact && (
                  <Textarea
                    className="mt-1.5 min-h-16 text-sm"
                    value={d.contactNote}
                    onChange={(e) => onChange({ contactNote: e.target.value })}
                    placeholder="Note"
                  />
                )}
              </Row>
            )}
            {s.note && !s.contact && (
              <Row on={d.on.note} onToggle={() => toggle("note")}>
                <span>Add to notes</span>
                {d.on.note && (
                  <Textarea
                    className="mt-1.5 min-h-16 text-sm"
                    value={d.note}
                    onChange={(e) => onChange({ note: e.target.value })}
                  />
                )}
              </Row>
            )}
            {s.stage && (
              <Row on={d.on.stage} onToggle={() => toggle("stage")}>
                Move to <b>{STAGE_LABEL[s.stage]}</b>
                {s.outcomeReason && (
                  <span className="text-muted-foreground">
                    {" "}
                    · {s.outcomeReason}
                  </span>
                )}
              </Row>
            )}
            {s.potential !== null && (
              <Row on={d.on.potential} onToggle={() => toggle("potential")}>
                Potential balance <b>{naira(s.potential)}</b>
              </Row>
            )}
            {s.funded !== null && (
              <Row on={d.on.funded} onToggle={() => toggle("funded")}>
                Funded with <b>{naira(s.funded)}</b>
              </Row>
            )}
            {s.tier && (
              <Row on={d.on.tier} onToggle={() => toggle("tier")}>
                Tier <b>{s.tier}</b>
              </Row>
            )}
            {s.wantsProducts.length + s.holdsProducts.length > 0 && (
              <Row on={d.on.products} onToggle={() => toggle("products")}>
                {s.wantsProducts.length > 0 && (
                  <span>
                    Interested in{" "}
                    {s.wantsProducts.map((p) => PRODUCT_LABEL[p]).join(", ")}
                  </span>
                )}
                {s.wantsProducts.length > 0 &&
                  s.holdsProducts.length > 0 &&
                  " · "}
                {s.holdsProducts.length > 0 && (
                  <span>
                    Has{" "}
                    {s.holdsProducts.map((p) => PRODUCT_LABEL[p]).join(", ")}
                  </span>
                )}
              </Row>
            )}
            {s.referredById && (
              <Row on={d.on.referral} onToggle={() => toggle("referral")}>
                Referred by <ReferrerName id={s.referredById} />
              </Row>
            )}
            {(s.nextAction || s.nextDate) && (
              <Row on={d.on.next} onToggle={() => toggle("next")}>
                <span>Next step</span>
                {d.on.next && (
                  <div className="mt-1.5 space-y-2">
                    <Input
                      value={d.nextAction}
                      onChange={(e) => onChange({ nextAction: e.target.value })}
                      placeholder="What to do"
                    />
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        className="flex-1"
                        value={d.nextDate}
                        min={today}
                        onChange={(e) =>
                          onChange({
                            nextDate: e.target.value,
                            ...(!e.target.value && { nextTime: "" }),
                          })
                        }
                        aria-label="Date"
                      />
                      <Input
                        type="time"
                        className="w-32"
                        value={d.nextTime}
                        disabled={!d.nextDate}
                        onChange={(e) => onChange({ nextTime: e.target.value })}
                        aria-label="Time"
                      />
                    </div>
                    {d.nextTime && (
                      <p className="text-xs text-muted-foreground">
                        You’ll get a reminder before this.
                      </p>
                    )}
                  </div>
                )}
              </Row>
            )}
          </ul>
          {d.tasks.length > 0 && (
            <div className="mt-3 border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground">
                To-dos for this person
              </p>
              <TaskChecks
                tasks={d.tasks}
                today={today}
                onChange={(i, patch) =>
                  onChange({
                    tasks: d.tasks.map((t, j) =>
                      j === i ? { ...t, ...patch } : t
                    ),
                  })
                }
              />
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function Row({
  on,
  onToggle,
  children,
}: {
  on: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <Checkbox className="mt-0.5" checked={on} onCheckedChange={onToggle} />
      <div
        className={cn(
          "min-w-0 flex-1",
          !on &&
            "text-muted-foreground line-through decoration-muted-foreground/50"
        )}
      >
        {children}
      </div>
    </li>
  )
}

function ReferrerName({ id }: { id: string }) {
  const { data } = useProspect(id)
  return <b>{data?.name ?? "…"}</b>
}

/** Confirm, change or create who a card is about. */
function MatchPicker({
  s,
  d,
  onChange,
}: {
  s: DebriefSuggestion
  d: Draft
  onChange: (patch: Partial<Draft>) => void
}) {
  const [searching, setSearching] = useState(false)
  const [q, setQ] = useState("")
  const results = useProspects({ q: q.trim().length >= 2 ? q.trim() : "" })
  const showChoices =
    d.target.kind === "choose" || s.match === "UNSURE" || searching

  const pickExisting = (p: {
    id: string
    name: string
    company: string | null
  }) => {
    onChange({ target: { kind: "existing", ...p } })
    setSearching(false)
    setQ("")
  }

  return (
    <div className="space-y-2">
      {showChoices && (
        <div className="flex flex-wrap gap-1.5">
          {s.candidates.map((c) => (
            <Chip
              key={c.id}
              active={d.target.kind === "existing" && d.target.id === c.id}
              onClick={() => pickExisting(c)}
            >
              {c.name}
              {c.company && (
                <span className="text-muted-foreground"> · {c.company}</span>
              )}
            </Chip>
          ))}
          <Chip
            active={d.target.kind === "new"}
            onClick={() => {
              onChange({ target: { kind: "new" } })
              setSearching(false)
            }}
          >
            <IconUserPlus className="-mt-0.5 mr-1 inline size-3.5" />
            New prospect
          </Chip>
        </div>
      )}

      {searching ? (
        <div>
          <div className="relative">
            <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              className="pl-8"
              placeholder="Search your list"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {q.trim().length >= 2 && (
            <ul className="mt-1 max-h-48 overflow-y-auto rounded-lg border">
              {(results.data ?? []).slice(0, 8).map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => pickExisting(p)}
                  >
                    {p.name}
                    {p.company && (
                      <span className="text-muted-foreground">
                        {" "}
                        · {p.company}
                      </span>
                    )}
                  </button>
                </li>
              ))}
              {results.data?.length === 0 && (
                <li className="px-3 py-2 text-sm text-muted-foreground">
                  No one found
                </li>
              )}
            </ul>
          )}
        </div>
      ) : (
        <button
          type="button"
          className="text-xs font-medium text-primary hover:underline dark:text-brand"
          onClick={() => setSearching(true)}
        >
          {d.target.kind === "existing"
            ? "Not them? Pick someone else"
            : "Find in my list"}
        </button>
      )}

      {d.target.kind === "new" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            value={d.newProspect.name}
            onChange={(e) =>
              onChange({
                newProspect: { ...d.newProspect, name: e.target.value },
              })
            }
            placeholder="Name"
            aria-label="Name"
          />
          <Input
            value={d.newProspect.company}
            onChange={(e) =>
              onChange({
                newProspect: { ...d.newProspect, company: e.target.value },
              })
            }
            placeholder="Company (optional)"
            aria-label="Company"
          />
          <Input
            value={d.newProspect.phone}
            inputMode="tel"
            onChange={(e) =>
              onChange({
                newProspect: { ...d.newProspect, phone: e.target.value },
              })
            }
            placeholder="Phone (optional)"
            aria-label="Phone"
          />
          <Input
            value={d.newProspect.area}
            onChange={(e) =>
              onChange({
                newProspect: { ...d.newProspect, area: e.target.value },
              })
            }
            placeholder="Area (optional)"
            aria-label="Area"
          />
        </div>
      )}
    </div>
  )
}
