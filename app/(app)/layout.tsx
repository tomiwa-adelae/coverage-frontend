import { Suspense } from "react"
import { AppShell } from "@/components/app-shell"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // AppShell reads search params (?p= for the prospect card), which needs a Suspense boundary.
  return (
    <Suspense>
      <AppShell>{children}</AppShell>
    </Suspense>
  )
}
