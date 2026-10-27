import type { Prospect } from "./types"

export const PLACEHOLDERS = [
  ["{firstName}", "Their first name"],
  ["{name}", "Their full name"],
  ["{company}", "Their business"],
  ["{myName}", "Your name"],
] as const

const HONORIFIC =
  /^(mr|mrs|miss|ms|dr|barrister|chief|alhaji|alhaja|pastor|engr|prof|uncle|aunty|auntie|brother|sister)\.?$/i

/** "Mr. Tunde Bakare" -> "Tunde"; falls back to the whole name. */
export function firstName(name: string) {
  const words = name.trim().split(/\s+/)
  return words.find((w) => !HONORIFIC.test(w)) ?? name.trim()
}

export function fillTemplate(
  body: string,
  p: Pick<Prospect, "name" | "company">,
  myName = ""
) {
  return body
    .replaceAll("{firstName}", firstName(p.name))
    .replaceAll("{name}", p.name)
    .replaceAll("{company}", p.company || "your business")
    .replaceAll("{myName}", myName)
}
