// App lock: asks for the phone's fingerprint, face or PIN when Coverage is
// opened, or comes back after being away. It uses a passkey that never leaves
// the device (WebAuthn), checked here in the browser. That stops someone
// picking up an unlocked phone; it doesn't replace signing out, as the session
// itself stays valid.

export interface LockSettings {
  credentialId: string
  /** Lock after the app has been in the background this long. */
  afterMinutes: number
}

const KEY = "coverage.app-lock"
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export const subscribeLock = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function readLockRaw() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function parseLock(raw: string | null): LockSettings | null {
  if (!raw) return null
  try {
    const s = JSON.parse(raw) as LockSettings
    return s.credentialId ? s : null
  } catch {
    return null
  }
}

function writeLock(s: LockSettings | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s))
    else localStorage.removeItem(KEY)
  } catch {}
  emit()
}

const b64 = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

const unb64 = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
    c.charCodeAt(0)
  )

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n))

/** Whether this device has a fingerprint, face or PIN unlock browsers can use. */
export async function lockAvailable() {
  try {
    return (
      typeof PublicKeyCredential !== "undefined" &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    )
  } catch {
    return false
  }
}

/** Creates the device passkey (the phone asks for fingerprint/face) and turns the lock on. */
export async function enableLock(
  user: { email: string; name: string },
  afterMinutes: number
) {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: random(32),
      rp: { name: "Coverage" },
      user: { id: random(16), name: user.email, displayName: user.name },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "discouraged",
      },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null
  if (!cred) throw new Error("The lock wasn’t set up.")
  writeLock({ credentialId: b64(cred.rawId), afterMinutes })
  unlocked = true
}

export function setLockDelay(afterMinutes: number) {
  const s = parseLock(readLockRaw())
  if (s) writeLock({ ...s, afterMinutes })
}

export function disableLock() {
  writeLock(null)
}

/** Asks for fingerprint/face. Resolves true once the phone confirms it's them. */
export async function unlock() {
  const s = parseLock(readLockRaw())
  if (!s) return true
  const res = await navigator.credentials.get({
    publicKey: {
      challenge: random(32),
      allowCredentials: [{ type: "public-key", id: unb64(s.credentialId) }],
      userVerification: "required",
      timeout: 60_000,
    },
  })
  if (!res) return false
  unlocked = true
  emit()
  return true
}

// Locked when the app first opens (if the lock is on), until unlocked.
let unlocked = false
let hiddenAt: number | null = null

export const isLocked = () => !unlocked && !!parseLock(readLockRaw())

/** Call on visibility changes: locks again after the chosen time away. */
export function noteVisibility(visible: boolean) {
  const s = parseLock(readLockRaw())
  if (!visible) {
    hiddenAt = Date.now()
    return
  }
  if (s && hiddenAt && Date.now() - hiddenAt >= s.afterMinutes * 60_000) {
    unlocked = false
    emit()
  }
  hiddenAt = null
}
