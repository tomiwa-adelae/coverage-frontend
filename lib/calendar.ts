import { addDays } from "./format"

export interface CalendarEvent {
  title: string
  date: string // YYYY-MM-DD, all-day
  details?: string
  location?: string
}

const compact = (ymd: string) => ymd.replace(/-/g, "")

/** Opens Google Calendar's "new event" page filled in. */
export function googleCalendarUrl(e: CalendarEvent) {
  const qs = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${compact(e.date)}/${compact(addDays(e.date, 1))}`,
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
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z"
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Coverage//Follow-ups//EN",
    "BEGIN:VEVENT",
    `UID:${uid}@coverage`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compact(e.date)}`,
    `DTEND;VALUE=DATE:${compact(addDays(e.date, 1))}`,
    `SUMMARY:${escape(e.title)}`,
    e.details && `DESCRIPTION:${escape(e.details)}`,
    e.location && `LOCATION:${escape(e.location)}`,
    "BEGIN:VALARM",
    "TRIGGER:PT9H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escape(e.title)}`,
    "END:VALARM",
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
