import { addDays } from "./format"
import type { Cadence, CadenceStep, Prospect } from "./types"

/**
 * The follow-up a plan step schedules, mirroring the API: a step that falls in
 * the past is due tomorrow instead, never backdated.
 */
export function stepDue(
  steps: CadenceStep[],
  index: number,
  start: string,
  today: string
) {
  const step = steps[index]
  if (!step) return null
  const planned = addDays(start, step.day)
  const earliest = index === 0 ? today : addDays(today, 1)
  return {
    step,
    nextDate: planned < earliest ? earliest : planned,
    nextAction: step.action,
  }
}

/** Where a prospect is in their plan: the step in hand and what logging it schedules. */
export function planProgress(
  p: Pick<Prospect, "cadenceId" | "cadenceStep" | "cadenceStart">,
  cadences: Pick<Cadence, "id" | "name" | "steps">[] | undefined,
  today: string
) {
  const plan = cadences?.find((c) => c.id === p.cadenceId)
  if (!plan || p.cadenceStep === null) return null
  const start = p.cadenceStart ?? today
  return {
    plan,
    index: p.cadenceStep,
    current: plan.steps[p.cadenceStep] ?? null,
    next: stepDue(plan.steps, p.cadenceStep + 1, start, today),
  }
}

/** "Day 0, 2, 7" style summary of a plan. */
export const planSummary = (steps: CadenceStep[]) =>
  `${steps.length} step${steps.length === 1 ? "" : "s"} over ${
    steps.at(-1)?.day ?? 0
  } days`
