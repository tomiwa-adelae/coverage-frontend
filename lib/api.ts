import { clearOfflineCache } from "./offline-cache"

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Per-field messages from the API's validation, keyed by field name. */
    public fields: Record<string, string> = {}
  ) {
    super(message)
  }
}

let refreshing: Promise<boolean> | null = null

function refresh() {
  refreshing ??= fetch("/api/auth/refresh", { method: "POST" })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

/** What to say when the response carries no usable message. */
function fallbackMessage(status: number) {
  if (status === 401) return "Your session has ended. Please sign in again."
  if (status === 403) return "You don’t have permission to do that."
  if (status === 404) return "We couldn’t find what you were looking for."
  if (status === 413) return "That file is too large."
  if (status === 429)
    return "Too many attempts. Please wait a minute and try again."
  // The host returns these while the server is starting or redeploying.
  if (status === 502 || status === 503 || status === 504)
    return "The server is starting up. Please try again in a few seconds."
  if (status >= 500)
    return "Something went wrong on our side. Please try again."
  return "That didn’t work. Please check the details and try again."
}

/** JSON fetch against the Nest API. Retries once after refreshing an expired session. */
export async function api<T>(
  path: string,
  /** `raw` sends bytes as-is (audio uploads) instead of JSON. */
  init: { method?: string; body?: unknown; raw?: Blob } = {},
  retry = true
): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? "GET",
      headers: init.raw
        ? { "Content-Type": init.raw.type || "application/octet-stream" }
        : init.body
          ? { "Content-Type": "application/json" }
          : undefined,
      body: init.raw ?? (init.body ? JSON.stringify(init.body) : undefined),
    })
  } catch {
    throw new ApiError(
      0,
      navigator.onLine === false
        ? "You’re offline. Check your internet connection and try again."
        : "We couldn’t reach the server. Check your connection and try again."
    )
  }

  if (res.status === 401 && retry && !path.startsWith("/auth/")) {
    if (await refresh()) return api<T>(path, init, false)
    clearOfflineCache()
    window.location.href = "/login"
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null)
    const raw = Array.isArray(data?.message) ? data.message[0] : data?.message
    // Never surface generic framework text like "Internal server error".
    const generic =
      !raw ||
      typeof raw !== "string" ||
      /^(internal server error|bad request|not found|forbidden|unauthorized|bad gateway|service unavailable)$/i.test(
        raw
      )
    throw new ApiError(
      res.status,
      generic ? fallbackMessage(res.status) : raw,
      data?.errors ?? {}
    )
  }

  // Actions that return nothing come back as 204 or an empty 200/201.
  const text = res.status === 204 ? "" : await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}
