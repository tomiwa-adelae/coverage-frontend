"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { IconMicrophone, IconPlayerStopFilled } from "@tabler/icons-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// The Web Speech API isn't in TypeScript's DOM types yet; this is the slice we use.
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  onresult:
    ((e: { resultIndex: number; results: SpeechResults }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
type SpeechResults = ArrayLike<
  ArrayLike<{ transcript: string }> & { isFinal: boolean }
>

function recognitionClass(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    (new () => Recognition) | null
}

const noop = () => () => {}

/**
 * Speak instead of typing. Finished phrases are passed to `onText` as they come;
 * the browser does the transcription (Chrome sends audio to Google, Safari to Apple).
 */
export function useDictation(onText: (text: string) => void) {
  // Only known in the browser; false during server render.
  const supported = useSyncExternalStore(
    noop,
    () => !!recognitionClass(),
    () => false
  )
  const [listening, setListening] = useState(false)
  const rec = useRef<Recognition | null>(null)
  const callback = useRef(onText)
  useEffect(() => {
    callback.current = onText
  })
  useEffect(() => () => rec.current?.stop(), [])

  function start() {
    const Rec = recognitionClass()
    if (!Rec) return
    const r = new Rec()
    r.lang = "en-NG"
    r.continuous = true
    r.interimResults = false
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++)
        if (e.results[i].isFinal)
          callback.current(e.results[i][0].transcript.trim())
    }
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed")
        toast.error("Allow microphone access to dictate notes.")
      else if (e.error !== "no-speech" && e.error !== "aborted")
        toast.error("Dictation stopped. Try again.")
    }
    r.onend = () => setListening(false)
    rec.current = r
    r.start()
    setListening(true)
  }

  return {
    supported,
    listening,
    start,
    stop: () => rec.current?.stop(),
    toggle: () => (listening ? rec.current?.stop() : start()),
  }
}

export function DictateButton({
  dictation,
  className,
}: {
  dictation: ReturnType<typeof useDictation>
  className?: string
}) {
  if (!dictation.supported) return null
  return (
    <Button
      type="button"
      size="sm"
      variant={dictation.listening ? "destructive" : "outline"}
      onClick={dictation.toggle}
      className={cn(dictation.listening && "animate-pulse", className)}
    >
      {dictation.listening ? (
        <>
          <IconPlayerStopFilled data-icon="inline-start" /> Stop
        </>
      ) : (
        <>
          <IconMicrophone data-icon="inline-start" /> Dictate
        </>
      )}
    </Button>
  )
}

/** Appends a dictated phrase to existing text with sensible spacing. */
export const appendText = (current: string, add: string) =>
  current.trim() ? `${current.trimEnd()} ${add}` : add
