// Coverage service worker: push notifications and a small offline cache.
// Prospect data itself stays in the page (persisted query cache), never here.

const VERSION = "coverage-v2"
const SHELL = `${VERSION}-shell`
const STATIC = `${VERSION}-static`
// Registered as /sw.js?dev=1 by `next dev`, where chunks aren't content-hashed.
const DEV = new URL(self.location.href).searchParams.has("dev")

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(["/", "/icons/icon-192.png", "/icons/badge-96.png"]))
      .catch(() => {})
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(VERSION))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  )
})

// A voice note shared from another app (WhatsApp, Recorder) arrives here as a
// form post. It's saved like an unsent recording and the debrief page offers to
// send it. Android only; see share_target in app/manifest.ts.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== "POST" || url.pathname !== "/share-target") return
  event.respondWith(receiveShare(event.request))
})

async function receiveShare(req) {
  const to = (q) => Response.redirect(`/debrief?shared=${q}`, 303)
  try {
    const form = await req.formData()
    const file = form.getAll("audio").find((f) => f instanceof File && f.size)
    if (!file) return to("none")
    const db = await new Promise((resolve, reject) => {
      // Same database as lib/debrief-audio.ts.
      const open = indexedDB.open("coverage-debrief", 1)
      open.onupgradeneeded = () => open.result.createObjectStore("recordings")
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
    })
    const run = (mode, fn) =>
      new Promise((resolve, reject) => {
        const t = db.transaction("recordings", mode)
        const r = fn(t.objectStore("recordings"))
        t.oncomplete = () => resolve(r.result)
        t.onerror = () => reject(t.error)
      })
    const current = await run("readonly", (s) => s.get("pending"))
    // Never replace a recording of their own that hasn't been sent yet.
    if (current?.chunks?.length && !current.sent) {
      db.close()
      return to("busy")
    }
    // WhatsApp voice notes are Opus in an Ogg file, sometimes labelled oddly.
    const type = (file.type || "").split(";")[0]
    const mime =
      !type || type === "audio/opus" || /\.opus$/i.test(file.name)
        ? "audio/ogg"
        : type
    await run("readwrite", (s) =>
      s.put(
        { chunks: [file], mime, startedAt: Date.now(), durationMs: 0, shared: true },
        "pending"
      )
    )
    db.close()
    return to("1")
  } catch {
    return to("failed")
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (DEV || req.method !== "GET") return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  // Never cache the API: it carries the user's data and auth.
  if (url.pathname.startsWith("/api/")) return

  // Build assets are content-hashed, so the cached copy is always right.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(STATIC).then((c) => c.put(req, copy))
            }
            return res
          })
      )
    )
    return
  }

  // Pages: network first, falling back to the last copy (or the app shell).
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // A redirect means signed out (or moved); don't keep that as the page.
          if (res.ok && !res.redirected) {
            const copy = res.clone()
            caches.open(SHELL).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(() =>
          caches
            .match(req)
            .then((hit) => hit || caches.match("/"))
            .then(
              (hit) =>
                hit ||
                new Response("You're offline. Reconnect and try again.", {
                  status: 503,
                  headers: { "Content-Type": "text/plain; charset=utf-8" },
                })
            )
        )
    )
  }
})

self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : "" }
  }
  const title = data.title || "Coverage"
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      // Android shows the badge in the status bar; it must be a white silhouette.
      badge: "/icons/badge-96.png",
      tag: data.tag,
      renotify: !!data.tag,
      timestamp: Date.now(),
      data: { url: data.url || "/" },
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
      const win = wins.find((w) => w.url.startsWith(self.location.origin))
      if (win) {
        // navigate() isn't allowed on every browser (and not on uncontrolled
        // pages); focusing the app is still better than opening a second copy.
        try {
          const moved = await win.navigate(target)
          return (moved || win).focus()
        } catch {
          try {
            return await win.focus()
          } catch {}
        }
      }
      return self.clients.openWindow(target)
    })()
  )
})

// Browsers renew or expire subscriptions on their own. Re-subscribe with the
// same key and tell the server, so notifications keep arriving. The app also
// re-registers on every visit, which covers browsers without this event.
self.addEventListener("pushsubscriptionchange", (event) => {
  const old = event.oldSubscription
  const key = old?.options?.applicationServerKey
  event.waitUntil(
    (async () => {
      const sub =
        event.newSubscription ||
        (key &&
          (await self.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: key,
          })))
      if (!sub) return
      const json = sub.toJSON()
      const post = () =>
        fetch("/api/notifications/subscriptions", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
        })
      let res = await post()
      if (res.status === 401) {
        const refreshed = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "same-origin",
        })
        if (refreshed.ok) res = await post()
      }
    })().catch(() => {})
  )
})
