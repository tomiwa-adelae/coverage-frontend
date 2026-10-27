"use client"

import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query"
import { toast } from "sonner"
import { api } from "./api"
import type {
  Me,
  ProgressData,
  Prospect,
  ProspectDetail,
  ProspectInput,
  ProspectsMeta,
  Template,
  TemplateInput,
  TodayData,
  Touch,
} from "./types"

export interface ProspectFilters {
  q?: string
  stage?: string
  tier?: string
  group?: string
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

export function useCreateProspect() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (body: ProspectInput) =>
      api<Prospect>("/prospects", { method: "POST", body }),
    onSuccess: invalidate,
    onError,
  })
}

export function useUpdateProspect(id: string) {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (body: ProspectInput) =>
      api<Prospect>(`/prospects/${id}`, { method: "PATCH", body }),
    onSuccess: invalidate,
    onError,
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
  note?: string
  nextDate?: string
  nextAction?: string
}

/** Log a contact and set the follow-up in one call. */
export function useQuickLog() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: ({ id, ...body }: QuickLogInput) =>
      api<ProspectDetail>(`/prospects/${id}/activities`, {
        method: "POST",
        body,
      }),
    onSuccess: invalidate,
    onError,
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
    mutationFn: (body: { type: Touch; note?: string }) =>
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

export function useUpdateMe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (
      body: Partial<
        Pick<Me, "name" | "targetAmount" | "targetStartDate" | "dailyGoal">
      >
    ) => api<Me>("/users/me", { method: "PATCH", body }),
    onSuccess: (me) => {
      qc.setQueryData(["me"], me)
      qc.invalidateQueries({ queryKey: ["dashboard"] })
    },
    onError,
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
    onError,
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
