"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  MAX_RECORDING_MS,
  pickMimeType,
  savePending,
  type PendingRecording,
} from "@/lib/debrief-audio"

export type RecorderState = "idle" | "recording" | "paused" | "stopped"

type WakeLock = { release(): Promise<void> }

function micError(e: unknown) {
  const name = (e as { name?: string })?.name
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Microphone access is blocked. Allow the microphone for this site in your browser settings, then try again."
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "No microphone was found on this device."
  if (name === "NotReadableError")
    return "Another app is using the microphone. Close it and try again."
  return "We couldn’t start recording. Try again, or type your debrief instead."
}

/**
 * Records the microphone with MediaRecorder. Chunks are saved on the device
 * every few seconds, the screen is kept awake (phones stop recording when they
 * lock), and recording stops by itself at the time limit.
 */
export function useRecorder({
  onStop,
}: {
  onStop: (rec: PendingRecording) => void
}) {
  const [state, setState] = useState<RecorderState>("idle")
  const [elapsed, setElapsed] = useState(0)
  const [level, setLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const media = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const rec = useRef<PendingRecording | null>(null)
  const audioCtx = useRef<AudioContext | null>(null)
  const frame = useRef(0)
  const wake = useRef<WakeLock | null>(null)
  // Time recorded before the current run (pause/resume splits it).
  const banked = useRef(0)
  const runStart = useRef(0)
  const onStopRef = useRef(onStop)
  useEffect(() => {
    onStopRef.current = onStop
  }, [onStop])

  const now = () => banked.current + (runStart.current ? Date.now() - runStart.current : 0)

  const release = useCallback(() => {
    cancelAnimationFrame(frame.current)
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
    audioCtx.current?.close().catch(() => {})
    audioCtx.current = null
    wake.current?.release().catch(() => {})
    wake.current = null
    setLevel(0)
  }, [])

  // Clean up if the page is left mid-recording.
  useEffect(() => release, [release])

  const keepAwake = useCallback(async () => {
    try {
      const nav = navigator as { wakeLock?: { request(t: "screen"): Promise<WakeLock> } }
      wake.current = (await nav.wakeLock?.request("screen")) ?? null
    } catch {}
  }, [])

  // The wake lock drops when the app is hidden; take it again on return.
  useEffect(() => {
    const again = () => {
      if (document.visibilityState === "visible" && media.current?.state === "recording")
        void keepAwake()
    }
    document.addEventListener("visibilitychange", again)
    return () => document.removeEventListener("visibilitychange", again)
  }, [keepAwake])

  const stop = useCallback(() => {
    const m = media.current
    if (!m || m.state === "inactive") return
    banked.current = now()
    runStart.current = 0
    m.stop()
  }, [])

  const start = useCallback(async () => {
    setError(null)
    const mime = pickMimeType()
    if (mime === null) {
      setError("This browser can’t record audio. Type your debrief instead.")
      return
    }
    let s: MediaStream
    try {
      s = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
    } catch (e) {
      setError(micError(e))
      return
    }
    stream.current = s
    let m: MediaRecorder
    try {
      m = new MediaRecorder(s, {
        ...(mime ? { mimeType: mime } : {}),
        audioBitsPerSecond: 32_000,
      })
    } catch {
      m = new MediaRecorder(s)
    }
    media.current = m
    rec.current = {
      chunks: [],
      mime: m.mimeType || mime || "audio/webm",
      startedAt: Date.now(),
      durationMs: 0,
    }
    banked.current = 0
    runStart.current = Date.now()

    m.ondataavailable = (e) => {
      if (!e.data.size || !rec.current) return
      rec.current.chunks.push(e.data)
      rec.current.durationMs = now()
      void savePending(rec.current)
    }
    m.onstop = () => {
      release()
      setState("stopped")
      const done = rec.current
      if (done?.chunks.length) {
        done.durationMs = banked.current
        void savePending(done)
        onStopRef.current(done)
      }
    }
    m.onerror = () => {
      setError("Recording stopped unexpectedly. What was recorded so far is kept.")
      stop()
    }
    // The phone took the microphone away (a call came in, the app was closed).
    s.getAudioTracks()[0]?.addEventListener("ended", () => stop())

    // A live level so it's obvious the microphone is hearing you.
    try {
      const ctx = new AudioContext()
      audioCtx.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      ctx.createMediaStreamSource(s).connect(analyser)
      const data = new Uint8Array(analyser.fftSize)
      const tick = () => {
        analyser.getByteTimeDomainData(data)
        let sum = 0
        for (const v of data) sum += ((v - 128) / 128) ** 2
        setLevel(Math.min(1, Math.sqrt(sum / data.length) * 4))
        const t = now()
        setElapsed(t)
        if (t >= MAX_RECORDING_MS) stop()
        frame.current = requestAnimationFrame(tick)
      }
      tick()
    } catch {}

    m.start(4000)
    setState("recording")
    setElapsed(0)
    void keepAwake()
  }, [keepAwake, release, stop])

  const pause = useCallback(() => {
    const m = media.current
    if (m?.state !== "recording") return
    banked.current = now()
    runStart.current = 0
    m.pause()
    // Save what's recorded so far.
    m.requestData()
    setState("paused")
  }, [])

  const resume = useCallback(() => {
    const m = media.current
    if (m?.state !== "paused") return
    runStart.current = Date.now()
    m.resume()
    setState("recording")
  }, [])

  /** Throws the recording away. */
  const cancel = useCallback(() => {
    const m = media.current
    rec.current = null
    if (m && m.state !== "inactive") {
      m.onstop = () => {
        release()
        setState("idle")
      }
      m.stop()
    } else setState("idle")
    setElapsed(0)
  }, [release])

  return { state, elapsed, level, error, start, pause, resume, stop, cancel }
}
