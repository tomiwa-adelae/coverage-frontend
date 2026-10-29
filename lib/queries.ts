"use client"

import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query"
import { toast } from "sonner"
import { api } from "./api"
import { sendCreateTask, sendQuickLog, sendUpdateTask } from "./offline-queue"
import type {
  AuditEntry,
  BalanceSheet,
  Brief,
  Cadence,
  CadenceStep,
  CardScan,
  Debrief,
  DebriefApplyItem,
  DebriefSummary,
  Draft,
  Me,
  NewTask,
  Outcome,
  ProgressData,
  Prospect,
  ProspectDetail,
  ProspectInput,
  ProspectsMeta,
  Template,
  SecurityData,
  ChecklistKind,
  SuggestedTask,
  Task,
  Team,
  TemplateInput,
  TidiedNote,
  TargetData,
  TodayData,
  Touch,
  WeeklyReport,
} from "./types"

export interface ProspectFilters {
  q?: string
  stage?: string
  tier?: string
  group?: string
  area?: string
}

export const useMe = () =>
  useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/users/me") })

export const useToday = () =>
  useQuery({
    queryKey: ["dashboard", "today"],
    queryFn: () => api<TodayData>("/dashboard/today"),
  })

export const useProgress = () =>
  useQuery({
    queryKey: ["dashboard", "progress"],
    queryFn: () => api<ProgressData>("/dashboard/progress"),
  })

export const useTarget = () =>
  useQuery({
    queryKey: ["dashboard", "target"],
    queryFn: () => api<TargetData>("/dashboard/target"),
  })

const filterQs = (filters: ProspectFilters) =>
  new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v) as [string, string][]
  ).toString()

export const prospectsKey = (filters: ProspectFilters) =>
  ["prospects", "list", filterQs(filters)] as const

export function useProspects(filters: ProspectFilters) {
  const qs = filterQs(filters)
  return useQuery({
    queryKey: prospectsKey(filters),
    queryFn: () => api<Prospect[]>(`/prospects${qs ? `?${qs}` : ""}`),
    placeholderData: keepPreviousData,
  })
}

export const useProspectsMeta = () =>
  useQuery({
    queryKey: ["prospects", "meta"],
    queryFn: () => api<ProspectsMeta>("/prospects/meta"),
  })

export const useProspect = (id: string | null) =>
  useQuery({
    queryKey: ["prospects", "detail", id],
    queryFn: () => api<ProspectDetail>(`/prospects/${id}`),
    enabled: !!id,
  })

/** Any prospect change can move it between Today buckets and progress totals. */
function useInvalidateAll() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ["prospects"] })
    qc.invalidateQueries({ queryKey: ["dashboard"] })
  }
}

const onError = (e: Error) => toast.error(e.message)

// ------------------------------------------------------------------ To-dos

export const useTasks = (status: "open" | "done" = "open") =>
  useQuery({
    queryKey: ["tasks", status],
    queryFn: () => api<Task[]>(`/tasks?status=${status}`),
  })

/** Tasks show in lists and on prospect cards, so refresh both. */
function useInvalidateTasks() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ["tasks"] })
    qc.invalidateQueries({ queryKey: ["prospects", "detail"] })
  }
}

/** Queued on the phone when offline; refreshing is set up in offline-queue. */
export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ["createTask"],
    mutationFn: sendCreateTask,
    // With an id it shows in the open list straight away, signal or not.
    onMutate: async (t: NewTask) => {
      if (!t.id) return
      await qc.cancelQueries({ queryKey: ["tasks", "open"] })
      const p = t.prospectId
        ? qc
            .getQueriesData<Prospect[]>({ queryKey: ["prospects", "list"] })
            .flatMap(([, list]) => (Array.isArray(list) ? list : []))
            .find((x) => x.id === t.prospectId)
        : null
      const shown: Task = {
        id: t.id,
        title: t.title,
        dueDate: t.dueDate ?? null,
        dueTime: t.dueTime ?? null,
        repeat: t.repeat ?? null,
        checklist: null,
        prospect: p
          ? { id: p.id, name: p.name, company: p.company ?? null }
          : null,
        doneAt: null,
        createdAt: new Date().toISOString(),
      }
      qc.setQueryData<Task[]>(["tasks", "open"], (list) =>
        list ? [...list, shown] : list
      )
    },
    onError: (e) => {
      qc.invalidateQueries({ queryKey: ["tasks"] })
      onError(e)
    },
  })
}

