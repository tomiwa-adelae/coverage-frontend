"use client"

import { createContext, useCallback, useContext, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  IconBrandWhatsapp,
  IconCopy,
  IconMail,
  IconMessage,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { whatsappNumber } from "@/lib/contact"
import { fillTemplate } from "@/lib/templates"
import { useMe, useTemplates } from "@/lib/queries"
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

  const current =
    templates?.find((t) => t.id === selected) ?? templates?.[0] ?? null
  const text =
    edited ?? (current ? fillTemplate(current.body, prospect, me?.name) : "")

  function pick(id: string) {
    setSelected(id)
    setEdited(null)
  }

  /** After the message app opens, offer to record the contact. */
  function sent(type: Touch) {
    onDone()
    toast("Message sent?", {
      description: `Log it against ${prospect.name}.`,
      action: {
        label: "Log contact",
        onClick: () =>
          quickLog(prospect, { type, note: `Sent "${current?.name}"` }),
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
      ) : templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You have no templates yet.{" "}
          <Link
            href="/templates"
            className="text-primary underline"
            onClick={onDone}
          >
            Create one
          </Link>
          .
        </p>
      ) : (
        <>
          <div
            className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
            role="group"
            aria-label="Template"
          >
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
              nativeButton={false}
              render={
                <a
                  href={`mailto:${prospect.email}?subject=${encodeURIComponent(current?.name ?? "")}&body=${body}`}
                  onClick={() => sent("EMAIL")}
                />
              }
            >
              <IconMail data-icon="inline-start" /> Email
            </Button>
          )}
        </div>
      </DialogFooter>
      {!phone && !prospect.email && (
        <p className="-mt-2 text-xs text-muted-foreground">
          No phone or email on this card. Copy the message, or add contact
          details first.
        </p>
      )}
    </div>
  )
}
