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
