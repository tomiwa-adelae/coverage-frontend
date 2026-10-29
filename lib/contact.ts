/** Nigerian local numbers (0803…) become 234803… for wa.me links. */
export function whatsappNumber(phone: string) {
  const digits = phone.replace(/[^\d]/g, "")
  return digits.startsWith("0") ? `234${digits.slice(1)}` : digits
}

export const whatsappUrl = (phone: string) =>
  `https://wa.me/${whatsappNumber(phone)}`
export const telUrl = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`

/** Follow-up gap by tier, mirroring the API's cadence. */
export const FOLLOW_UP_DAYS = { A: 7, B: 14, C: 30 } as const
export const followUpDays = (tier: keyof typeof FOLLOW_UP_DAYS | null) =>
  tier ? FOLLOW_UP_DAYS[tier] : 7

/** Check-ins with funded customers by tier, mirroring the API's care.ts. */
export const CARE_DAYS = { A: 14, B: 30, C: 90 } as const
export const careDays = (tier: keyof typeof CARE_DAYS | null) =>
  tier ? CARE_DAYS[tier] : 30
