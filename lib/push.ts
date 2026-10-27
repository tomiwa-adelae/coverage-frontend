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

/** iOS only allows web push from an app added to the home screen. */
export function needsInstallForPush() {
  if (typeof window === "undefined") return false
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  return ios && !standalone
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
  const reg = await registration()
  await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(publicKey),
    }))
  const json = sub.toJSON()
  await api("/notifications/subscriptions", {
    method: "POST",
    body: { endpoint: json.endpoint, keys: json.keys },
  })
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
