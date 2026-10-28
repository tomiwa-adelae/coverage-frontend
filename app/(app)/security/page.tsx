"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { toast } from "sonner"
import {
  IconCopy,
  IconDeviceDesktop,
  IconDeviceMobile,
  IconDownload,
  IconShieldCheck,
  IconShieldLock,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { timeAgo } from "@/lib/format"
import {
  useDisableTwoFactor,
  useEnableTwoFactor,
  useNewBackupCodes,
  useRevokeOtherSessions,
  useRevokeSession,
  useSecurity,
  useSecurityLog,
  useSetupTwoFactor,
} from "@/lib/queries"
import type { SecurityData, SessionInfo } from "@/lib/types"
import { EmptyNote, PageHeader, PageSection } from "@/components/section"
import { PasswordInput } from "@/components/inputs"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { AppLockSettings } from "@/components/app-lock-settings"

export default function SecurityPage() {
  const { data, isError } = useSecurity()
  return (
    <>
      <PageHeader
        title="Security"
        description="Protect your prospects' details: you're holding customer data."
      />
      {isError ? (
        <EmptyNote>
          Couldn&apos;t load security settings. Refresh to try again.
        </EmptyNote>
      ) : !data ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          <TwoStep data={data} />
          <AppLockSettings />
          <Devices sessions={data.sessions} />
          <ActivityLog />
        </>
      )}
    </>
  )
}

// ---------------------------------------------------------------- Two-step

function TwoStep({ data }: { data: SecurityData }) {
  const [settingUp, setSettingUp] = useState(false)
  const [codes, setCodes] = useState<string[] | null>(null)
  const [confirm, setConfirm] = useState<"disable" | "codes" | null>(null)

  return (
    <PageSection title="Two-step sign-in">
      <div className="rounded-xl border bg-card p-4 shadow-xs">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-full",
              data.twoFactorEnabled
                ? "bg-success/15 text-success"
                : "bg-muted text-muted-foreground"
            )}
          >
            {data.twoFactorEnabled ? (
              <IconShieldCheck className="size-5" />
            ) : (
              <IconShieldLock className="size-5" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {data.twoFactorEnabled ? "On" : "Off"}
            </p>
            <p className="text-sm text-muted-foreground">
              {data.twoFactorEnabled
                ? `Signing in asks for a code from your authenticator app. ${data.backupCodesLeft} backup code${data.backupCodesLeft === 1 ? "" : "s"} left.`
                : "Add a code from an authenticator app (Google Authenticator, Microsoft Authenticator) when you sign in."}
            </p>
            {data.twoFactorEnabled && data.backupCodesLeft <= 3 && (
              <p className="mt-1 text-sm font-medium text-destructive">
                Running low on backup codes. Make new ones.
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {data.twoFactorEnabled ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirm("codes")}
              >
                New backup codes
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirm("disable")}
              >
                Turn off
              </Button>
            </>
          ) : (
            <Button onClick={() => setSettingUp(true)}>Turn on</Button>
          )}
        </div>
      </div>

      <Dialog open={settingUp} onOpenChange={setSettingUp}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
          {settingUp && (
            <SetupFlow
              onDone={(c) => {
                setSettingUp(false)
                setCodes(c)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          {confirm && (
            <PasswordConfirm
              mode={confirm}
              onDone={(c) => {
                setConfirm(null)
                if (c) setCodes(c)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!codes} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          {codes && <BackupCodes codes={codes} onDone={() => setCodes(null)} />}
        </DialogContent>
      </Dialog>
    </PageSection>
  )
}

function SetupFlow({ onDone }: { onDone: (codes: string[]) => void }) {
  const setup = useSetupTwoFactor()
  const enable = useEnableTwoFactor()
  const [qr, setQr] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const { mutate } = setup

  useEffect(() => {
    mutate(undefined, {
      onSuccess: (s) =>
        QRCode.toDataURL(s.otpauthUrl, { margin: 1, width: 220 }).then(setQr),
    })
  }, [mutate])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const r = await enable.mutateAsync(code)
      toast.success("Two-step sign-in is on")
      onDone(r.backupCodes)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const secret = setup.data?.secret.replace(/(.{4})/g, "$1 ").trim()
  return (
    <form onSubmit={submit} className="grid gap-5">
      <DialogHeader>
        <DialogTitle>Turn on two-step sign-in</DialogTitle>
        <DialogDescription>
          1. Scan this with your authenticator app. 2. Enter the 6-digit code it
          shows.
        </DialogDescription>
      </DialogHeader>
      <div className="grid place-items-center gap-3">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qr}
            alt="QR code for your authenticator app"
            className="size-[220px] rounded-lg border bg-white p-1"
          />
        ) : (
          <Skeleton className="size-[220px]" />
        )}
        {setup.data && (
          <>
            <p className="text-center text-xs text-muted-foreground">
              Can&apos;t scan? Enter this key in the app:
              <br />
              <span className="font-mono text-sm text-foreground select-all">
                {secret}
              </span>
            </p>
            <a
              href={setup.data.otpauthUrl}
              className="text-sm text-primary underline sm:hidden"
            >
              Open in authenticator app on this phone
            </a>
          </>
        )}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="totp-code">Code from the app</Label>
        <Input
          id="totp-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123 456"
          className="h-11 text-center font-mono text-lg tracking-[0.3em]"
          aria-invalid={!!error}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button
          type="submit"
          disabled={
            enable.isPending ||
            !setup.data ||
            code.replace(/\s/g, "").length !== 6
          }
        >
          {enable.isPending ? "Checking…" : "Turn on"}
        </Button>
      </DialogFooter>
    </form>
  )
}

function PasswordConfirm({
  mode,
  onDone,
}: {
  mode: "disable" | "codes"
  onDone: (codes?: string[]) => void
}) {
  const disable = useDisableTwoFactor()
  const regenerate = useNewBackupCodes()
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const pending = disable.isPending || regenerate.isPending

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      if (mode === "disable") {
        await disable.mutateAsync(password)
        toast.success("Two-step sign-in is off")
        onDone()
      } else {
        const r = await regenerate.mutateAsync(password)
        onDone(r.backupCodes)
      }
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <DialogHeader>
        <DialogTitle>
          {mode === "disable"
            ? "Turn off two-step sign-in?"
            : "Make new backup codes"}
        </DialogTitle>
        <DialogDescription>
          {mode === "disable"
            ? "Your account will only be protected by your password."
            : "Your old backup codes will stop working."}{" "}
          Enter your password to continue.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="confirm-password">Password</Label>
        <PasswordInput
          id="confirm-password"
          value={password}
          autoFocus
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!error}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onDone()}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant={mode === "disable" ? "destructive" : "default"}
          disabled={pending || !password}
        >
          {pending
            ? "Checking…"
            : mode === "disable"
              ? "Turn off"
              : "Make new codes"}
        </Button>
      </DialogFooter>
    </form>
  )
}

