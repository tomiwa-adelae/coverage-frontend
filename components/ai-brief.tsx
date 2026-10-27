"use client"

import { useEffect } from "react"
import { IconRefresh, IconSparkles } from "@tabler/icons-react"
import { useBrief } from "@/lib/queries"
import type { Brief } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"

/** A one-minute read before a call or visit, written from the prospect's history. */
export function BriefDialog({
  prospectId,
  name,
  open,
  onOpenChange,
}: {
  prospectId: string
  name: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const brief = useBrief()
  const { mutate, reset } = brief

  useEffect(() => {
    if (open) mutate(prospectId)
    else reset()
  }, [open, prospectId, mutate, reset])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconSparkles className="size-5 text-primary" /> Prep for {name}
          </DialogTitle>
          <DialogDescription>
            Written by AI from your notes and history. Check before you rely on
            it.
          </DialogDescription>
        </DialogHeader>

        {brief.isPending && (
          <div className="space-y-3" aria-label="Preparing brief">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-full" />
          </div>
        )}
        {brief.isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p>{brief.error.message}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => mutate(prospectId)}
            >
              <IconRefresh data-icon="inline-start" /> Try again
            </Button>
          </div>
        )}
        {brief.data && <BriefBody brief={brief.data} />}
      </DialogContent>
    </Dialog>
  )
}

function BriefBody({ brief }: { brief: Brief }) {
  const parts: [string, string[]][] = [
    ["You promised", brief.promised],
    ["What to pitch", brief.pitch],
    ["Questions to ask", brief.questions],
    ["Watch out for", brief.watchOut],
  ]
  return (
    <div className="space-y-5 text-sm">
      <p className="rounded-lg bg-secondary/60 p-3.5 leading-relaxed text-secondary-foreground">
        {brief.summary}
      </p>
      {parts
        .filter(([, items]) => items.length)
        .map(([title, items]) => (
          <section key={title}>
            <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {title}
            </h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  )
}
