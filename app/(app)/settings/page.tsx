"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { z } from "zod"
import {
  IconBell,
  IconCalendarShare,
  IconChevronRight,
  IconCopy,
  IconFileImport,
  IconMessageDots,
  IconReportAnalytics,
  IconRoute,
  IconShieldLock,
  IconUsersGroup,
} from "@tabler/icons-react"
import { addDays, formatNumber, longDate, naira } from "@/lib/format"
import { showFormError } from "@/lib/forms"
import { api } from "@/lib/api"
import {
  currentSubscription,
  disablePush,
  enablePush,
  inAppBrowser,
  isIos,
  needsInstallForPush,
  pushSupported,
} from "@/lib/push"
import {
  useCalendarFeed,
  useCalendarFeedLink,
  useMe,
  useNotificationConfig,
  useSendDigest,
  useUpdateMe,
  type MeInput,
} from "@/lib/queries"
import type { Me } from "@/lib/types"
import { FormField } from "@/components/form-field"
import { MoneyInput, NumberInput } from "@/components/inputs"
import { PageHeader, PageSection } from "@/components/section"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"

const schema = z.object({
  targetAmount: z
    .number({ error: "Enter your target amount" })
    .int()
    .min(1_000_000, "Target must be at least ₦1,000,000")
    .max(1_000_000_000_000, "Target looks too large"),
  targetStartDate: z.string().min(1, "Pick the date your target period starts"),
  targetEndDate: z.string(),
  dailyGoal: z
    .number({ error: "Enter a daily goal" })
    .int()
    .min(1, "Daily goal must be at least 1")
    .max(200, "Daily goal must be 200 or less"),
})
type Values = z.infer<typeof schema>

export default function SettingsPage() {
  const { data: me } = useMe()
  return (
    <>
      <PageHeader title="Settings" />
      {me ? (
        <>
          <ProfileLink me={me} />
          <TargetForm
            key={
              me.targetAmount +
              me.targetStartDate +
              (me.targetEndDate ?? "") +
              me.dailyGoal
            }
            me={me}
          />
          <Notifications me={me} />
          <WeeklyReportSettings key={me.managerEmail ?? ""} me={me} />
          <CalendarFeed />
          <PageSection title="Tools">
            <div className="grid gap-2">
              <LinkCard
                href="/templates"
                icon={IconMessageDots}
                title="Message templates"
                body="Reusable WhatsApp, SMS and email messages."
              />
              <LinkCard
                href="/plans"
                icon={IconRoute}
                title="Follow-up plans"
                body="Step-by-step sequences that schedule your next contact."
              />
              <LinkCard
                href="/import"
                icon={IconFileImport}
                title="Import and export"
                body="Bring in a spreadsheet, or download all your prospects."
              />
              <LinkCard
                href="/team"
                icon={IconUsersGroup}
                title="Team"
                body={
                  me.teamId
                    ? "Your team's leaderboard and invite code."
                    : "Join your manager's team or start one."
                }
              />
              <LinkCard
                href="/security"
                icon={IconShieldLock}
                title="Security"
                body={
                  me.twoFactorEnabled
                    ? "Two-step sign-in is on. Devices and activity."
                    : "Turn on two-step sign-in, see signed-in devices."
                }
              />
            </div>
          </PageSection>
        </>
      ) : (
        <Skeleton className="h-80 w-full" />
      )}
    </>
  )
}

function ProfileLink({ me }: { me: Me }) {
  return (
    <Link
      href="/profile"
      className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-xs transition-colors hover:bg-muted/50"
    >
      <UserAvatar me={me} className="size-11 text-sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{me.name}</span>
        <span className="block truncate text-sm text-muted-foreground">
          Profile, photo and password
        </span>
      </span>
      <IconChevronRight className="size-4 text-muted-foreground" />
    </Link>
  )
}