function BackupCodes({
  codes,
  onDone,
}: {
  codes: string[]
  onDone: () => void
}) {
  const text = codes.join("\n")
  function download() {
    const url = URL.createObjectURL(
      new Blob([`Coverage backup codes\nEach code works once.\n\n${text}\n`], {
        type: "text/plain",
      })
    )
    const a = document.createElement("a")
    a.href = url
    a.download = "coverage-backup-codes.txt"
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <div className="grid gap-5">
      <DialogHeader>
        <DialogTitle>Save your backup codes</DialogTitle>
        <DialogDescription>
          If you lose your phone, each code signs you in once. This is the only
          time you&apos;ll see them.
        </DialogDescription>
      </DialogHeader>
      <ul className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-4 font-mono text-sm">
        {codes.map((c) => (
          <li key={c} className="text-center select-all">
            {c}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={async () => {
            await navigator.clipboard.writeText(text)
            toast.success("Codes copied")
          }}
        >
          <IconCopy data-icon="inline-start" /> Copy
        </Button>
        <Button variant="outline" className="flex-1" onClick={download}>
          <IconDownload data-icon="inline-start" /> Download
        </Button>
      </div>
      <Button onClick={onDone}>I&apos;ve saved them</Button>
    </div>
  )
}

// ---------------------------------------------------------------- Devices

/** "Chrome on Android" from a user agent string, good enough to recognise a device. */
export function describeDevice(ua: string | null) {
  if (!ua) return { label: "Unknown device", mobile: false }
  const os = /android/i.test(ua)
    ? "Android"
    : /iphone|ipad/i.test(ua)
      ? "iPhone"
      : /mac os/i.test(ua)
        ? "Mac"
        : /windows/i.test(ua)
          ? "Windows"
          : /linux/i.test(ua)
            ? "Linux"
            : null
  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /opr\/|opera/i.test(ua)
      ? "Opera"
      : /chrome|crios/i.test(ua)
        ? "Chrome"
        : /firefox|fxios/i.test(ua)
          ? "Firefox"
          : /safari/i.test(ua)
            ? "Safari"
            : "Browser"
  return {
    label: os ? `${browser} on ${os}` : browser,
    mobile: /android|iphone|ipad|mobile/i.test(ua),
  }
}

function Devices({ sessions }: { sessions: SessionInfo[] }) {
  const revoke = useRevokeSession()
  const revokeOthers = useRevokeOtherSessions()
  const others = sessions.filter((s) => !s.current).length
  return (
    <PageSection
      title="Signed-in devices"
      hint="Sign out anything you don't recognise, then change your password."
    >
      <ul className="divide-y rounded-xl border bg-card shadow-xs">
        {sessions.map((s) => {
          const d = describeDevice(s.userAgent)
          const Icon = d.mobile ? IconDeviceMobile : IconDeviceDesktop
          return (
            <li key={s.id} className="flex items-center gap-3 p-4">
              <Icon className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {d.label}
                  {s.current && (
                    <span className="ml-2 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
                      This device
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  Active {timeAgo(s.lastUsedAt)}
                  {s.ip ? ` · ${s.ip}` : ""} · signed in {timeAgo(s.createdAt)}
                </p>
              </div>
              {!s.current && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={revoke.isPending}
                  onClick={() =>
                    revoke.mutate(s.id, {
                      onSuccess: () => toast.success(`Signed out ${d.label}`),
                    })
                  }
                >
                  Sign out
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      {others > 0 && (
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            disabled={revokeOthers.isPending}
            onClick={() =>
              revokeOthers.mutate(undefined, {
                onSuccess: () => toast.success("Signed out all other devices"),
              })
            }
          >
            Sign out all other devices
          </Button>
        </div>
      )}
    </PageSection>
  )
}

function ActivityLog() {
  const { data } = useSecurityLog()
  return (
    <PageSection
      title="Account activity"
      hint="Sign-ins, security changes, imports, exports and deletions. Last 100."
    >
      {!data ? (
        <Skeleton className="h-40 w-full" />
      ) : data.length === 0 ? (
        <EmptyNote>Nothing recorded yet.</EmptyNote>
      ) : (
        <ul className="divide-y rounded-xl border bg-card text-sm shadow-xs">
          {data.map((e) => (
            <li key={e.id} className="flex items-start gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{e.label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[e.detail, describeDevice(e.userAgent).label, e.ip]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <time
                dateTime={e.createdAt}
                title={new Date(e.createdAt).toLocaleString("en-GB")}
                className="shrink-0 text-xs text-muted-foreground"
              >
                {timeAgo(e.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </PageSection>
  )
}
