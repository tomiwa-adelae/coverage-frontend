import {
  onlineManager,
  type Mutation,
  type QueryClient,
} from "@tanstack/react-query"
import { ApiError, api } from "./api"
import type { NewTask, ProspectDetail, Task, TaskInput } from "./types"
import type { QuickLogInput } from "./queries"

// Contact logs and to-dos made with no signal wait on the phone (saved with
// the offline cache) and send themselves once the connection is back. Each
// carries an id made here, so one sent twice over a flaky line saves once.

export const QUEUED_KEYS = ["quickLog", "createTask", "updateTask"] as const

/** No response at all, or the host saying the server is starting up. */
export const isNetworkError = (e: unknown) =>
  e instanceof ApiError && [0, 502, 503, 504].includes(e.status)

let probe: ReturnType<typeof setInterval> | null = null

/**
 * The browser often says it's online when it can't reach anything (weak
 * signal), so a failed send marks the app offline and checks back until the
 * server answers; paused sends then go out on their own.
 */
function wentOffline() {
  onlineManager.setOnline(false)
  probe ??= setInterval(async () => {
    const up = await fetch("/api/health", { cache: "no-store" })
      .then((r) => r.ok)
      .catch(() => false)
    if (up) {
      clearInterval(probe!)
      probe = null
      onlineManager.setOnline(true)
    }
  }, 10_000)
}

async function send<T>(fn: () => Promise<T>) {
  try {
    return await fn()
  } catch (e) {
    if (isNetworkError(e)) wentOffline()
    throw e
  }
}

export const sendQuickLog = ({ id, ...body }: QuickLogInput) =>
  send(() =>
    api<ProspectDetail>(`/prospects/${id}/activities`, {
      method: "POST",
      body,
    })
  )

export const sendCreateTask = (body: NewTask) =>
  send(() => api<Task>("/tasks", { method: "POST", body }))

export const sendUpdateTask = ({ id, ...body }: TaskInput & { id: string }) =>
  send(() =>
    api<Task & { next: Task | null }>(`/tasks/${id}`, {
      method: "PATCH",
      body,
    })
  )

/**
 * Registered on the client so sends restored after a reload still know how
 * to run and what to refresh afterwards.
 */
export function registerQueuedMutations(client: QueryClient) {
  const retry = {
    retry: (n: number, e: Error) => isNetworkError(e) && n < 30,
    retryDelay: (n: number) => Math.min(30_000, 1_000 * 2 ** n),
  }
  const refresh =
    (...keys: string[][]) =>
    () =>
      Promise.all(
        keys.map((queryKey) => client.invalidateQueries({ queryKey }))
      )
  client.setMutationDefaults(["quickLog"], {
    mutationFn: sendQuickLog,
    onSuccess: refresh(["prospects"], ["dashboard"], ["tasks"]),
    ...retry,
  })
  const tasksChanged = refresh(
    ["tasks"],
    ["prospects", "detail"],
    ["dashboard"]
  )
  client.setMutationDefaults(["createTask"], {
    mutationFn: sendCreateTask,
    onSuccess: tasksChanged,
    ...retry,
  })
  client.setMutationDefaults(["updateTask"], {
    mutationFn: sendUpdateTask,
    onSettled: tasksChanged,
    ...retry,
  })
}

export const isQueued = (m: Mutation<unknown, Error, unknown, unknown>) =>
  QUEUED_KEYS.includes(m.options.mutationKey?.[0] as never) &&
  m.state.status === "pending"

/**
 * Sends now, or if there's no connection, leaves it queued and says so, so a
 * dialog can close instead of waiting for signal.
 */
export function sendOrQueue<V>(
  client: QueryClient,
  mutateAsync: (v: V) => Promise<unknown>,
  vars: V
): Promise<"sent" | "queued"> {
  let unsubscribe = () => {}
  const queued = new Promise<"queued">((resolve) => {
    unsubscribe = client.getMutationCache().subscribe((ev) => {
      if (ev.mutation?.state.variables === vars && ev.mutation.state.isPaused)
        resolve("queued")
    })
  })
  const sent = mutateAsync(vars).then(() => "sent" as const)
  return Promise.race([sent, queued]).finally(unsubscribe)
}