function LinkCard({
  href,
  title,
  body,
  icon: Icon,
}: {
  href: string
  title: string
  body: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 text-sm shadow-xs transition-colors hover:bg-muted/50"
    >
      {Icon && (
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground">
          <Icon className="size-5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="block text-muted-foreground">{body}</span>
      </span>
      <IconChevronRight className="size-4 text-muted-foreground" />
    </Link>
  )
}

function TargetForm({ me }: { me: Me }) {
  const update = useUpdateMe()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      targetAmount: me.targetAmount,
      targetStartDate: me.targetStartDate,
      targetEndDate: me.targetEndDate ?? "",
      dailyGoal: me.dailyGoal,
    },
  })
  const target = useWatch({ control: form.control, name: "targetAmount" })
  const start = useWatch({ control: form.control, name: "targetStartDate" })

  async function onSubmit(values: Values) {
    try {
      await update.mutateAsync({
        ...values,
        targetEndDate: values.targetEndDate || null,
      })
      toast.success("Settings saved", {
        description: `Target ${naira(values.targetAmount)} · ${formatNumber(values.dailyGoal)} contacts a day`,
      })
    } catch (e) {
      showFormError(form, e)
    }
  }

  return (
    <PageSection title="Target and goals">
      <form
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
        className="rounded-xl border bg-card p-4 shadow-xs sm:p-5"
      >
        <FieldGroup>
          <FormField
            control={form.control}
            name="targetAmount"
            label="Deposit target"
            description={
              target
                ? `Average balance you need to reach: ${naira(target)}`
                : "The average deposit balance you need for confirmation."
            }
            render={({ value, onChange, ...field }) => (
              <MoneyInput
                {...field}
                value={value}
                onChange={onChange}
                placeholder="180,000,000"
              />
            )}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="targetStartDate"
              label="Measurement starts"
              description={
                start
                  ? longDate(start)
                  : "The first day of your confirmation period."
              }
              render={(field) => <Input {...field} type="date" />}
            />
            <FormField
              control={form.control}
              name="targetEndDate"
              label="Deadline"
              description={
                start
                  ? `Leave empty for 6 months: ${longDate(addDays(start, 182))}.`
                  : "Leave empty for 6 months after the start."
              }
              render={(field) => (
                <Input {...field} type="date" min={start || undefined} />
              )}
            />
            <FormField
              control={form.control}
              name="dailyGoal"
              label="Daily contact goal"
              description="Calls, WhatsApps and visits to log each day."
              render={({ value, onChange, ...field }) => (
                <NumberInput
                  {...field}
                  value={value}
                  onChange={onChange}
                  placeholder="e.g. 10"
                />
              )}
            />
          </div>
          <div className="flex justify-end gap-2">
            {form.formState.isDirty && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => form.reset()}
              >
                Discard
              </Button>
            )}
            <Button
              type="submit"
              disabled={!form.formState.isDirty || form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "Saving…" : "Save"}
            </Button>
          </div>
        </FieldGroup>
      </form>
    </PageSection>
  )
}

function SettingRow({
  id,
  title,
  body,
  children,
}: {
  id?: string
  title: string
  body?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-medium">
          {title}
        </Label>
        {body && <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>}
      </div>
      {children}
    </div>
  )
}

