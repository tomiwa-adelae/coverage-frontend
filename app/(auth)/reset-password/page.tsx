import type { Metadata } from "next"
import { ResetPasswordForm } from "@/components/auth/auth-forms"

export const metadata: Metadata = {
  title: "Reset password",
  // Keep the one-time token out of referrer headers.
  referrer: "no-referrer",
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  return <ResetPasswordForm token={token ?? null} />
}
