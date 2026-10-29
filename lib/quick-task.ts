import { addDays } from "./format"
import type { Repeat } from "./types"

// Plain-words quick add: "Collect CAC docs from Musa Friday 10am" becomes a
// to-do for Musa, due Friday at 10:00. Dates, times and "every week" are
// lifted out of the title; the person's name stays in it.

export interface ParsedTask {
  title: string
  dueDate: string | null
  dueTime: string | null
  repeat: Repeat | null
  prospect: { id: string; name: string } | null
}

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
]
const DAY =
  "(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|nesday|rsday|urday|sday)?"
const MONTH = "(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*"

const weekday = (ymd: string) => new Date(`${ymd}T12:00:00Z`).getUTCDay()

/** The next date (after today) that falls on weekday `d`. */
function nextWeekday(today: string, d: number) {
  let diff = (d - weekday(today) + 7) % 7
  if (diff === 0) diff = 7
  return addDays(today, diff)
}

/** "28 Oct" in the coming year: this year unless it has passed. */
function dayMonth(today: string, day: number, month: number) {
  const year = Number(today.slice(0, 4))
  const ymd = (y: number) =>
    `${y}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  const d = ymd(year)
  return d < today ? ymd(year + 1) : d
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

export function parseTask(
  text: string,
  today: string,
  prospects: { id: string; name: string }[] = []
): ParsedTask {
  let rest = ` ${text} `
  let dueDate: string | null = null
  let dueTime: string | null = null
  let repeat: Repeat | null = null

  // Lift out the first match of `re`, returning its groups.
  const take = (re: RegExp) => {
    const m = rest.match(re)
    if (!m) return null
    rest = rest.replace(m[0], " ")
    return m
  }

  // Repeats first, as "every monday" also names a day.
  let m = take(/\s(?:every\s+(?:week)?day|daily)\s/i)
  if (m) repeat = "DAILY"
  m = !repeat ? take(new RegExp(`\\severy\\s+${DAY}\\s`, "i")) : null
  if (m) {
    repeat = "WEEKLY"
    dueDate = nextWeekday(today, DAYS.indexOf(m[1].slice(0, 3).toLowerCase()))
  }
  if (!repeat && take(/\s(?:every\s+week|weekly)\s/i)) repeat = "WEEKLY"
  if (!repeat && take(/\s(?:every\s+month|monthly)\s/i)) repeat = "MONTHLY"

  // Times: "10am", "2:30pm", "at 14:00", "noon".
  m = take(/\s(?:at\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\s/i)
  if (m) {
    let h = Number(m[1]) % 12
    if (m[3].toLowerCase() === "pm") h += 12
    if (h < 24 && Number(m[2] ?? 0) < 60)
      dueTime = `${String(h).padStart(2, "0")}:${m[2] ?? "00"}`
  } else if ((m = take(/\s(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\s/i))) {
    dueTime = `${m[1].padStart(2, "0")}:${m[2]}`
  } else if (take(/\s(?:at\s+)?noon\s/i)) {
    dueTime = "12:00"
  }

  // Dates.
  if (!dueDate) {
    if (take(/\s(?:by\s+|on\s+)?(?:today|tonight)\s/i)) dueDate = today
    else if (take(/\s(?:by\s+|on\s+)?(?:tomorrow|tmrw?|tmr)\s/i))
      dueDate = addDays(today, 1)
    else if (take(/\s(?:by\s+)?next\s+week\s/i)) dueDate = nextWeekday(today, 1)
    else if ((m = take(/\sin\s+(\d{1,3})\s+(day|week)s?\s/i)))
      dueDate = addDays(today, Number(m[1]) * (/w/i.test(m[2]) ? 7 : 1))
    else if (
      (m = take(new RegExp(`\\s(?:by\\s+|on\\s+)?(?:next\\s+)?${DAY}\\s`, "i")))
    )
      dueDate = nextWeekday(today, DAYS.indexOf(m[1].slice(0, 3).toLowerCase()))
    else if (
      (m = take(
        new RegExp(
          `\\s(?:by\\s+|on\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH}\\s`,
          "i"
        )
      ))
    )
      dueDate = dayMonth(
        today,
        Number(m[1]),
        MONTHS.indexOf(m[2].slice(0, 3).toLowerCase())
      )
    else if (
      (m = take(
        new RegExp(
          `\\s(?:by\\s+|on\\s+)?${MONTH}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s`,
          "i"
        )
      ))
    )
      dueDate = dayMonth(
        today,
        Number(m[2]),
        MONTHS.indexOf(m[1].slice(0, 3).toLowerCase())
      )
    else if ((m = take(/\s(?:by\s+|on\s+)?(\d{1,2})\/(\d{1,2})\s/)))
      // Day first, as in Nigeria.
      dueDate = dayMonth(today, Number(m[1]), Number(m[2]) - 1)
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) dueDate = null
  }
  // A repeat needs a start; a time needs a day.
  if (repeat && !dueDate) dueDate = today
  if (dueTime && !dueDate) dueDate = today

  const title = rest
    .replace(/\s+/g, " ")
    .trim()
    // Words left dangling where a date was: "Call Musa on" -> "Call Musa".
    .replace(/\s+(?:on|by|at|for|in)$/i, "")

  return {
    title,
    dueDate,
    dueTime,
    repeat,
    prospect: findProspect(title, prospects),
  }
}

/**
 * The prospect named in the text: full name first, then a first or last name
 * that only one prospect has. Titles like "Chief" or "Mrs" are ignored.
 */
export function findProspect<T extends { id: string; name: string }>(
  text: string,
  prospects: T[]
): T | null {
  const has = (needle: string) =>
    new RegExp(`(^|[^a-z])${escape(needle.toLowerCase())}($|[^a-z])`).test(
      text.toLowerCase()
    )
  const full = prospects
    .filter((p) => p.name.trim().length >= 3 && has(p.name.trim()))
    .sort((a, b) => b.name.length - a.name.length)
  if (full[0]) return full[0]

  const TITLES =
    /^(mr|mrs|ms|miss|dr|chief|alhaji|alhaja|hajia|engr|barr|prof|pastor|madam)\.?$/i
  const byWord = new Map<string, T[]>()
  for (const p of prospects)
    for (const w of p.name.split(/\s+/)) {
      if (w.length < 3 || TITLES.test(w)) continue
      const k = w.toLowerCase()
      byWord.set(k, [...(byWord.get(k) ?? []), p])
    }
  for (const [w, list] of byWord)
    if (list.length === 1 && has(w)) return list[0]
  return null
}
