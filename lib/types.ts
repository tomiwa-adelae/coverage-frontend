export const STAGES = [
  "IDENTIFIED",
  "CONTACTED",
  "INTERESTED",
  "FORMS_SENT",
  "FORMS_RECEIVED",
  "ACCOUNT_OPENED",
  "FUNDED",
  "DECLINED",
] as const
export type Stage = (typeof STAGES)[number]

export const STAGE_LABEL: Record<Stage, string> = {
  IDENTIFIED: "Identified",
  CONTACTED: "Contacted",
  INTERESTED: "Interested",
  FORMS_SENT: "Forms sent",
  FORMS_RECEIVED: "Forms received",
  ACCOUNT_OPENED: "Account opened",
  FUNDED: "Funded",
  DECLINED: "Declined",
}

export const TIERS = ["A", "B", "C"] as const
export type Tier = (typeof TIERS)[number]

export const TIER_HINT: Record<Tier, string> = {
  A: "Large potential and likely to move",
  B: "Decent potential or a warm relationship",
  C: "Small or cold",
}

export const TOUCHES = [
  "CALL",
  "WHATSAPP",
  "VISIT",
  "MEETING",
  "EMAIL",
  "SMS",
] as const
export type Touch = (typeof TOUCHES)[number]

export const TOUCH_LABEL: Record<Touch, string> = {
  CALL: "Call",
  WHATSAPP: "WhatsApp",
  VISIT: "Visit",
  MEETING: "Meeting",
  EMAIL: "Email",
  SMS: "SMS",
}

export interface Prospect {
  id: string
  name: string
  company: string | null
  group: string | null
  phone: string | null
  email: string | null
  tier: Tier | null
  stage: Stage
  potential: number | null
  funded: number | null
  nextAction: string | null
  nextDate: string | null
  notes: string | null
  lastContactAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Activity {
  id: string
  type: Touch | "STAGE_CHANGE"
  note: string | null
  fromStage: Stage | null
  toStage: Stage | null
  occurredAt: string
}

export interface ProspectDetail extends Prospect {
  activities: Activity[]
}

export type ProspectInput = Partial<
  Omit<Prospect, "id" | "lastContactAt" | "createdAt" | "updatedAt">
>

export interface Me {
  id: string
  name: string
  email: string
  role: string
  timezone: string
  targetAmount: number
  targetStartDate: string
  dailyGoal: number
}

export interface GoalData {
  daily: number
  streak: number
  week: { date: string; touches: number }[]
}

export interface TodayData {
  today: string
  touchesToday: number
  goal: GoalData
  overdue: Prospect[]
  dueToday: Prospect[]
  noNextStep: Prospect[]
  upcoming: Prospect[]
  unrated: Prospect[]
}

export interface ProgressData {
  today: string
  target: number
  targetStartDate: string
  funded: number
  openPotential: number
  accountsOpened: number
  formsOut: number
  touchesThisWeek: number
  weeks: { weekStart: string; touches: number; accountsOpened: number }[]
  byStage: { stage: Stage; count: number }[]
  byTier: { tier: Tier | null; count: number; potential: number }[]
}

export interface ProspectsMeta {
  groups: string[]
  stageCounts: Record<Stage, number>
}

export interface Template {
  id: string
  name: string
  body: string
  position: number
}

export type TemplateInput = Pick<Template, "name" | "body">
