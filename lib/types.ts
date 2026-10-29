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

export const PRODUCTS = [
  "CURRENT",
  "SAVINGS",
  "FIXED_DEPOSIT",
  "DOMICILIARY",
  "POS",
  "LOAN",
  "PAYROLL",
  "TRADE",
  "DIGITAL",
] as const
export type Product = (typeof PRODUCTS)[number]

export const PRODUCT_LABEL: Record<Product, string> = {
  CURRENT: "Current account",
  SAVINGS: "Savings",
  FIXED_DEPOSIT: "Fixed deposit",
  DOMICILIARY: "Domiciliary (FX)",
  POS: "POS terminal",
  LOAN: "Loan / overdraft",
  PAYROLL: "Payroll",
  TRADE: "Trade services",
  DIGITAL: "Internet & mobile banking",
}

export const SOURCES = [
  "REFERRAL",
  "EXISTING_CUSTOMER",
  "PERSONAL_NETWORK",
  "WALK_IN",
  "EVENT",
  "COLD_OUTREACH",
  "SOCIAL_MEDIA",
  "OTHER",
] as const
export type Source = (typeof SOURCES)[number]

export const SOURCE_LABEL: Record<Source, string> = {
  REFERRAL: "Referral",
  EXISTING_CUSTOMER: "Existing customer",
  PERSONAL_NETWORK: "Personal network",
  WALK_IN: "Walk-in",
  EVENT: "Event",
  COLD_OUTREACH: "Cold outreach",
  SOCIAL_MEDIA: "Social media",
  OTHER: "Other",
}

export const OUTCOMES = [
  "INTERESTED",
  "CALL_BACK",
  "NOT_NOW",
  "NO_ANSWER",
  "WRONG_NUMBER",
  "NOT_INTERESTED",
] as const
export type Outcome = (typeof OUTCOMES)[number]

export const OUTCOME_LABEL: Record<Outcome, string> = {
  INTERESTED: "Interested",
  CALL_BACK: "Call back later",
  NOT_NOW: "Not right now",
  NO_ANSWER: "No answer",
  WRONG_NUMBER: "Wrong number",
  NOT_INTERESTED: "Not interested",
}

export const CONSENT_METHODS = [
  "VERBAL",
  "WRITTEN",
  "WHATSAPP",
  "EMAIL",
  "FORM",
] as const
export type ConsentMethod = (typeof CONSENT_METHODS)[number]

export const CONSENT_LABEL: Record<ConsentMethod, string> = {
  VERBAL: "Said yes in person or on a call",
  WRITTEN: "Signed or written",
  WHATSAPP: "Agreed on WhatsApp",
  EMAIL: "Agreed by email",
  FORM: "Account opening form",
}

export const LOST_REASONS = [
  "Happy with current bank",
  "Rates or charges",
  "Not ready yet",
  "Couldn’t reach them",
  "Went with another bank",
  "Documentation issues",
]

export const WON_REASONS = [
  "Better rates",
  "Relationship with me",
  "Referral from a customer",
  "Product fit",
  "Service speed",
]

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
  /** Local "HH:MM" on nextDate; set means a timed reminder. */
  nextTime: string | null
  notes: string | null
  lastContactAt: string | null
  stageChangedAt: string
  outcomeReason: string | null
  source: Source | null
  wantsProducts: Product[]
  holdsProducts: Product[]
  referredById: string | null
  /** "MM-DD" */
  birthday: string | null
  area: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  consentAt: string | null
  consentMethod: ConsentMethod | null
  consentNote: string | null
  cadenceId: string | null
  cadenceStep: number | null
  cadenceStart: string | null
  remindedFor: string | null
  createdAt: string
  updatedAt: string
}

export interface Activity {
  id: string
  type: Touch | "STAGE_CHANGE"
  outcome: Outcome | null
  note: string | null
  fromStage: Stage | null
  toStage: Stage | null
  occurredAt: string
}

export interface ProspectRef {
  id: string
  name: string
  stage?: Stage
}

export type Repeat = "DAILY" | "WEEKLY" | "MONTHLY"

export const REPEAT_LABEL: Record<Repeat, string> = {
  DAILY: "Every weekday",
  WEEKLY: "Every week",
  MONTHLY: "Every month",
}

export type ChecklistKind = "INDIVIDUAL" | "BUSINESS"

/** A to-do: general, or about one prospect. */
export interface Task {
  id: string
  title: string
  dueDate: string | null
  dueTime: string | null
  repeat: Repeat | null
  /** Set on account-opening checklist items. */
  checklist: ChecklistKind | null
  prospect: { id: string; name: string; company: string | null } | null
  doneAt: string | null
  createdAt: string
}

