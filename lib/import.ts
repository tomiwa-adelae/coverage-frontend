import {
  SOURCES,
  SOURCE_LABEL,
  STAGES,
  STAGE_LABEL,
  type ProspectInput,
  type Source,
  type Stage,
} from "./types"

export const IMPORT_FIELDS = [
  ["name", "Name"],
  ["company", "Company"],
  ["phone", "Phone"],
  ["email", "Email"],
  ["group", "Group"],
  ["tier", "Tier (A/B/C)"],
  ["stage", "Stage"],
  ["potential", "Deposit potential"],
  ["funded", "Funded balance"],
  ["nextAction", "Next action"],
  ["nextDate", "Next follow-up date"],
  ["area", "Area"],
  ["address", "Address"],
  ["birthday", "Birthday"],
  ["source", "Source"],
  ["notes", "Notes"],
] as const
export type ImportField = (typeof IMPORT_FIELDS)[number][0]

// Header words that point at each field, checked in order (first match wins).
const HINTS: [ImportField, RegExp][] = [
  ["email", /e-?mail/],
  ["phone", /phone|mobile|tel|whatsapp|gsm|contact no|number/],
  ["company", /company|business|organi[sz]ation|employer|firm/],
  ["nextDate", /next.*date|follow.?up|due/],
  ["nextAction", /next.*(action|step)|action|to ?do/],
  ["potential", /potential|expected|estimate|deposit/],
  ["funded", /funded|balance|amount/],
  ["tier", /tier|rating|priority|grade/],
  ["stage", /stage|status/],
  ["group", /group|category|segment|circle/],
  ["area", /area|location|lga|zone|town|city/],
  ["address", /address|street/],
  ["birthday", /birth|dob|bday/],
  ["source", /source|channel|lead from|how .* met/],
  ["notes", /note|comment|remark|detail/],
  ["name", /name|customer|client|prospect|contact/],
]

/** Best guess of which field each column holds; each field used at most once. */
export function guessMapping(headers: string[]): (ImportField | "")[] {
  const used = new Set<ImportField>()
  return headers.map((h) => {
    const text = h.toLowerCase().trim()
    if (!text) return ""
    for (const [field, re] of HINTS)
      if (!used.has(field) && re.test(text)) {
        used.add(field)
        return field
      }
    return ""
  })
}

const PHONE = /^\+?[\d\s()-]{7,}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** "₦1,500,000", "1.5m", "250k", 1500000 -> 1500000 */
export function parseMoney(v: unknown): number | null {
  if (typeof v === "number") return v >= 0 ? Math.round(v) : null
  const s = String(v ?? "")
    .toLowerCase()
    .replace(/[₦ngn,\s]/g, "")
  const m = s.match(/^(\d+(?:\.\d+)?)(k|m|bn|b)?$/)
  if (!m) return null
  const mult = { k: 1e3, m: 1e6, b: 1e9, bn: 1e9 }[m[2] ?? ""] ?? 1
  return Math.round(Number(m[1]) * mult)
}

const pad = (n: number) => String(n).padStart(2, "0")

function toDate(v: unknown): Date | null {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v
  const s = String(v ?? "").trim()
  if (!s) return null
  // Day-first, as written in Nigeria: 05/03/2026 is 5 March.
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/)
  if (dmy) {
    const year = dmy[3]
      ? Number(dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3])
      : 2000
    const d = new Date(year, Number(dmy[2]) - 1, Number(dmy[1]))
    return d.getMonth() === Number(dmy[2]) - 1 ? d : null
  }
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function matchLabel<T extends string>(
  v: string,
  values: readonly T[],
  labels: Record<T, string>
): T | undefined {
  const s = v.toLowerCase().replace(/[^a-z]/g, "")
  return values.find(
    (x) =>
      x.toLowerCase().replace(/_/g, "") === s ||
      labels[x].toLowerCase().replace(/[^a-z]/g, "") === s
  )
}

export interface ParsedRow {
  row: number
  input: ProspectInput & { name: string }
  /** Values we couldn't use, so the user knows before importing. */
  dropped: string[]
}

/** Turns spreadsheet cells into prospect fields the API accepts. */
export function buildRows(
  rows: unknown[][],
  mapping: (ImportField | "")[],
  firstRow: number
): { ok: ParsedRow[]; noName: number[] } {
  const ok: ParsedRow[] = []
  const noName: number[] = []
  rows.forEach((cells, i) => {
    const row = firstRow + i
    const raw: Partial<Record<ImportField, unknown>> = {}
    mapping.forEach((f, c) => {
      const v = cells[c]
      if (!f || v === null || v === undefined || String(v).trim() === "") return
      // Several columns for notes are joined rather than lost.
      raw[f] = f === "notes" && raw.notes ? `${raw.notes}\n${v}` : v
    })
    const text = (f: ImportField, max: number) =>
      raw[f] === undefined
        ? undefined
        : String(raw[f]).trim().slice(0, max) || undefined

    const name = text("name", 160)
    if (!name) {
      if (cells.some((c) => String(c ?? "").trim())) noName.push(row)
      return
    }
    const dropped: string[] = []
    const input: ParsedRow["input"] = {
      name,
      company: text("company", 160),
      group: text("group", 60),
      nextAction: text("nextAction", 200),
      area: text("area", 60),
      address: text("address", 300),
      notes: text("notes", 4000),
    }

    const phone = text("phone", 40)
    if (phone) {
      // Excel drops the leading 0 from numbers: 8031234567 -> 08031234567.
      const fixed = /^[789]\d{9}$/.test(phone) ? `0${phone}` : phone
      if (PHONE.test(fixed)) input.phone = fixed
      else dropped.push(`phone "${phone}"`)
    }
    const email = text("email", 200)
    if (email) {
      if (EMAIL.test(email)) input.email = email.toLowerCase()
      else dropped.push(`email "${email}"`)
    }
    const tier = text("tier", 10)
      ?.toUpperCase()
      .replace(/^TIER\s*/, "")
    if (tier) {
      if (tier === "A" || tier === "B" || tier === "C") input.tier = tier
      else dropped.push(`tier "${tier}"`)
    }
    const stage = text("stage", 40)
    if (stage) {
      const s = matchLabel<Stage>(stage, STAGES, STAGE_LABEL)
      if (s) input.stage = s
      else dropped.push(`stage "${stage}"`)
    }
    const source = text("source", 40)
    if (source) {
      const s = matchLabel<Source>(source, SOURCES, SOURCE_LABEL)
      input.source = s ?? "OTHER"
    }
    for (const f of ["potential", "funded"] as const) {
      if (raw[f] === undefined) continue
      const n = parseMoney(raw[f])
      if (n !== null) input[f] = n
      else
        dropped.push(
          `${f === "funded" ? "funded balance" : "potential"} "${raw[f]}"`
        )
    }
    if (raw.nextDate !== undefined) {
      const d = toDate(raw.nextDate)
      if (d) input.nextDate = ymd(d)
      else dropped.push(`date "${raw.nextDate}"`)
    }
    if (raw.birthday !== undefined) {
      const d = toDate(raw.birthday)
      if (d) input.birthday = `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      else dropped.push(`birthday "${raw.birthday}"`)
    }
    ok.push({ row, input, dropped })
  })
  return { ok, noName }
}