/** Saves one setting straight away, as switches are expected to. */
function useSaveSetting() {
  const update = useUpdateMe()
  return async (patch: MeInput, message = "Saved") => {
    try {
      await update.mutateAsync(patch)
      toast.success(message)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }
}

const HOURS = [5, 6, 7, 8, 9, 10, 11]

const DEBRIEF_HOURS: [number, string][] = [
  [-1, "Off"],
  [16, "4 pm"],
  [17, "5 pm"],
  [18, "6 pm"],
  [19, "7 pm"],
  [20, "8 pm"],
]

const REMINDER_LEADS: [number, string][] = [
  [-1, "Off"],
  [0, "At the time"],
  [5, "5 min before"],
  [10, "10 min before"],
  [15, "15 min before"],
  [30, "30 min before"],
  [60, "1 hour before"],
  [120, "2 hours before"],
]

function Notifications({ me }: { me: Me }) {
  const save = useSaveSetting()
  const { data: config } = useNotificationConfig()
  const sendNow = useSendDigest()
  const support = useSyncExternalStore(
    () => () => {},
    () =>
      inAppBrowser()
        ? "inapp"
        : needsInstallForPush()
          ? "install"
          : !pushSupported()
            ? isIos()
              ? "old-ios"
              : "unsupported"
            : Notification.permission === "denied"
              ? "denied"
              : "ok",
    () => "loading"
  )
  const [subscribed, setSubscribed] = useState<boolean | null>(null)
  const device =
    support !== "ok"
      ? support
      : subscribed === null
        ? "loading"
        : subscribed
          ? "on"
          : "off"
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (pushSupported()) currentSubscription().then((s) => setSubscribed(!!s))
  }, [])

  async function togglePush(on: boolean) {
    if (!config?.pushKey) return
    setBusy(true)
    try {
      if (on) {
        await enablePush(config.pushKey)
        setSubscribed(true)
        toast.success("Notifications are on for this device")
      } else {
        await disablePush()
        setSubscribed(false)
        toast.success("Notifications are off for this device")
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function test() {
    try {
      await api("/notifications/test", { method: "POST" })
      toast.success("Test sent. It should arrive in a few seconds.", {
        description: isIos()
          ? "Nothing? Check Settings › Notifications › Coverage, and that Focus or Do Not Disturb is off."
          : /android/i.test(navigator.userAgent)
            ? "Nothing? Check your phone’s notification settings for your browser, and battery saver."
            : "Nothing? Check your computer allows notifications from your browser (and Focus or Do Not Disturb is off).",
        duration: 10_000,
      })
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <PageSection
      id="notifications"
      title="Reminders"
      hint="A morning list of who to contact, and a nudge before booked follow-ups."
    >
      <div className="divide-y rounded-xl border bg-card shadow-xs">
        <SettingRow
          id="push-device"
          title="Notifications on this device"
          body={
            !config
              ? " "
              : !config.pushKey
                ? "Not set up on the server yet."
                : device === "install"
                  ? "On iPhone and iPad: tap Share, then Add to Home Screen, then open Coverage from your home screen and turn this on there."
                  : device === "inapp"
                    ? "This page is open inside another app. Open it in Chrome or Safari to get notifications."
                    : device === "old-ios"
                      ? "Update to iOS 16.4 or later to get notifications."
                      : device === "denied"
                        ? "Notifications are blocked for this site. Allow them in your browser’s site settings (the icon next to the address), then reload."
                        : device === "unsupported"
                          ? "This browser doesn't support notifications. Try Chrome, Edge, Firefox or Safari."
                          : device === "on"
                            ? "This device will get reminders."
                            : "Turn on to get reminders here."
          }
        >
          <div className="flex items-center gap-2">
            {device === "on" && (
              <Button size="sm" variant="ghost" onClick={test}>
                Test
              </Button>
            )}
            <Switch
              id="push-device"
              checked={device === "on"}
              disabled={
                busy ||
                !config?.pushKey ||
                device === "loading" ||
                (device !== "on" && device !== "off")
              }
              onCheckedChange={togglePush}
            />
          </div>
        </SettingRow>
        <SettingRow
          id="reminder-lead"
          title="Follow-up reminders"
          body="For follow-ups with a time, on devices with notifications on."
        >
          <NativeSelect
            id="reminder-lead"
            value={String(me.reminderLead)}
            onChange={(e) =>
              save({ reminderLead: Number(e.target.value) }, "Reminders saved")
            }
            className="w-36"
          >
            {REMINDER_LEADS.map(([v, label]) => (
              <NativeSelectOption key={v} value={v}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </SettingRow>
        <SettingRow
          id="debrief-hour"
          title="Debrief reminder"
          body="On weekdays, a nudge to talk through your day, unless you already have."
        >
          <NativeSelect
            id="debrief-hour"
            value={String(me.debriefHour)}
            onChange={(e) =>
              save(
                { debriefHour: Number(e.target.value) },
                "Debrief reminder saved"
              )
            }
            className="w-36"
          >
            {DEBRIEF_HOURS.map(([v, label]) => (
              <NativeSelectOption key={v} value={v}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </SettingRow>
        <SettingRow
          id="digest-push"
          title="Morning notification"
          body="Who's due today, sent to devices with notifications on."
        >
          <Switch
            id="digest-push"
            checked={me.digestPush}
            onCheckedChange={(v) =>
              save(
                { digestPush: v },
                v ? "Morning notification on" : "Morning notification off"
              )
            }
          />
        </SettingRow>
        <SettingRow
          id="digest-email"
          title="Morning email"
          body={
            config && !config.email
              ? "Email isn't set up on the server yet."
              : `Sent to ${me.email}.`
          }
        >
          <Switch
            id="digest-email"
            checked={me.digestEmail}
            disabled={config && !config.email}
            onCheckedChange={(v) =>
              save(
                { digestEmail: v },
                v ? "Morning email on" : "Morning email off"
              )
            }
          />
        </SettingRow>
        <SettingRow id="digest-hour" title="Send at" body="Your local time.">
          <NativeSelect
            id="digest-hour"
            value={String(me.digestHour)}
            onChange={(e) =>
              save({ digestHour: Number(e.target.value) }, "Time saved")
            }
            className="w-28"
          >
            {HOURS.map((h) => (
              <NativeSelectOption key={h} value={h}>
                {h}:00 am
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </SettingRow>
        {(me.digestPush || me.digestEmail) && (
          <div className="flex justify-end p-3">
            <Button
              size="sm"
              variant="outline"
              disabled={sendNow.isPending}
              onClick={() =>
                sendNow.mutate(undefined, {
                  onSuccess: () => toast.success("Today's list sent"),
                  onError: (e) => toast.error(e.message),
                })
              }
            >
              <IconBell data-icon="inline-start" />
              {sendNow.isPending ? "Sending…" : "Send today's list now"}
            </Button>
          </div>
        )}
      </div>
    </PageSection>
  )
}

const reportSchema = z.object({
  managerEmail: z
    .string()
    .trim()
    .refine(
      (v) => !v || z.email().safeParse(v).success,
      "Enter a valid email address"
    ),
})

function WeeklyReportSettings({ me }: { me: Me }) {
  const save = useSaveSetting()
  const update = useUpdateMe()
  const form = useForm<z.infer<typeof reportSchema>>({
    resolver: zodResolver(reportSchema),
    defaultValues: { managerEmail: me.managerEmail ?? "" },
  })

  async function submit(values: z.infer<typeof reportSchema>) {
    try {
      await update.mutateAsync({ managerEmail: values.managerEmail })
      toast.success(values.managerEmail ? "Manager's email saved" : "Removed")
    } catch (e) {
      showFormError(form, e)
    }
  }

  return (
    <PageSection
      title="Weekly report"
      hint="Every Monday morning, last week's numbers go to your manager."
    >
      <div className="divide-y rounded-xl border bg-card shadow-xs">
        <form
          noValidate
          onSubmit={form.handleSubmit(submit)}
          className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start"
        >
          <FormField
            control={form.control}
            name="managerEmail"
            label="Manager's email"
            className="flex-1"
            render={(field) => (
              <Input
                {...field}
                type="email"
                placeholder="e.g. manager@providusbank.com"
              />
            )}
          />
          <Button
            type="submit"
            variant="outline"
            className="sm:mt-6"
            disabled={!form.formState.isDirty || form.formState.isSubmitting}
          >
            Save
          </Button>
        </form>
        <SettingRow
          id="weekly-report"
          title="Send automatically"
          body={
            me.managerEmail
              ? `Replies come to you at ${me.email}.`
              : "Add your manager's email first."
          }
        >
          <Switch
            id="weekly-report"
            checked={me.weeklyReport}
            disabled={!me.managerEmail}
            onCheckedChange={(v) =>
              save(
                { weeklyReport: v },
                v ? "Weekly report on" : "Weekly report off"
              )
            }
          />
        </SettingRow>
        <Link
          href="/report"
          className="flex items-center gap-3 p-4 text-sm transition-colors hover:bg-muted/50"
        >
          <IconReportAnalytics className="size-5 text-muted-foreground" />
          <span className="flex-1">
            Preview, print or send this week&apos;s report
          </span>
          <IconChevronRight className="size-4 text-muted-foreground" />
        </Link>
      </div>
    </PageSection>
  )
}

function CalendarFeed() {
  const { data } = useCalendarFeed()
  const link = useCalendarFeedLink()
  const url = data?.url

  async function copy() {
    if (!url) return
    await navigator.clipboard.writeText(url)
    toast.success("Calendar link copied")
  }

  return (
    <PageSection
      title="Calendar"
      hint="See your follow-ups in Google Calendar, Outlook or your phone's calendar."
    >
      <div className="rounded-xl border bg-card p-4 shadow-xs">
        {url ? (
          <>
            <div className="flex gap-2">
              <Input
                readOnly
                value={url}
                aria-label="Calendar link"
                onFocus={(e) => e.target.select()}
              />
              <Button variant="outline" onClick={copy}>
                <IconCopy data-icon="inline-start" /> Copy
              </Button>
            </div>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>
                Google Calendar (on a computer): Other calendars, +, From URL,
                then paste. Google refreshes it every few hours.
              </li>
              <li>
                iPhone:{" "}
                <a
                  className="text-primary underline"
                  href={url.replace(/^https?:/, "webcal:")}
                >
                  tap to subscribe
                </a>
                .
              </li>
              <li>Outlook: Add calendar, Subscribe from web, then paste.</li>
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Anyone with this link can see your follow-up names and dates. Keep
              it private.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={link.isPending}
                onClick={() =>
                  link.mutate("create", {
                    onSuccess: () =>
                      toast.success(
                        "New link made. The old one no longer works."
                      ),
                  })
                }
              >
                Make a new link
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={link.isPending}
                onClick={() =>
                  link.mutate("remove", {
                    onSuccess: () => toast.success("Calendar link turned off"),
                  })
                }
              >
                Turn off
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Get a private link your calendar app can subscribe to.
            </p>
            <Button
              variant="outline"
              disabled={link.isPending || data === undefined}
              onClick={() => link.mutate("create")}
            >
              <IconCalendarShare data-icon="inline-start" /> Get calendar link
            </Button>
          </div>
        )}
      </div>
    </PageSection>
  )
}