export interface TaskInput {
  title?: string
  dueDate?: string | null
  dueTime?: string | null
  repeat?: Repeat | null
  prospectId?: string | null
  done?: boolean
}

export interface NewTask extends TaskInput {
  title: string
  /** Made on the phone so it shows at once and is saved once. */
  id?: string
  /** What suggested it, e.g. "cross-sell:<prospect>:POS". */
  source?: string
}

export interface ProspectDetail extends Prospect {
  tasks: Task[]
  activities: Activity[]
  referredBy: ProspectRef | null
  referrals: ProspectRef[]
  sameCompany: ProspectRef[]
  cadence: Pick<Cadence, "id" | "name" | "steps"> | null
  balances: { month: string; amount: number }[]
}

export type ProspectInput = Partial<
  Omit<
    Prospect,
    | "id"
    | "lastContactAt"
    | "createdAt"
    | "updatedAt"
    | "stageChangedAt"
    | "consentAt"
    | "cadenceStep"
    | "cadenceStart"
    | "remindedFor"
  >
>

export interface Me {
  id: string
  name: string
  email: string
  role: string
  phone: string | null
  jobTitle: string | null
  branch: string | null
  avatarUrl: string | null
  createdAt: string
  timezone: string
  targetAmount: number
  targetStartDate: string
  targetEndDate: string | null
  dailyGoal: number
  digestEmail: boolean
  digestPush: boolean
  digestHour: number
  managerEmail: string | null
  weeklyReport: boolean
  /** Minutes before a timed follow-up to remind; -1 is off. */
  reminderLead: number
  /** Local hour for the evening "Debrief your day" push; -1 = off. */
  debriefHour: number
  twoFactorEnabled: boolean
  teamId: string | null
  teamRole: "MANAGER" | "MEMBER" | null
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
  pace: {
    current: number
    target: number
    projected: number
    onPace: boolean
    endMonth: string
  }
  /** Overdue and due today, most valuable first. */
  focus: (Prospect & { score: number })[]
  overdue: Prospect[]
  dueToday: Prospect[]
  /** Today's follow-ups with a time, in time order. */
  appointments: Prospect[]
  noNextStep: Prospect[]
  upcoming: Prospect[]
  unrated: Prospect[]
  stale: (Prospect & { daysInStage: number; staleAfter: number })[]
  staleCount: number
  birthdays: (Prospect & { inDays: number })[]
  /** Missing on copies cached before customer care. */
  balanceDrops?: BalanceDrop[]
  care?: {
    drops: number
    checkIns: number
    referralAsks: number
    crossSell: number
  }
}

type Customer = Prospect & { referrals: number }

export interface BalanceDrop {
  prospectId: string
  /** YYYY-MM of the lower balance. */
  month: string
  from: number
  to: number
  drop: number
  prospect: Customer
}

export interface CustomersData {
  today: string
  drops: BalanceDrop[]
  checkIns: (Customer & { daysSinceContact: number; careDays: number })[]
  referralAsks: (Customer & { fundedDays: number })[]
  crossSell: { product: Product; reason: string; prospect: Customer }[]
}

export interface StageForecast {
  stage: Stage
  count: number
  potential: number
  probability: number
  weighted: number
  missingPotential: number
}

export interface TargetData {
  today: string
  target: number
  startMonth: string
  endMonth: string
  currentMonth: string
  series: { month: string; total: number }[]
  current: number
  average: number
  perMonth: number
  projected: number
  monthsLeft: number
  onPace: boolean
  gap: number
  neededPerMonth: number
  forecast: {
    byStage: StageForecast[]
    weighted: number
    potential: number
    expected: number
    coverage: number
  }
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
  targetStatus: TargetData
  bySource: {
    source: Source | null
    count: number
    won: number
    lost: number
    winRate: number | null
    balance: number
  }[]
  lostReasons: { reason: string; count: number }[]
  wonReasons: { reason: string; count: number }[]
  avgDaysToOpen: number | null
  products: { product: Product; wanted: number; held: number }[]
}

export interface ProspectsMeta {
  groups: string[]
  areas: string[]
  stageCounts: Record<Stage, number>
  channels: { email: boolean; sms: boolean }
}

export interface CadenceStep {
  day: number
  type: Touch
  action: string
}

export interface Cadence {
  id: string
  name: string
  steps: CadenceStep[]
  prospectCount: number
}

export interface BalanceRow {
  id: string
  name: string
  company: string | null
  tier: Tier | null
  stage: Stage
  amount: number | null
  previous: { month: string; amount: number } | null
}

export interface BalanceSheet {
  month: string
  rows: BalanceRow[]
}

