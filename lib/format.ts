// Dates move around as YYYY-MM-DD strings; "today" comes from the API so it follows
// the user's timezone, not the device clock.

const parse = (ymd: string) => new Date(`${ymd}T12:00:00`)

export function addDays(ymd: string, days: number) {
  const d = parse(ymd)
  d.setDate(d.getDate() + days)
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()]
    .map((n, i) => String(n).padStart(i ? 2 : 4, "0"))
    .join("-")
}

export function localToday() {
  return new Date().toLocaleDateString("en-CA")
}

export function niceDate(ymd: string) {
  return parse(ymd).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

export function longDate(ymd: string) {
  return parse(ymd).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

/** "Today", "Tomorrow", "3d late", or a short date. */
export function relativeDay(ymd: string, today: string) {
  if (ymd === today) return "Today"
  const diff = Math.round(
    (parse(ymd).getTime() - parse(today).getTime()) / 864e5
  )
  if (diff === 1) return "Tomorrow"
  if (diff === -1) return "Yesterday"
  if (diff < 0) return `${-diff}d late`
  return niceDate(ymd)
}

/** 180000000 -> "180,000,000" */
export function formatNumber(n: number | null | undefined) {
  return Math.round(n ?? 0).toLocaleString("en-NG")
}

/** 180000000 -> "₦180,000,000". Money is always whole naira. */
export function naira(n: number | null | undefined) {
  return "₦" + formatNumber(n)
}

/** "just now", "3h ago", "2d ago", "5w ago" for an ISO timestamp. */
export function timeAgo(iso: string) {
  const mins = Math.max(0, (Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${Math.floor(mins)}m ago`
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ago`
  const days = Math.floor(mins / (60 * 24))
  if (days < 14) return `${days}d ago`
  if (days < 60) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

/** Up to two initials, skipping honorifics like Mr, Dr, Aunty. */
export function initials(name: string) {
  const skip =
    /^(mr|mrs|miss|ms|dr|barrister|uncle|aunty|auntie|brother|sister|daddy|mummy|papa|mama|the|and|my)\.?$/i
  const words = name.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w))
  const useful = words.filter((w) => !skip.test(w))
  return (useful.length ? useful : words)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("")
}

/** Digits only, for money inputs. Empty string becomes null. */
export function parseMoney(s: string): number | null {
  const digits = s.replace(/[^\d]/g, "")
  return digits ? Number(digits) : null
}

/** 12500000 -> "₦12.5m", 850000 -> "₦850k". For tight spaces; use naira() elsewhere. */
export function nairaShort(n: number | null | undefined) {
  const v = Math.round(n ?? 0)
  const abs = Math.abs(v)
  const fmt = (x: number) =>
    x.toLocaleString("en-NG", { maximumFractionDigits: x < 10 ? 1 : 0 })
  if (abs >= 1e9) return `₦${fmt(v / 1e9)}bn`
  if (abs >= 1e6) return `₦${fmt(v / 1e6)}m`
  if (abs >= 1e3) return `₦${fmt(v / 1e3)}k`
  return `₦${v}`
}

/** "2026-10" -> "Oct 2026" (or "October 2026" with long). */
export function monthName(ym: string, long = false) {
  return new Date(`${ym}-01T12:00:00`).toLocaleDateString("en-GB", {
    month: long ? "long" : "short",
    year: "numeric",
  })
}
