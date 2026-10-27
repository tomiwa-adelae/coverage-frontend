"use client"

import { createContext, useCallback, useContext, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  IconBrandWhatsapp,
  IconCopy,
  IconLoader2,
  IconSend,
  IconMessage,
  IconSparkles,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { whatsappNumber } from "@/lib/contact"
import { fillTemplate } from "@/lib/templates"
import {
  useAiStatus,
  useDraft,
  useMe,
  useProspectsMeta,
  useSendEmail,
  useSendSms,
  useTemplates,
} from "@/lib/queries"
import type { Prospect, Touch } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useQuickLogDialog } from "@/components/quick-log"

const MessageContext = createContext<(p: Prospect) => void>(() => {})

/** Open the "send a template message" dialog for a prospect. */
export const useMessageDialog = () => useContext(MessageContext)

export function MessageProvider({ children }: { children: React.ReactNode }) {
  const [prospect, setProspect] = useState<Prospect | null>(null)
  const open = useCallback((p: Prospect) => setProspect(p), [])

  return (
    <MessageContext.Provider value={open}>
      {children}
      <Dialog open={!!prospect} onOpenChange={(o) => !o && setProspect(null)}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          {prospect && (
            <MessageForm
              key={prospect.id}
              prospect={prospect}
              onDone={() => setProspect(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </MessageContext.Provider>
  )
}

function MessageForm({
  prospect,
  onDone,
}: {
  prospect: Prospect
  onDone: () => void
}) {
  const { data: templates } = useTemplates()
  const { data: me } = useMe()
  const quickLog = useQuickLogDialog()
  const [selected, setSelected] = useState<string | null>(null)
  // Null until the user edits, so the preview follows the template (and the name once loaded).
  const [edited, setEdited] = useState<string | null>(null)
  const [subject, setSubject] = useState<string | null>(null)
  const sendEmail = useSendEmail(prospect.id)
  const sendSms = useSendSms(prospect.id)
  const { data: meta } = useProspectsMeta()
  const { data: ai } = useAiStatus()
  const draft = useDraft()
  const [aiOpen, setAiOpen] = useState(false)
  const [goal, setGoal] = useState("")
  const [aiChannel, setAiChannel] = useState<"WHATSAPP" | "EMAIL" | "SMS">(
    prospect.phone ? "WHATSAPP" : "EMAIL"
  )

  const current =
    selected === "ai"
      ? null
      : (templates?.find((t) => t.id === selected) ?? templates?.[0] ?? null)
  const text =
    edited ?? (current ? fillTemplate(current.body, prospect, me?.name) : "")

  const emailSubject = subject ?? current?.name ?? ""

  function pick(id: string) {
    setSelected(id)
    setEdited(null)
    setSubject(null)
    setAiOpen(false)
  }

  async function writeWithAi() {
    try {
      const d = await draft.mutateAsync({
        prospectId: prospect.id,
        channel: aiChannel,
        goal: goal.trim() || undefined,
      })
      setSelected("ai")
      setEdited(d.body)
      if (d.subject) setSubject(d.subject)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  /** Sends through the bank's SMS gateway; the API logs it as an SMS contact. */
  async function smsNow() {
    if (!text.trim()) return toast.error("Write a message first.")
    try {
      await sendSms.mutateAsync({ body: text })
      toast.success(`SMS sent to ${prospect.name}`, {
        description: "Logged on their timeline.",
      })
      onDone()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  /** Sends straight from Coverage; the API logs it as an email contact. */
  async function emailNow() {
    if (!emailSubject.trim()) return toast.error("Add a subject first.")
    if (!text.trim()) return toast.error("Write a message first.")
    try {
      await sendEmail.mutateAsync({ subject: emailSubject, body: text })
      toast.success(`Email sent to ${prospect.name}`, {
        description: "Logged on their timeline. Replies go to your inbox.",
      })
      onDone()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  /** After the message app opens, offer to record the contact. */
  function sent(type: Touch) {
    onDone()
    toast("Message sent?", {
      description: `Log it against ${prospect.name}.`,
      action: {
        label: "Log contact",
        onClick: () =>
          quickLog(prospect, {
            type,
            note: current ? `Sent "${current.name}"` : undefined,
          }),
      },
      duration: 10_000,
    })
  }

  async function copy() {
    await navigator.clipboard.writeText(text)
    toast.success("Message copied")
  }

  const phone = prospect.phone
  const body = encodeURIComponent(text)

  return (
    <div className="grid gap-5">
      <DialogHeader>
        <DialogTitle>Send a message</DialogTitle>
        <DialogDescription>{prospect.name}</DialogDescription>
      </DialogHeader>

      {!templates ? (
        <Skeleton className="h-40" />
      ) : (
        <>
          {templates.length === 0 && (
            <p className="text-sm text-muted-foreground">
              You have no templates yet.{" "}
              <Link
                href="/templates"
                className="text-primary underline"
                onClick={onDone}
              >
                Create one
              </Link>{" "}
              or write a message below.
            </p>
          )}
          <div
            className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
            role="group"
            aria-label="Template"
          >
            {ai?.enabled && (
              <button
                type="button"
                aria-pressed={aiOpen || selected === "ai"}
                onClick={() => setAiOpen((o) => !o)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/40 px-3 py-1 text-xs font-medium whitespace-nowrap text-primary transition-colors hover:bg-primary/10",
                  (aiOpen || selected === "ai") && "bg-primary/10"
                )}
              >
                <IconSparkles className="size-3.5" /> Write with AI
              </button>
            )}
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={current?.id === t.id}
                onClick={() => pick(t.id)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors hover:bg-muted",
                  current?.id === t.id &&
                    "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                {t.name}
              </button>
            ))}
          </div>
          {aiOpen && (
            <div className="grid gap-3 rounded-xl border bg-muted/40 p-3.5">
              <Field>
                <FieldLabel htmlFor="ai-goal">What should it say?</FieldLabel>
                <Input
                  id="ai-goal"
                  value={goal}
                  autoFocus
                  placeholder="e.g. Remind them about the forms, mention the POS offer"
                  onChange={(e) => setGoal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      writeWithAi()
                    }
                  }}
                />
              </Field>
              <div className="flex flex-wrap items-center gap-1.5">
                {(["WHATSAPP", "SMS", "EMAIL"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={aiChannel === c}
                    onClick={() => setAiChannel(c)}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs font-medium hover:bg-muted",
                      aiChannel === c &&
                        "border-primary bg-primary/10 text-primary"
                    )}
                  >
                    {c === "WHATSAPP"
                      ? "WhatsApp"
                      : c === "SMS"
                        ? "SMS"
                        : "Email"}
                  </button>
                ))}
                <Button
                  size="sm"
                  className="ml-auto"
                  onClick={writeWithAi}
                  disabled={draft.isPending}
                >
                  {draft.isPending ? (
                    <IconLoader2
                      className="animate-spin"
                      data-icon="inline-start"
                    />
                  ) : (
                    <IconSparkles data-icon="inline-start" />
                  )}
                  {draft.isPending
                    ? "Writing…"
                    : selected === "ai"
                      ? "Rewrite"
                      : "Draft it"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Uses their history and your templates&apos; tone. Read it before
                sending.
              </p>
            </div>
          )}
          {prospect.email && (
            <Field>
              <FieldLabel htmlFor="msg-subject">Email subject</FieldLabel>
              <Input
                id="msg-subject"
                value={emailSubject}
                placeholder="e.g. Opening your ProvidusUnity account"
                onChange={(e) => setSubject(e.target.value)}
              />
            </Field>
          )}
          <Textarea
            aria-label="Message"
            rows={7}
            value={text}
            onChange={(e) => setEdited(e.target.value)}
          />
          <p className="-mt-3 text-xs text-muted-foreground">
            Edit freely; changes here don&apos;t touch the template.{" "}
            <Link href="/templates" className="underline" onClick={onDone}>
              Manage templates
            </Link>
          </p>
        </>
      )}

      <DialogFooter className="gap-2 sm:justify-between">
        <Button variant="ghost" onClick={copy} disabled={!text}>
          <IconCopy data-icon="inline-start" /> Copy
        </Button>
        <div className="flex flex-wrap gap-2">
          {phone && (
            <>
              {meta?.channels.sms ? (
                <Button
                  variant="outline"
                  onClick={smsNow}
                  disabled={sendSms.isPending || !text}
                >
                  {sendSms.isPending ? (
                    <IconLoader2
                      className="animate-spin"
                      data-icon="inline-start"
                    />
                  ) : (
                    <IconMessage data-icon="inline-start" />
                  )}
                  {sendSms.isPending ? "Sending…" : "Send SMS"}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={
                    <a
                      href={`sms:${phone.replace(/[^\d+]/g, "")}?&body=${body}`}
                      onClick={() => sent("SMS")}
                    />
                  }
                >
                  <IconMessage data-icon="inline-start" /> SMS
                </Button>
              )}
              <Button
                nativeButton={false}
                render={
                  <a
                    href={`https://wa.me/${whatsappNumber(phone)}?text=${body}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => sent("WHATSAPP")}
                  />
                }
              >
                <IconBrandWhatsapp data-icon="inline-start" /> WhatsApp
              </Button>
            </>
          )}
          {prospect.email && (
            <Button
              variant={phone ? "outline" : "default"}
              onClick={emailNow}
              disabled={sendEmail.isPending || !text}
            >
              {sendEmail.isPending ? (
                <IconLoader2
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <IconSend data-icon="inline-start" />
              )}
              {sendEmail.isPending ? "Sending…" : "Send email"}
            </Button>
          )}
        </div>
      </DialogFooter>
      {prospect.email && (
        <p className="-mt-2 text-xs text-muted-foreground">
          Email goes out from Coverage under your name to {prospect.email}.
          Prefer your own mail app?{" "}
          <a
            className="underline"
            href={`mailto:${prospect.email}?subject=${encodeURIComponent(emailSubject)}&body=${body}`}
            onClick={() => sent("EMAIL")}
          >
            Open it there
          </a>
          .
        </p>
      )}
      {!phone && !prospect.email && (
        <p className="-mt-2 text-xs text-muted-foreground">
          No phone or email on this card. Copy the message, or add contact
          details first.
        </p>
      )}
    </div>
  )
}
