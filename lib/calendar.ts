import { addDays } from "./format"

export interface CalendarEvent {
  title: string
  date: string // YYYY-MM-DD
  /** HH:MM on the device's clock; without it the event is all-day. */
  time?: string | null
  /** Minutes before a timed event to alert; negative for none. */
  alarmMinutes?: number
  details?: string
  location?: string
}

const compact = (ymd: string) => ymd.replace(/-/g, "")

/** Timed follow-ups are booked as 30 minutes, in local (floating) time. */
function span(e: CalendarEvent) {
  if (!e.time) return null
  const [h, m] = e.time.split(":").map(Number)
  const end = h * 60 + m + 30
  const at = (ymd: string, mins: number) =>
    `${compact(ymd)}T${String(Math.floor(mins / 60)).padStart(2, "0")}${String(mins % 60).padStart(2, "0")}00`
  return {
    start: at(e.date, h * 60 + m),
    end: end >= 1440 ? at(addDays(e.date, 1), end - 1440) : at(e.date, end),
  }
}

/** Opens Google Calendar's "new event" page filled in. */
export function googleCalendarUrl(e: CalendarEvent) {
  const qs = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: span(e)
      ? `${span(e)!.start}/${span(e)!.end}`
      : `${compact(e.date)}/${compact(addDays(e.date, 1))}`,
  })
  if (e.details) qs.set("details", e.details)
  if (e.location) qs.set("location", e.location)
  return `https://calendar.google.com/calendar/render?${qs}`
}

const escape = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n")

/** Downloads a one-event .ics that Apple Calendar, Outlook and others open. */
export function downloadIcs(e: CalendarEvent, uid: string) {
  const timed = span(e)
  // All-day: 9 am on the day. Timed: the user's reminder lead.
  const lead = e.alarmMinutes ?? 30
  const alarm = !timed ? "PT9H" : lead < 0 ? null : `-PT${lead}M`
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z"
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Coverage//Follow-ups//EN",
    "BEGIN:VEVENT",
    `UID:${uid}@coverage`,
    `DTSTAMP:${stamp}`,
    ...(timed
      ? [`DTSTART:${timed.start}`, `DTEND:${timed.end}`]
      : [
          `DTSTART;VALUE=DATE:${compact(e.date)}`,
          `DTEND;VALUE=DATE:${compact(addDays(e.date, 1))}`,
        ]),
    `SUMMARY:${escape(e.title)}`,
    e.details && `DESCRIPTION:${escape(e.details)}`,
    e.location && `LOCATION:${escape(e.location)}`,
    ...(alarm === null
      ? []
      : [
          "BEGIN:VALARM",
          `TRIGGER:${alarm}`,
          "ACTION:DISPLAY",
          `DESCRIPTION:${escape(e.title)}`,
          "END:VALARM",
        ]),
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean)
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "follow-up.ics"
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