export interface SessionInfo {
  id: string
  userAgent: string | null
  ip: string | null
  createdAt: string
  lastUsedAt: string
  current: boolean
}

export interface SecurityData {
  twoFactorEnabled: boolean
  backupCodesLeft: number
  sessions: SessionInfo[]
}

export interface AuditEntry {
  id: string
  action: string
  label: string
  detail: string | null
  ip: string | null
  userAgent: string | null
  createdAt: string
}

export interface TeamMember {
  id: string
  name: string
  jobTitle: string | null
  branch: string | null
  avatarUrl: string | null
  role: "MANAGER" | "MEMBER"
  isMe: boolean
  balance: number
  target: number
  progress: number
  projected: number
  onPace: boolean
  weightedPipeline: number
  contactsThisWeek: number
  accountsOpened30d: number
}

export interface Team {
  id: string
  name: string
  role: "MANAGER" | "MEMBER"
  inviteCode: string | null
  totals: {
    balance: number
    target: number
    contactsThisWeek: number
    weightedPipeline: number
  }
  members: TeamMember[]
}

export interface WeeklyReport {
  user: {
    name: string
    email: string
    jobTitle: string | null
    branch: string | null
  }
  weekStart: string
  contacts: number
  accountsOpened: number
  balance: number
  target: number
  projected: number
  onPace: boolean
  endMonth: string
  weightedPipeline: number
  stages: { stage: Stage; count: number }[]
  opportunities: {
    name: string
    company: string | null
    stage: Stage
    potential: number
  }[]
  tasksDone: number
  documentsCollected: number
  completed: { title: string; prospect: string | null }[]
}

export interface Brief {
  summary: string
  promised: string[]
  pitch: string[]
  questions: string[]
  watchOut: string[]
}

export interface Draft {
  /** Empty for WhatsApp and SMS. */
  subject: string
  body: string
}

export interface TidiedNote {
  note: string
  outcome: Outcome | null
  nextAction: string | null
  nextInDays: number | null
}

/** Fields the card didn't show come back empty. */
export interface CardScan {
  name: string
  company: string
  jobTitle: string
  phone: string
  email: string
  address: string
}

export interface Template {
  id: string
  name: string
  body: string
  position: number
}

export type TemplateInput = Pick<Template, "name" | "body">

export type DebriefStatus =
  "UPLOADING" | "PROCESSING" | "READY" | "FAILED" | "APPLIED"

/** One person the assistant picked out of a debrief, for review. */
export interface DebriefSuggestion {
  key: string
  mention: string
  match: "EXISTING" | "NEW" | "UNSURE"
  prospectId: string | null
  candidates: { id: string; name: string; company: string | null }[]
  newProspect: { name: string; company: string; phone: string; area: string }
  contact: {
    type: Touch
    date: string
    outcome: Outcome | null
    note: string
  } | null
  note: string
  stage: Stage | null
  outcomeReason: string
  potential: number | null
  funded: number | null
  tier: Tier | null
  wantsProducts: Product[]
  holdsProducts: Product[]
  referredById: string | null
  nextAction: string
  nextDate: string | null
  nextTime: string | null
  /** Suggested to-dos for this person. */
  tasks?: SuggestedTask[]
  check: string[]
}

export interface DebriefApplied {
  name: string
  ok: boolean
  prospectId?: string
  created?: boolean
  error?: string
}

export interface Debrief {
  id: string
  status: DebriefStatus
  /** While PROCESSING */
  step: "TRANSCRIBING" | "READING" | null
  transcript: string | null
  result: {
    items: DebriefSuggestion[]
    /** Suggested general to-dos. */
    tasks?: SuggestedTask[]
    other: string[]
  } | null
  applied: DebriefApplied[] | null
  /** Saved debriefs can be undone until this time. */
  undoUntil: string | null
  error: string | null
  createdAt: string
  updatedAt: string
}

export interface DebriefSummary {
  id: string
  status: DebriefStatus
  createdAt: string
  people: number
  preview: string | null
}

/** What one reviewed person sends back to be saved. */
export interface DebriefApplyItem {
  prospectId?: string
  newProspect?: {
    name: string
    company?: string
    phone?: string
    area?: string
  }
  contact?: { type: Touch; outcome?: Outcome; note?: string; date: string }
  note?: string
  stage?: Stage
  outcomeReason?: string
  potential?: number
  funded?: number
  tier?: Tier
  wantsProducts?: Product[]
  holdsProducts?: Product[]
  referredById?: string
  nextAction?: string
  nextDate?: string
  nextTime?: string
  tasks?: SuggestedTask[]
}

export interface SuggestedTask {
  title: string
  dueDate?: string | null
  dueTime?: string | null
}
