"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react"
import { fillTemplate, PLACEHOLDERS } from "@/lib/templates"
import {
  useDeleteTemplate,
  useMe,
  useSaveTemplate,
  useTemplates,
} from "@/lib/queries"
import type { Template } from "@/lib/types"
import { EmptyNote, PageHeader } from "@/components/section"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"

const SAMPLE = { name: "Mrs. Adaeze Okafor", company: "Okafor Pharmacy" }

/** Placeholders rendered as small chips so they stand out in the list. */
function Highlighted({ text }: { text: string }) {
  return text.split(/(\{\w+\})/g).map((part, i) =>
    /^\{\w+\}$/.test(part) ? (
      <span
        key={i}
        className="rounded bg-brand/15 px-1 font-medium text-foreground"
      >
        {part}
      </span>
    ) : (
      part
    )
  )
}

export default function TemplatesPage() {
  const { data: templates, isError } = useTemplates()
  const remove = useDeleteTemplate()
  // undefined = closed, null = new, Template = editing.
  const [editing, setEditing] = useState<Template | null | undefined>()

  async function del(t: Template) {
    await remove.mutateAsync(t.id)
    toast.success(`Deleted "${t.name}"`)
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Message templates"
          description="Reusable messages you can send by WhatsApp, SMS or email from any prospect."
        />
        <Button onClick={() => setEditing(null)} className="shrink-0">
          <IconPlus data-icon="inline-start" /> New
        </Button>
      </div>

      {isError ? (
        <EmptyNote>
          Couldn&apos;t load templates. Refresh to try again.
        </EmptyNote>
      ) : !templates ? (
        <div className="grid gap-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : templates.length === 0 ? (
        <EmptyNote>No templates yet. Create your first one.</EmptyNote>
      ) : (
        <ul className="grid gap-3">
          {templates.map((t) => (
            <li
              key={t.id}
              className="group rounded-xl border bg-card p-4 shadow-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">{t.name}</h2>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${t.name}`}
                    onClick={() => setEditing(t)}
                  >
                    <IconPencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${t.name}`}
                    className="text-muted-foreground hover:text-destructive"
                    disabled={remove.isPending}
                    onClick={() => del(t)}
                  >
                    <IconTrash />
                  </Button>
                </div>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                <Highlighted text={t.body} />
              </p>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={editing !== undefined}
        onOpenChange={(o) => !o && setEditing(undefined)}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          {editing !== undefined && (
            <TemplateForm
              key={editing?.id ?? "new"}
              template={editing}
              onDone={() => setEditing(undefined)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function TemplateForm({
  template,
  onDone,
}: {
  template: Template | null
  onDone: () => void
}) {
  const { data: me } = useMe()
  const save = useSaveTemplate()
  const [name, setName] = useState(template?.name ?? "")
  const [body, setBody] = useState(template?.body ?? "")
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  function insert(token: string) {
    const el = bodyRef.current
    const start = el?.selectionStart ?? body.length
    const end = el?.selectionEnd ?? body.length
    setBody(body.slice(0, start) + token + body.slice(end))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + token.length, start + token.length)
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    await save.mutateAsync({ id: template?.id, name, body })
    toast.success(template ? "Template updated" : "Template created")
    onDone()
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <DialogHeader>
        <DialogTitle>{template ? "Edit template" : "New template"}</DialogTitle>
        <DialogDescription>
          Placeholders are filled in with the prospect&apos;s details when you
          send.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="tpl-name">Name</FieldLabel>
          <Input
            id="tpl-name"
            required
            maxLength={80}
            placeholder="e.g. Follow-up after visit"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="tpl-body">Message</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {PLACEHOLDERS.map(([token, label]) => (
              <button
                key={token}
                type="button"
                title={label}
                onClick={() => insert(token)}
                className="rounded-full border bg-brand/10 px-2 py-0.5 font-mono text-[11px] transition-colors hover:bg-brand/25"
              >
                {token}
              </button>
            ))}
          </div>
          <Textarea
            id="tpl-body"
            ref={bodyRef}
            required
            rows={6}
            maxLength={2000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          {body && (
            <FieldDescription className="rounded-lg bg-muted px-3 py-2 whitespace-pre-line">
              <span className="mb-1 block text-[11px] font-semibold tracking-wide uppercase">
                Preview
              </span>
              {fillTemplate(body, SAMPLE, me?.name)}
            </FieldDescription>
          )}
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  )
}
