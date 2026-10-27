export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
  }
}

let refreshing: Promise<boolean> | null = null

function refresh() {
  refreshing ??= fetch("/api/auth/refresh", { method: "POST" })
    .then((r) => r.ok)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

/** JSON fetch against the Nest API. Retries once after refreshing an expired session. */
export async function api<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
  retry = true
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init.method ?? "GET",
    headers: init.body ? { "Content-Type": "application/json" } : undefined,
    body: init.body ? JSON.stringify(init.body) : undefined,
  })

  if (res.status === 401 && retry && !path.startsWith("/auth/")) {
    if (await refresh()) return api<T>(path, init, false)
    window.location.href = "/login"
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null)
    const msg = Array.isArray(data?.message)
      ? data.message[0]
      : (data?.message ?? "Something went wrong")
    throw new ApiError(res.status, msg)
  }

  return res.status === 204 ? (undefined as T) : res.json()
}
