import { api, ApiError } from "./api"
import type { Debrief } from "./types"

/** Long enough for a full day; keeps uploads small (~4 MB at 32 kbps). */
export const MAX_RECORDING_MS = 15 * 60_000
/** Each upload request stays well under proxy and host body limits. */
const PART_BYTES = 2 * 1024 * 1024

/** First recording format this browser supports (Safari only does MP4). */
export function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return null
  const options = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ]
  return options.find((t) => MediaRecorder.isTypeSupported(t)) ?? ""
}

export const canRecord = () =>
  typeof window !== "undefined" &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof MediaRecorder !== "undefined"

// The recording is saved on the device as it's made, so a crash, a closed
// tab or a dropped connection never loses it. One pending recording at a time.

export interface PendingRecording {
  chunks: Blob[]
  mime: string
  startedAt: number
  durationMs: number
  /** Set once the server has it, so a retry doesn't upload twice. */
  debriefId?: string
}

const DB = "coverage-debrief"
const STORE = "recordings"
const KEY = "pending"

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | void
) {
  const db = await openDb()
  return new Promise<T | undefined>((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = run(t.objectStore(STORE))
    t.oncomplete = () => {
      db.close()
      resolve(req ? req.result : undefined)
    }
    t.onerror = () => {
      db.close()
      reject(t.error)
    }
  })
}

export async function loadPending() {
  try {
    const rec = await tx<PendingRecording>("readonly", (s) => s.get(KEY))
    return rec?.chunks?.length ? rec : null
  } catch {
    return null
  }
}

export async function savePending(rec: PendingRecording) {
  try {
    await tx("readwrite", (s) => s.put(rec, KEY))
  } catch {
    // Private browsing can block storage; the recording still lives in memory.
  }
}

export async function clearPending() {
  try {
    await tx("readwrite", (s) => s.delete(KEY))
  } catch {}
}

export const pendingBlob = (rec: PendingRecording) =>
  new Blob(rec.chunks, { type: rec.mime })

async function withRetry<T>(fn: () => Promise<T>, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      return await fn()
    } catch (e) {
      // Only retry what a retry can fix: the network or a busy server.
      const status = e instanceof ApiError ? e.status : 0
      const retryable = status === 0 || status === 429 || status >= 500
      if (!retryable || i >= tries) throw e
      await new Promise((r) => setTimeout(r, 1000 * i * i))
    }
  }
}

/**
 * Sends a recording in parts, then asks the server to transcribe and read it.
 * Returns the debrief, now PROCESSING; poll it for the result.
 */
export async function uploadRecording(
  audio: Blob,
  onProgress: (fraction: number) => void
) {
  const type = (audio.type || "audio/webm").split(";")[0]
  const debrief = await withRetry(() =>
    api<Debrief>("/debriefs", { method: "POST", body: {} })
  )
  const pending = await loadPending()
  if (pending) await savePending({ ...pending, debriefId: debrief.id })

  const count = Math.max(1, Math.ceil(audio.size / PART_BYTES))
  const sendAll = async () => {
    for (let i = 0; i < count; i++) {
      const part = audio.slice(i * PART_BYTES, (i + 1) * PART_BYTES, type)
      await withRetry(() =>
        api<void>(`/debriefs/${debrief.id}/parts/${i}`, {
          method: "PUT",
          raw: part,
        })
      )
      onProgress((i + 1) / count)
    }
  }
  const process = () =>
    api<Debrief>(`/debriefs/${debrief.id}/process`, {
      method: "POST",
      body: { parts: count, bytes: audio.size, mime: type },
    })

  await sendAll()
  try {
    return await withRetry(process)
  } catch (e) {
    // A part went missing (or the server restarted): send them all once more.
    if (!(e instanceof ApiError) || e.status !== 400) throw e
    await sendAll()
    return withRetry(process)
  }
}
