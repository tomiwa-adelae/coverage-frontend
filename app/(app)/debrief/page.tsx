"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, useSyncExternalStore } from "react"
import {
  IconAlertCircle,
  IconBell,
  IconCircleCheck,
  IconKeyboard,
  IconMicrophone,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconPlayerStopFilled,
  IconArrowBackUp,
  IconTrash,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { timeAgo } from "@/lib/format"
import {
  canRecord,
  clearPending,
  loadPending,
  MAX_RECORDING_MS,
  pendingBlob,
  savePending,
  uploadRecording,
  type PendingRecording,
} from "@/lib/debrief-audio"
import {
  useCreateDebrief,
  useDebrief,
  useDebriefs,
  useDebriefStatus,
  useDeleteDebrief,
  useRereadDebrief,
  useToday,
  useUndoDebrief,
} from "@/lib/queries"
import type { Debrief } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { useRecorder } from "@/components/debrief/use-recorder"
import { DebriefReview } from "@/components/debrief/review"
import { useOpenProspect } from "@/components/prospect-sheet"
import { DictateButton, appendText, useDictation } from "@/components/dictate"

const noop = () => () => {}

const mmss = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

export default function DebriefPage() {
  const id = useSearchParams().get("id")
  return (
    <div className="mx-auto max-w-2xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Debrief</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Talk through your day. Coverage sorts it into each person’s record for
          you to check.
        </p>
      </header>
      <div className="mt-6">
        {id ? <DebriefView key={id} id={id} /> : <Start />}
      </div>
    </div>
  )
}

// Recording

function Start() {
  const router = useRouter()
  const params = useSearchParams()
  const status = useDebriefStatus()
  const create = useCreateDebrief()
  const supported = useSyncExternalStore(noop, canRecord, () => true)
  const [typing, setTyping] = useState(params.get("mode") === "type")
  const [text, setText] = useState("")
  // The browser's own speech-to-text: free, and words appear as you talk, so
  // only text goes to the AI. Handy when sending audio fails.
  const dictation = useDictation((t) => setText((cur) => appendText(cur, t)))
  const [pending, setPending] = useState<PendingRecording | null>(null)
  const [upload, setUpload] = useState<
    | { state: "sending"; progress: number }
    | { state: "failed"; error: string }
    | null
  >(null)

  // Back from sharing a voice note in from another app (public/sw.js).
  const shared = params.get("shared")
  useEffect(() => {
    if (!shared) return
    const problem: Record<string, string> = {
      busy: "Send or delete the recording below first, then share the voice note again.",
      none: "That share didn’t include a voice note.",
      failed: "We couldn’t save that voice note. Try sharing it again.",
      retry: "Coverage was still setting up. Share the voice note again.",
    }
    if (problem[shared]) toast.error(problem[shared])
    router.replace("/debrief")
  }, [shared, router])

  // A recording that never reached the server (closed tab, no signal).
  useEffect(() => {
    let live = true
    loadPending().then((p) => {
      // Sent ones are only kept for retrying a failed transcription.
      if (p?.sent) {
        if (Date.now() - p.startedAt > 3 * 86_400_000) void clearPending()
        return
      }
      if (live) setPending(p)
    })
    return () => {
      live = false
    }
  }, [])

  async function send(rec: PendingRecording) {
    setPending(rec)
    setUpload({ state: "sending", progress: 0 })
    try {
      const d = await uploadRecording(pendingBlob(rec), (progress) =>
        setUpload({ state: "sending", progress })
      )
      await savePending({ ...rec, debriefId: d.id, sent: true })
      router.replace(`/debrief?id=${d.id}`)
    } catch (e) {
      setUpload({
        state: "failed",
        error: navigator.onLine
          ? (e as Error).message
          : "You’re offline. Your recording is saved on this device; send it when you’re back online.",
      })
    }
  }

  const recorder = useRecorder({ onStop: (rec) => void send(rec) })

  async function discard() {
    await clearPending()
    setPending(null)
    setUpload(null)
    recorder.cancel()
  }

  function submitText() {
    dictation.stop()
    create.mutate(
      { text: text.trim() },
      {
        onSuccess: (d) => router.replace(`/debrief?id=${d.id}`),
        onError: (e) => toast.error(e.message),
      }
    )
  }

  if (status.isLoading) return <Skeleton className="h-72 rounded-2xl" />
  if (status.data && !status.data.ai)
    return (
      <Notice
        title="Debriefs aren’t switched on yet"
        body="The AI assistant isn’t set up on the server, so debriefs can’t be read. Ask whoever runs Coverage to add a Gemini or Anthropic API key."
      />
    )

  const voice = status.data?.voice !== false && supported
  const busy = recorder.state === "recording" || recorder.state === "paused"

  // A recording waiting to be sent, or one being sent now.
  if (upload || (pending && !busy && recorder.state === "idle"))
    return (
      <div className="rounded-2xl border bg-card p-6 text-center">
        {upload?.state === "sending" ? (
          <>
            <Spinner className="mx-auto size-6" />
            <p className="mt-3 font-medium">Sending your recording…</p>
            <div className="mx-auto mt-3 h-1.5 max-w-xs overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] dark:bg-brand"
                style={{ width: `${Math.round(upload.progress * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Keep this page open.
            </p>
          </>
        ) : (
          <>
            <IconMicrophone className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-medium">
              {upload?.state === "failed"
                ? "Your recording didn’t send"
                : pending!.shared
                  ? "Voice note ready to send"
                  : "You have a recording that wasn’t sent"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {upload?.state === "failed"
                ? upload.error
                : pending!.shared
                  ? `Shared ${timeAgo(new Date(pending!.startedAt).toISOString())}. Send it and Coverage will read who you spoke with.`
                  : `${mmss(pending!.durationMs)} recorded ${timeAgo(new Date(pending!.startedAt).toISOString())}. It’s saved on this device.`}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="outline" onClick={discard}>
                <IconTrash /> Delete it
              </Button>
              <Button onClick={() => pending && send(pending)}>Send now</Button>
            </div>
          </>
        )}
      </div>
    )

  if (typing || !voice)
    return (
      <div className="space-y-3">
        {!voice && (
          <p className="text-sm text-muted-foreground">
            {supported
              ? "Voice debriefs aren’t switched on for this server, so type it instead."
              : "This browser can’t record audio, so type it instead."}
          </p>
        )}
        <Textarea
          autoFocus
          className="min-h-56"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            dictation.supported
              ? "Tap Dictate and talk, or type. e.g. Saw Mr Adeyemi at Lekki Foods, he’ll fund ₦20m by Friday…"
              : "e.g. Saw Mr Adeyemi at Lekki Foods, he’ll fund ₦20m by Friday. Call Mrs Okafor tomorrow at 10…"
          }
        />
        <div className="flex flex-wrap justify-between gap-2">
          <div className="flex gap-2">
            <DictateButton dictation={dictation} />
            {voice && (
              <Button
                variant="ghost"
                onClick={() => {
                  dictation.stop()
                  setTyping(false)
                }}
              >
                <IconMicrophone /> Record instead
              </Button>
            )}
          </div>
          <Button
            onClick={submitText}
            disabled={text.trim().length < 10 || create.isPending}
          >
            {create.isPending ? "Sending…" : "Read my debrief"}
          </Button>
        </div>
        <RecentDebriefs />
      </div>
    )

  const left = MAX_RECORDING_MS - recorder.elapsed
  return (
    <div>
      <div className="rounded-2xl border bg-card px-6 py-10 text-center">
        <button
          type="button"
          onClick={busy ? recorder.stop : recorder.start}
          aria-label={busy ? "Stop and send" : "Start recording"}
          className={cn(
            "relative mx-auto grid size-28 place-items-center rounded-full text-white shadow-lg transition-transform active:scale-95",
            busy
              ? "bg-red-600"
              : "bg-primary dark:bg-brand dark:text-brand-foreground"
          )}
        >
          {recorder.state === "recording" && (
            <span
              className="absolute inset-0 rounded-full bg-red-500/40"
              style={{ transform: `scale(${1 + recorder.level * 0.45})` }}
            />
          )}
          {busy ? (
            <IconPlayerStopFilled className="relative size-10" />
          ) : (
            <IconMicrophone className="relative size-12" />
          )}
        </button>

        {busy ? (
          <>
            <p className="mt-5 font-mono text-3xl tabular-nums">
              {mmss(recorder.elapsed)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {recorder.state === "paused"
                ? "Paused"
                : left < 60_000
                  ? `${Math.ceil(left / 1000)} seconds left`
                  : "Recording. Tap the button when you’re done."}
            </p>
            <div className="mt-5 flex justify-center gap-2">
              {recorder.state === "paused" ? (
                <Button variant="outline" onClick={recorder.resume}>
                  <IconPlayerPlayFilled /> Resume
                </Button>
              ) : (
                <Button variant="outline" onClick={recorder.pause}>
                  <IconPlayerPauseFilled /> Pause
                </Button>
              )}
              <Button variant="ghost" onClick={discard}>
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-5 font-medium">Tap to record your debrief</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Say who you saw or called, what happened, amounts, and when to
              follow up, with a time if you have one. Up to 15 minutes.
            </p>
          </>
        )}
        {recorder.error && (
          <p className="mx-auto mt-4 flex max-w-sm items-start justify-center gap-1.5 text-sm text-destructive">
            <IconAlertCircle className="mt-0.5 size-4 shrink-0" />
            {recorder.error}
          </p>
        )}
      </div>

      {!busy && (
        <>
          <div className="mt-3 text-center">
            <Button variant="ghost" size="sm" onClick={() => setTyping(true)}>
              <IconKeyboard /> Dictate or type instead
            </Button>
          </div>
          <RecentDebriefs />
        </>
      )}
    </div>
  )
}

function RecentDebriefs() {
  const { data } = useDebriefs()
  const remove = useDeleteDebrief()
  if (!data?.length) return null
  const label: Record<Debrief["status"], string> = {
    UPLOADING: "Not sent",
    PROCESSING: "Reading…",
    READY: "To review",
    FAILED: "Didn’t work",
    APPLIED: "Saved",
  }
  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium text-muted-foreground">Recent</h2>
      <ul className="mt-2 divide-y rounded-xl border">
        {data.map((d) => (
          <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
            <Link href={`/debrief?id=${d.id}`} className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-medium">
                {timeAgo(d.createdAt)}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px]",
                    d.status === "READY"
                      ? "bg-brand/20 text-brand-foreground dark:text-brand"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {label[d.status]}
                </span>
                {d.people > 0 && (
                  <span className="text-xs font-normal text-muted-foreground">
                    {d.people} {d.people === 1 ? "person" : "people"}
                  </span>
                )}
              </p>
              {d.preview && (
                <p className="truncate text-xs text-muted-foreground">
                  {d.preview}
                </p>
              )}
            </Link>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete debrief"
              onClick={() => remove.mutate(d.id)}
            >
              <IconTrash />
            </Button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        Recordings aren’t kept. Transcripts are deleted after 14 days.
      </p>
    </section>
  )
}

// One debrief, from processing to saved

function DebriefView({ id }: { id: string }) {
  const { data: d, error } = useDebrief(id)
  const { data: today } = useToday()
  const heard = !!d?.transcript

  // The transcript is back, so the copy kept on the device isn't needed.
  useEffect(() => {
    if (heard)
      loadPending().then((p) => {
        if (p?.debriefId === id) void clearPending()
      })
  }, [heard, id])

  if (error)
    return (
      <Notice
        title="Debrief not found"
        body="It may have been deleted."
        action={<NewButton />}
      />
    )
  if (!d || !today) return <Skeleton className="h-72 rounded-2xl" />

  if (d.status === "PROCESSING" || d.status === "UPLOADING")
    return <Processing d={d} />
  if (d.status === "FAILED") return <Failed d={d} />
  if (d.status === "APPLIED") return <Applied d={d} />
  return (
    <>
      <DebriefReview debrief={d} today={today.today} />
      <Transcript d={d} />
    </>
  )
}

function Processing({ d }: { d: Debrief }) {
  const steps = [
    ["TRANSCRIBING", "Turning your recording into text"],
    ["READING", "Sorting it by person"],
  ] as const
  const at = d.step === "READING" ? 1 : 0
  return (
    <div className="rounded-2xl border bg-card p-6">
      <ol className="space-y-3">
        {steps.map(([key, text], i) => (
          <li key={key} className="flex items-center gap-3 text-sm">
            {i < at ? (
              <IconCircleCheck className="size-5 text-emerald-600" />
            ) : i === at ? (
              <Spinner className="size-5" />
            ) : (
              <span className="size-5 rounded-full border" />
            )}
            <span className={cn(i > at && "text-muted-foreground")}>
              {text}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs text-muted-foreground">
        Usually under a minute. You can leave this page; it’ll be under Recent
        on the Debrief page.
      </p>
    </div>
  )
}

function Failed({ d }: { d: Debrief }) {
  const router = useRouter()
  const [saved, setSaved] = useState<PendingRecording | null>(null)
  const [progress, setProgress] = useState<number | null>(null)

  // The recording is still on this device if transcription failed.
  useEffect(() => {
    if (d.transcript) return
    let live = true
    loadPending().then((p) => {
      if (live && p?.debriefId === d.id) setSaved(p)
    })
    return () => {
      live = false
    }
  }, [d.id, d.transcript])

  async function retry() {
    if (!saved) return
    setProgress(0)
    try {
      const next = await uploadRecording(pendingBlob(saved), setProgress)
      await savePending({ ...saved, debriefId: next.id, sent: true })
      router.replace(`/debrief?id=${next.id}`)
    } catch (e) {
      setProgress(null)
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <Notice
        tone="error"
        title="That didn’t work"
        body={
          (d.error ?? "Something went wrong reading your debrief.") +
          (saved ? " Your recording is still on this device." : "")
        }
        action={
          !d.transcript &&
          (saved ? (
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant="ghost"
                nativeButton={false}
                render={<Link href="/debrief?mode=type" />}
              >
                <IconKeyboard /> Dictate or type instead
              </Button>
              <NewButton label="Record again" variant="outline" />
              <Button onClick={retry} disabled={progress !== null}>
                {progress === null
                  ? "Try again"
                  : `Sending… ${Math.round(progress * 100)}%`}
              </Button>
            </div>
          ) : (
            <NewButton label="Record again" />
          ))
        }
      />
      {d.transcript && <Transcript d={d} open />}
    </div>
  )
}

function Transcript({ d, open }: { d: Debrief; open?: boolean }) {
  const [text, setText] = useState(d.transcript ?? "")
  const reread = useRereadDebrief(d.id)
  if (!d.transcript) return null
  return (
    <details open={open} className="mt-6 rounded-xl border p-4">
      <summary className="cursor-pointer text-sm font-medium">
        What we heard
      </summary>
      <p className="mt-2 text-xs text-muted-foreground">
        If a name or amount was misheard, fix it here and read it again.
      </p>
      <Textarea
        className="mt-2 min-h-48 text-sm"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-2 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          disabled={!text.trim() || reread.isPending}
          onClick={() => reread.mutate(text)}
        >
          {reread.isPending ? "Sending…" : "Read it again"}
        </Button>
      </div>
    </details>
  )
}

function Applied({ d }: { d: Debrief }) {
  const open = useOpenProspect()
  const results = d.applied ?? []
  const ok = results.filter((r) => r.ok)
  const pushOff = useSyncExternalStore(
    noop,
    () =>
      typeof Notification === "undefined" ||
      Notification.permission !== "granted",
    () => false
  )
  const timed = d.result?.items.some((s) => s.nextTime)
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-2">
          <IconCircleCheck className="size-6 text-emerald-600" />
          <p className="font-semibold">
            {ok.length} {ok.length === 1 ? "person" : "people"} updated
          </p>
        </div>
        <ul className="mt-4 divide-y">
          {results.map((r, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 py-2 text-sm"
            >
              <span className="min-w-0">
                <span className="font-medium">{r.name}</span>
                {r.created && (
                  <span className="text-muted-foreground"> · added</span>
                )}
                {!r.ok && (
                  <span className="block text-destructive">
                    {r.error ?? "Not saved"}
                  </span>
                )}
              </span>
              {r.ok && r.prospectId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => open(r.prospectId!)}
                >
                  Open
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>
      {timed && pushOff && (
        <div className="flex items-start gap-3 rounded-xl bg-muted/60 p-4 text-sm">
          <IconBell className="mt-0.5 size-5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Get reminded before follow-ups</p>
            <p className="text-muted-foreground">
              Turn on notifications on this device to be reminded before timed
              follow-ups.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href="/settings#notifications" />}
          >
            Turn on
          </Button>
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <NewButton label="New debrief" />
        {d.undoUntil && <UndoButton id={d.id} until={d.undoUntil} />}
        <Button variant="ghost" nativeButton={false} render={<Link href="/" />}>
          Back to Today
        </Button>
      </div>
    </div>
  )
}

/** Puts the records back and returns to review; hidden once the window closes. */
function UndoButton({ id, until }: { id: string; until: string }) {
  const undo = useUndoDebrief(id)
  const [expired, setExpired] = useState(() => Date.parse(until) <= Date.now())
  useEffect(() => {
    const t = setTimeout(
      () => setExpired(true),
      Math.max(0, Date.parse(until) - Date.now())
    )
    return () => clearTimeout(t)
  }, [until])
  if (expired) return null
  return (
    <Button
      variant="outline"
      disabled={undo.isPending}
      onClick={() =>
        undo.mutate(undefined, {
          onSuccess: () =>
            toast.success("Undone. Nothing from this debrief is saved now."),
        })
      }
    >
      <IconArrowBackUp /> {undo.isPending ? "Undoing…" : "Undo"}
    </Button>
  )
}

function NewButton({
  label = "New debrief",
  variant,
}: {
  label?: string
  variant?: "outline"
}) {
  return (
    <Button
      variant={variant}
      nativeButton={false}
      render={<Link href="/debrief" />}
    >
      <IconMicrophone /> {label}
    </Button>
  )
}

function Notice({
  title,
  body,
  action,
  tone,
}: {
  title: string
  body: string
  action?: React.ReactNode
  tone?: "error"
}) {
  return (
    <div className="rounded-2xl border bg-card p-6 text-center">
      {tone === "error" && (
        <IconAlertCircle className="mx-auto size-8 text-destructive" />
      )}
      <p className="mt-2 font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        {body}
      </p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
