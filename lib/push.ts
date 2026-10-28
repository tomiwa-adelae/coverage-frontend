import { api } from "./api"

/** Push needs a service worker, the Push API and (on iPhone) an installed app. */
export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  )
}

/** iPhone or iPad (iPadOS reports itself as a Mac with a touch screen). */
export function isIos() {
  if (typeof window === "undefined") return false
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  )
}

export function isStandalone() {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  )
}

/** iOS only allows web push from an app added to the home screen. */
export function needsInstallForPush() {
  return isIos() && !isStandalone()
}

/** Apps like WhatsApp, Instagram and Facebook open links in a browser without push. */
export function inAppBrowser() {
  if (typeof window === "undefined") return false
  return /FBAN|FBAV|Instagram|Line\/|WhatsApp|Snapchat|TikTok|; wv\)/i.test(
    navigator.userAgent
  )
}

function keyBytes(base64url: string) {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4)
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function registration() {
  return (
    (await navigator.serviceWorker.getRegistration()) ??
    (await navigator.serviceWorker.register(swUrl()))
  )
}

export const swUrl = () =>
  process.env.NODE_ENV === "development" ? "/sw.js?dev=1" : "/sw.js"

export async function currentSubscription() {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

/** Asks permission (if needed), subscribes this browser and tells the API. */
export async function enablePush(publicKey: string) {
  const permission = await Notification.requestPermission()
  if (permission !== "granted")
    throw new Error(
      permission === "denied"
        ? "Notifications are blocked for this site. Allow them in your browser settings, then try again."
        : "Notifications weren’t allowed."
    )
  await registration()
  const reg = await navigator.serviceWorker.ready
  await save(await subscribe(reg, publicKey))
}

const sameKey = (sub: PushSubscription, publicKey: string) => {
  const current = sub.options?.applicationServerKey
  if (!current) return true
  const a = new Uint8Array(current)
  const b = keyBytes(publicKey)
  return a.length === b.length && a.every((v, i) => v === b[i])
}

/** This browser's subscription for the server's key, replacing one made for an old key. */
async function subscribe(reg: ServiceWorkerRegistration, publicKey: string) {
  const existing = await reg.pushManager.getSubscription()
  if (existing && sameKey(existing, publicKey)) return existing
  await existing?.unsubscribe()
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(publicKey),
  })
}

function save(sub: PushSubscription) {
  const json = sub.toJSON()
  return api("/notifications/subscriptions", {
    method: "POST",
    body: { endpoint: json.endpoint, keys: json.keys },
  })
}

/**
 * Re-registers this device on each visit when notifications are allowed. Browsers
 * rotate or drop subscriptions, and the server forgets ones that stop working;
 * this quietly fixes both without the user doing anything.
 */
export async function syncPush(publicKey: string) {
  if (!pushSupported() || Notification.permission !== "granted") return
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) return
    await save(await subscribe(reg, publicKey))
  } catch {}
}

export async function disablePush() {
  const sub = await currentSubscription()
  if (!sub) return
  await api("/notifications/subscriptions/remove", {
    method: "POST",
    body: { endpoint: sub.endpoint },
  }).catch(() => {})
  await sub.unsubscribe()
}