/** Ticks show straight away; the server catches up behind. */
export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ["updateTask"],
    mutationFn: sendUpdateTask,
    onMutate: async ({ id, done }) => {
      if (done === undefined) return
      await qc.cancelQueries({ queryKey: ["tasks"] })
      const doneAt = done ? new Date().toISOString() : null
      qc.setQueriesData<Task[]>({ queryKey: ["tasks"] }, (list) =>
        list?.map((t) => (t.id === id ? { ...t, doneAt } : t))
      )
      qc.setQueriesData<ProspectDetail>(
        { queryKey: ["prospects", "detail"] },
        (p) =>
          p?.tasks
            ? {
                ...p,
                tasks: p.tasks.map((t) => (t.id === id ? { ...t, doneAt } : t)),
              }
            : p
      )
    },
    onError,
  })
}

export function useDeleteTask() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/tasks/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
    onError,
  })
}

export function useAddChecklist(prospectId: string) {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (kind: ChecklistKind) =>
      api<Task[]>(`/tasks/checklist/${prospectId}`, {
        method: "POST",
        body: { kind },
      }),
    onSuccess: invalidate,
    onError,
  })
}

export function useCreateProspect() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (body: ProspectInput) =>
      api<Prospect>("/prospects", { method: "POST", body }),
    onSuccess: invalidate,
  })
}

export function useUpdateProspect(id: string) {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (body: ProspectInput) =>
      api<Prospect>(`/prospects/${id}`, { method: "PATCH", body }),
    onSuccess: invalidate,
  })
}

/** Update any prospect; the id travels with each call (for list actions and triage). */
export function usePatchProspect() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: ({ id, ...body }: ProspectInput & { id: string }) =>
      api<Prospect>(`/prospects/${id}`, { method: "PATCH", body }),
    onSuccess: invalidate,
    onError,
  })
}

export interface QuickLogInput {
  id: string
  type: Touch
  outcome?: Outcome
  note?: string
  nextDate?: string
  nextTime?: string | null
  nextAction?: string
  /** Made on the phone so a log sent twice is saved once. */
  clientId?: string
}

/**
 * Log a contact and set the follow-up in one call. Queued on the phone when
 * offline (see offline-queue). Callers show errors.
 */
export function useQuickLog() {
  return useMutation({
    mutationKey: ["quickLog"],
    mutationFn: sendQuickLog,
  })
}

