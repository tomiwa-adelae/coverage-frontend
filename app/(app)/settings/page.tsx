"use client"

import { useState } from "react"
import Link from "next/link"
import { IconChevronRight } from "@tabler/icons-react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { naira, parseMoney } from "@/lib/format"
import { useMe, useUpdateMe } from "@/lib/queries"
import type { Me } from "@/lib/types"
import { PageHeader, PageSection } from "@/components/section"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

export default function SettingsPage() {
  const { data: me } = useMe()
  if (!me) return <Skeleton className="h-64 w-full" />
  return (
    <SettingsForm
      key={me.targetAmount + me.targetStartDate + me.name + me.dailyGoal}
      me={me}
    />
  )
}

function SettingsForm({ me }: { me: Me }) {
  const update = useUpdateMe()
  const [name, setName] = useState(me.name)
  const [target, setTarget] = useState(String(me.targetAmount))
  const [start, setStart] = useState(me.targetStartDate)
  const [dailyGoal, setDailyGoal] = useState(String(me.dailyGoal))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const targetAmount = parseMoney(target)
    if (!targetAmount) return toast.error("Enter a target amount.")
    const goal = Number(dailyGoal)
    if (!Number.isInteger(goal) || goal < 1 || goal > 200)
      return toast.error("Daily goal must be between 1 and 200.")
    await update.mutateAsync({
      name,
      targetAmount,
      targetStartDate: start,
      dailyGoal: goal,
    })
    toast.success("Settings saved")
  }

  async function signOut() {
    await api("/auth/logout", { method: "POST" }).catch(() => {})
    window.location.href = "/login"
  }

  return (
    <>
      <PageHeader title="Settings" />
      <PageSection title="Your target">
        <form
          onSubmit={save}
          className="rounded-xl border bg-card p-4 shadow-xs"
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="target">Target (₦)</FieldLabel>
              <Input
                id="target"
                inputMode="numeric"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
              <FieldDescription>{naira(parseMoney(target))}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="start">Measurement starts</FieldLabel>
              <Input
                id="start"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
              <FieldDescription>
                The first day of your confirmation period.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="daily-goal">Daily contact goal</FieldLabel>
              <Input
                id="daily-goal"
                type="number"
                inputMode="numeric"
                min={1}
                max={200}
                value={dailyGoal}
                onChange={(e) => setDailyGoal(e.target.value)}
              />
              <FieldDescription>
                Calls, WhatsApps, visits and meetings you aim to log each day.
                Hit it on consecutive days to build a streak.
              </FieldDescription>
            </Field>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save"}
            </Button>
          </FieldGroup>
        </form>
      </PageSection>

      <PageSection title="Message templates">
        <Link
          href="/templates"
          className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 text-sm shadow-xs transition-colors hover:bg-muted/50"
        >
          <span>
            <span className="block font-medium">Edit your templates</span>
            <span className="block text-muted-foreground">
              Reusable WhatsApp, SMS and email messages.
            </span>
          </span>
          <IconChevronRight className="size-4 text-muted-foreground" />
        </Link>
      </PageSection>

      <PageSection title="Account">
        <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-xs">
          <span className="min-w-0 truncate text-sm text-muted-foreground">
            {me.email}
          </span>
          <Button variant="outline" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </PageSection>
    </>
  )
}