export function useDeleteProspect(id: string) {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: () => api<void>(`/prospects/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
    onError,
  })
}

export function useLogActivity(id: string) {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (body: { type: Touch; outcome?: Outcome; note?: string }) =>
      api<ProspectDetail>(`/prospects/${id}/activities`, {
        method: "POST",
        body,
      }),
    onSuccess: invalidate,
    onError,
  })
}

export function useDeleteActivity(prospectId: string) {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (activityId: string) =>
      api<void>(`/prospects/${prospectId}/activities/${activityId}`, {
        method: "DELETE",
      }),
    onSuccess: invalidate,
    onError,
  })
}

export type MeInput = Partial<
  Pick<
    Me,
    | "name"
    | "phone"
    | "jobTitle"
    | "branch"
    | "targetAmount"
    | "targetStartDate"
    | "dailyGoal"
    | "targetEndDate"
    | "digestEmail"
    | "digestPush"
    | "digestHour"
    | "managerEmail"
    | "weeklyReport"
    | "reminderLead"
    | "debriefHour"
  >
>

/** Errors are left to the calling form, which pins them to fields. */
export function useUpdateMe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: MeInput) =>
      api<Me>("/users/me", { method: "PATCH", body }),
    onSuccess: (me) => {
      qc.setQueryData(["me"], me)
      qc.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

export function useAvatar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dataUrl: string | null) =>
      dataUrl
        ? api<Me>("/users/me/avatar", { method: "PUT", body: { dataUrl } })
        : api<Me>("/users/me/avatar", { method: "DELETE" }),
    onSuccess: (me) => qc.setQueryData(["me"], me),
    onError,
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      api<{ ok: true }>("/auth/change-password", { method: "POST", body }),
  })
}

/** Errors are left to the caller so the dialog can stay open with the message. */
export function useSendEmail(prospectId: string) {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (body: { subject: string; body: string }) =>
      api<ProspectDetail>(`/prospects/${prospectId}/email`, {
        method: "POST",
        body,
      }),
    onSuccess: invalidate,
  })
}

export const useTemplates = () =>
  useQuery({
    queryKey: ["templates"],
    queryFn: () => api<Template[]>("/templates"),
  })

export function useSaveTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: TemplateInput & { id?: string }) =>
      id
        ? api<Template>(`/templates/${id}`, { method: "PATCH", body })
        : api<Template>("/templates", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  })
}

export function useDeleteTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/templates/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
    onError,
  })
}

/** Move a card on the pipeline board, updating the cached list first. */
export function useMoveStage(listKey: readonly unknown[]) {
  const qc = useQueryClient()
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: Prospect["stage"] }) =>
      api<Prospect>(`/prospects/${id}`, { method: "PATCH", body: { stage } }),
    onMutate: async ({ id, stage }) => {
      await qc.cancelQueries({ queryKey: listKey })
      const previous = qc.getQueryData<Prospect[]>(listKey)
      qc.setQueryData<Prospect[]>(listKey, (list) =>
        list?.map((p) => (p.id === id ? { ...p, stage } : p))
      )
      return { previous }
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(listKey, ctx.previous)
      onError(e)
    },
    onSettled: invalidate,
  })
}

export function useSendSms(prospectId: string) {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (body: { body: string }) =>
      api<ProspectDetail>(`/prospects/${prospectId}/sms`, {
        method: "POST",
        body,
      }),
    onSuccess: invalidate,
  })
}

// Balances

export const useBalanceSheet = (month?: string) =>
  useQuery({
    queryKey: ["balances", month ?? "current"],
    queryFn: () =>
      api<BalanceSheet>(`/balances${month ? `?month=${month}` : ""}`),
    placeholderData: keepPreviousData,
    // The sheet is a form; a background refetch would wipe what's been typed.
    refetchOnWindowFocus: false,
  })

function useInvalidateBalances() {
  const qc = useQueryClient()
  const invalidate = useInvalidateAll()
  return () => {
    qc.invalidateQueries({ queryKey: ["balances"] })
    invalidate()
  }
}

export function useSaveBalanceSheet() {
  const invalidate = useInvalidateBalances()
  return useMutation({
    mutationFn: (body: {
      month: string
      rows: { prospectId: string; amount: number | null }[]
    }) => api<BalanceSheet>("/balances", { method: "PUT", body }),
    onSuccess: invalidate,
  })
}

export function useSetBalance(prospectId: string) {
  const invalidate = useInvalidateBalances()
  return useMutation({
    mutationFn: (body: { month: string; amount: number }) =>
      api<ProspectDetail>(`/prospects/${prospectId}/balances`, {
        method: "PUT",
        body,
      }),
    onSuccess: invalidate,
  })
}

export function useRemoveBalance(prospectId: string) {
  const invalidate = useInvalidateBalances()
  return useMutation({
    mutationFn: (month: string) =>
      api<ProspectDetail>(`/prospects/${prospectId}/balances/${month}`, {
        method: "DELETE",
      }),
    onSuccess: invalidate,
    onError,
  })
}

// Import

export interface ImportResult {
  created: number
  skipped: { row: number; name: string; reason: string }[]
}

export function useImportProspects() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (rows: ProspectInput[]) =>
      api<ImportResult>("/prospects/import", {
        method: "POST",
        body: { rows },
      }),
    onSuccess: invalidate,
  })
}

// Plans (cadences)

export const useCadences = () =>
  useQuery({
    queryKey: ["cadences"],
    queryFn: () => api<Cadence[]>("/cadences"),
  })

export type CadenceInput = { name: string; steps: CadenceStep[] }

export function useSaveCadence() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: CadenceInput & { id?: string }) =>
      id
        ? api<Cadence>(`/cadences/${id}`, { method: "PATCH", body })
        : api<Cadence>("/cadences", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cadences"] }),
  })
}

export function useDeleteCadence() {
  const qc = useQueryClient()
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/cadences/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cadences"] })
      invalidate()
    },
    onError,
  })
}

// AI

export const useAiStatus = () =>
  useQuery({
    queryKey: ["ai", "status"],
    queryFn: () => api<{ enabled: boolean }>("/ai/status"),
    staleTime: Infinity,
  })

/** AI calls leave errors to the caller, which shows them in place. */
export const useBrief = () =>
  useMutation({
    mutationFn: (prospectId: string) =>
      api<Brief>(`/ai/prospects/${prospectId}/brief`, { method: "POST" }),
  })

export const useDraft = () =>
  useMutation({
    mutationFn: ({
      prospectId,
      ...body
    }: {
      prospectId: string
      channel: "WHATSAPP" | "EMAIL" | "SMS"
      goal?: string
    }) =>
      api<Draft>(`/ai/prospects/${prospectId}/draft`, {
        method: "POST",
        body,
      }),
  })

export const useTidyNote = () =>
  useMutation({
    mutationFn: (body: { text: string; prospectId?: string }) =>
      api<TidiedNote>("/ai/notes", { method: "POST", body }),
  })

export const useScanCard = () =>
  useMutation({
    mutationFn: (image: string) =>
      api<CardScan>("/ai/business-card", { method: "POST", body: { image } }),
  })

// Notifications, digest and the weekly report

export const useNotificationConfig = () =>
  useQuery({
    queryKey: ["notifications", "config"],
    queryFn: () =>
      api<{ pushKey: string | null; email: boolean }>("/notifications/config"),
    staleTime: Infinity,
  })

export const useWeeklyReport = () =>
  useQuery({
    queryKey: ["notifications", "weekly-report"],
    queryFn: () => api<WeeklyReport>("/notifications/weekly-report"),
  })

export const useSendWeeklyReport = () =>
  useMutation({
    mutationFn: () =>
      api<{ ok: true }>("/notifications/weekly-report", { method: "POST" }),
  })

export const useSendDigest = () =>
  useMutation({
    mutationFn: () =>
      api<{ ok: true }>("/notifications/digest", { method: "POST" }),
  })

// Calendar feed

export const useCalendarFeed = () =>
  useQuery({
    queryKey: ["calendar"],
    queryFn: () => api<{ url: string | null }>("/calendar"),
  })

export function useCalendarFeedLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (
      action: "create" | "remove"
    ): Promise<{ url: string | null }> =>
      action === "create"
        ? api<{ url: string }>("/calendar", { method: "POST" })
        : api<void>("/calendar", { method: "DELETE" }).then(() => ({
            url: null,
          })),
    onSuccess: (data) => qc.setQueryData(["calendar"], data),
    onError,
  })
}

// Security

export const useSecurity = () =>
  useQuery({
    queryKey: ["security"],
    queryFn: () => api<SecurityData>("/security"),
  })

export const useSecurityLog = () =>
  useQuery({
    queryKey: ["security", "log"],
    queryFn: () => api<AuditEntry[]>("/security/log"),
  })

function useInvalidateSecurity() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ["security"] })
    qc.invalidateQueries({ queryKey: ["me"] })
  }
}

export function useRevokeSession() {
  const invalidate = useInvalidateSecurity()
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/security/sessions/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
    onError,
  })
}

export function useRevokeOtherSessions() {
  const invalidate = useInvalidateSecurity()
  return useMutation({
    mutationFn: () =>
      api<{ count: number }>("/security/sessions/revoke-others", {
        method: "POST",
      }),
    onSuccess: invalidate,
    onError,
  })
}

export const useSetupTwoFactor = () =>
  useMutation({
    mutationFn: () =>
      api<{ secret: string; otpauthUrl: string }>(
        "/security/two-factor/setup",
        { method: "POST" }
      ),
    onError,
  })

export function useEnableTwoFactor() {
  const invalidate = useInvalidateSecurity()
  return useMutation({
    mutationFn: (code: string) =>
      api<{ backupCodes: string[] }>("/security/two-factor/enable", {
        method: "POST",
        body: { code },
      }),
    onSuccess: invalidate,
  })
}

export function useDisableTwoFactor() {
  const invalidate = useInvalidateSecurity()
  return useMutation({
    mutationFn: (password: string) =>
      api<{ ok: true }>("/security/two-factor/disable", {
        method: "POST",
        body: { password },
      }),
    onSuccess: invalidate,
  })
}

export function useNewBackupCodes() {
  const invalidate = useInvalidateSecurity()
  return useMutation({
    mutationFn: (password: string) =>
      api<{ backupCodes: string[] }>("/security/two-factor/backup-codes", {
        method: "POST",
        body: { password },
      }),
    onSuccess: invalidate,
  })
}

// Team

export const useTeam = () =>
  useQuery({
    queryKey: ["team"],
    queryFn: () => api<{ team: Team | null }>("/teams/mine"),
  })

/** Team changes come back as the new team (or nothing after leaving). */
function useTeamMutation<V>(fn: (v: V) => Promise<Team | null | void>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (team) => {
      qc.setQueryData(["team"], { team: team ?? null })
      qc.invalidateQueries({ queryKey: ["me"] })
    },
  })
}

export const useCreateTeam = () =>
  useTeamMutation((name: string) =>
    api<Team>("/teams", { method: "POST", body: { name } })
  )

export const useJoinTeam = () =>
  useTeamMutation((code: string) =>
    api<Team>("/teams/join", { method: "POST", body: { code } })
  )

export const useLeaveTeam = () =>
  useTeamMutation(() => api<void>("/teams/leave", { method: "POST" }))

export const useRenameTeam = () =>
  useTeamMutation((name: string) =>
    api<Team>("/teams/mine", { method: "PATCH", body: { name } })
  )

export const useNewInviteCode = () =>
  useTeamMutation(() => api<Team>("/teams/invite-code", { method: "POST" }))

export const useRemoveMember = () =>
  useTeamMutation((id: string) =>
    api<Team>(`/teams/members/${id}`, { method: "DELETE" })
  )

// Voice debriefs

export const useDebriefStatus = () =>
  useQuery({
    queryKey: ["debriefs", "status"],
    queryFn: () =>
      api<{ ai: boolean; voice: boolean; provider: string | null }>(
        "/debriefs/status"
      ),
    staleTime: 5 * 60_000,
  })

export const useDebriefs = () =>
  useQuery({
    queryKey: ["debriefs", "list"],
    queryFn: () => api<DebriefSummary[]>("/debriefs"),
  })

/** Polls while the recording is being transcribed and read. */
export const useDebrief = (id: string | null) =>
  useQuery({
    queryKey: ["debriefs", id],
    queryFn: () => api<Debrief>(`/debriefs/${id}`),
    enabled: !!id,
    refetchInterval: (q) =>
      q.state.data?.status === "PROCESSING" ? 2000 : false,
    refetchOnWindowFocus: false,
  })

export function useCreateDebrief() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { text?: string }) =>
      api<Debrief>("/debriefs", { method: "POST", body }),
    onSuccess: (d) => {
      qc.setQueryData(["debriefs", d.id], d)
      qc.invalidateQueries({ queryKey: ["debriefs", "list"] })
    },
  })
}

export function useRereadDebrief(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (transcript: string) =>
      api<Debrief>(`/debriefs/${id}/reread`, {
        method: "POST",
        body: { transcript },
      }),
    onSuccess: (d) => qc.setQueryData(["debriefs", id], d),
    onError,
  })
}

export function useApplyDebrief(id: string) {
  const qc = useQueryClient()
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (body: {
      items: DebriefApplyItem[]
      tasks?: SuggestedTask[]
    }) => api<Debrief>(`/debriefs/${id}/apply`, { method: "POST", body }),
    onSuccess: (d) => {
      qc.setQueryData(["debriefs", id], d)
      invalidate()
      qc.invalidateQueries({ queryKey: ["tasks"] })
    },
    onError,
  })
}

export function useUndoDebrief(id: string) {
  const qc = useQueryClient()
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: () => api<Debrief>(`/debriefs/${id}/undo`, { method: "POST" }),
    onSuccess: (d) => {
      qc.setQueryData(["debriefs", id], d)
      invalidate()
      qc.invalidateQueries({ queryKey: ["tasks"] })
    },
    onError,
  })
}

export function useDeleteDebrief() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/debriefs/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["debriefs", "list"] }),
    onError,
  })
}
