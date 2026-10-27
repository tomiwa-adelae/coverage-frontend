"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { z } from "zod"
import {
  IconArrowLeft,
  IconArrowRight,
  IconLoader2,
  IconMailCheck,
  IconShieldLock,
} from "@tabler/icons-react"
import { api } from "@/lib/api"
import { clearOfflineCache } from "@/lib/offline-cache"
import { showFormError } from "@/lib/forms"
import { emailField, newPasswordField, withConfirm } from "@/lib/schemas"
import { useHydrated } from "@/hooks/use-hydrated"
import { FormField } from "@/components/form-field"
import { PasswordInput } from "@/components/inputs"
import { PasswordStrength } from "@/components/auth/password-strength"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

function AuthHeader({
  title,
  description,
}: {
  title: string
  description: React.ReactNode
}) {
  return (
    <header className="mb-7">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
        {title}
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
    </header>
  )
}

function Submit({
  pending,
  children,
}: {
  pending: boolean
  children: React.ReactNode
}) {
  const hydrated = useHydrated()
  return (
    <Button
      type="submit"
      size="lg"
      className="group mt-1 h-11 w-full text-[15px]"
      disabled={pending || !hydrated}
    >
      {pending ? (
        <IconLoader2 className="animate-spin" data-icon="inline-start" />
      ) : null}
      {children}
      {!pending && (
        <IconArrowRight
          data-icon="inline-end"
          className="transition-transform group-hover:translate-x-0.5"
        />
      )}
    </Button>
  )
}

/**
 * Full page load into the app so the proxy sees the new session cookies.
 * `entering` keeps the button busy until the navigation takes over.
 */
function useEnterApp() {
  const [entering, setEntering] = useState(false)
  const enter = () => {
    setEntering(true)
    // Never show a previous user's saved list on a shared device.
    clearOfflineCache()
    window.location.href = "/"
  }
  return [entering, enter] as const
}

// ---------------------------------------------------------------- Sign in

const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Enter your password"),
})

export function LoginForm() {
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })
  const [entering, enter] = useEnterApp()
  const [ticket, setTicket] = useState<string | null>(null)

  async function onSubmit(values: z.infer<typeof loginSchema>) {
    try {
      const r = await api<{ twoFactor?: boolean; ticket?: string }>(
        "/auth/login",
        { method: "POST", body: values }
      )
      if (r?.twoFactor && r.ticket) return setTicket(r.ticket)
      toast.success("Welcome back")
      enter()
    } catch (e) {
      showFormError(form, e)
    }
  }

  const pending = form.formState.isSubmitting || entering

  if (ticket)
    return (
      <TwoFactorStep
        ticket={ticket}
        onBack={() => {
          setTicket(null)
          form.setValue("password", "")
        }}
      />
    )

  return (
    <>
      <AuthHeader
        title="Welcome back"
        description="Sign in to see who to reach out to today."
      />
      <form method="post" noValidate onSubmit={form.handleSubmit(onSubmit)}>
        <FieldGroup>
          <FormField
            control={form.control}
            name="email"
            label="Work email"
            render={(field) => (
              <Input
                {...field}
                type="email"
                autoComplete="email"
                placeholder="you@providusbank.com"
                autoFocus
              />
            )}
          />
          <FormField
            control={form.control}
            name="password"
            label="Password"
            labelAction={
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-primary hover:underline dark:text-brand"
              >
                Forgot password?
              </Link>
            }
            render={(field) => (
              <PasswordInput
                {...field}
                autoComplete="current-password"
                placeholder="Enter your password"
              />
            )}
          />
          <Submit pending={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Submit>
        </FieldGroup>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to Coverage?{" "}
        <Link
          href="/signup"
          className="font-medium text-foreground underline underline-offset-4"
        >
          Create an account
        </Link>
      </p>
    </>
  )
}

const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Enter the code")
    .refine(
      (v) => /^\d{3}\s?\d{3}$/.test(v) || /^[a-z0-9]{4}-?[a-z0-9]{4}$/i.test(v),
      "Enter the 6-digit code, or a backup code like ab12-cd34"
    ),
})

/** Second step for accounts with two-step sign-in: authenticator or backup code. */
function TwoFactorStep({
  ticket,
  onBack,
}: {
  ticket: string
  onBack: () => void
}) {
  const [backup, setBackup] = useState(false)
  const [entering, enter] = useEnterApp()
  const form = useForm<z.infer<typeof codeSchema>>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  })

  async function onSubmit({ code }: z.infer<typeof codeSchema>) {
    try {
      await api("/auth/login/two-factor", {
        method: "POST",
        body: { ticket, code: code.replace(/\s/g, "") },
      })
      toast.success("Welcome back")
      enter()
    } catch (e) {
      showFormError(form, e)
    }
  }

  const pending = form.formState.isSubmitting || entering
  return (
    <>
      <span className="mb-4 grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
        <IconShieldLock className="size-6" />
      </span>
      <AuthHeader
        title="Two-step sign-in"
        description={
          backup
            ? "Enter one of the backup codes you saved. Each works once."
            : "Enter the 6-digit code from your authenticator app."
        }
      />
      <form noValidate onSubmit={form.handleSubmit(onSubmit)}>
        <FieldGroup>
          <FormField
            control={form.control}
            name="code"
            label={backup ? "Backup code" : "Code"}
            render={(field) => (
              <Input
                {...field}
                key={backup ? "backup" : "totp"}
                autoFocus
                autoComplete="one-time-code"
                inputMode={backup ? "text" : "numeric"}
                placeholder={backup ? "ab12-cd34" : "123 456"}
                className="h-11 text-center font-mono text-lg tracking-[0.3em]"
              />
            )}
          />
          <Submit pending={pending}>{pending ? "Checking…" : "Verify"}</Submit>
        </FieldGroup>
      </form>
      <div className="mt-6 flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <IconArrowLeft className="size-4" /> Back
        </button>
        <button
          type="button"
          className="font-medium text-primary hover:underline dark:text-brand"
          onClick={() => {
            setBackup((b) => !b)
            form.reset({ code: "" })
          }}
        >
          {backup ? "Use authenticator app" : "Use a backup code"}
        </button>
      </div>
    </>
  )
}

// ---------------------------------------------------------------- Sign up

const signupSchema = withConfirm(
  {
    name: z
      .string()
      .trim()
      .min(2, "Enter your full name")
      .max(120, "Name must be 120 characters or fewer"),
    email: emailField,
    password: newPasswordField,
  },
  "password"
)

export function SignupForm() {
  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  })
  const [entering, enter] = useEnterApp()
  const password = useWatch({ control: form.control, name: "password" })

  async function onSubmit({
    name,
    email,
    password,
  }: z.infer<typeof signupSchema>) {
    try {
      await api("/auth/register", {
        method: "POST",
        body: { name, email, password },
      })
      toast.success("Account created", {
        description: "Let’s get your pipeline moving.",
      })
      enter()
    } catch (e) {
      showFormError(form, e)
    }
  }

  const pending = form.formState.isSubmitting || entering

  return (
    <>
      <AuthHeader
        title="Create your account"
        description="Track prospects, follow-ups and your progress to target."
      />
      <form method="post" noValidate onSubmit={form.handleSubmit(onSubmit)}>
        <FieldGroup>
          <FormField
            control={form.control}
            name="name"
            label="Full name"
            render={(field) => (
              <Input
                {...field}
                autoComplete="name"
                placeholder="e.g. Tomi Adeyemi"
                autoFocus
              />
            )}
          />
          <FormField
            control={form.control}
            name="email"
            label="Work email"
            render={(field) => (
              <Input
                {...field}
                type="email"
                autoComplete="email"
                placeholder="you@providusbank.com"
              />
            )}
          />
          <FormField
            control={form.control}
            name="password"
            label="Password"
            render={(field) => (
              <PasswordInput
                {...field}
                autoComplete="new-password"
                placeholder="At least 8 characters"
              />
            )}
          />
          <PasswordStrength password={password} />
          <FormField
            control={form.control}
            name="confirmPassword"
            label="Confirm password"
            render={(field) => (
              <PasswordInput
                {...field}
                autoComplete="new-password"
                placeholder="Type it again"
              />
            )}
          />
          <Submit pending={pending}>
            {pending ? "Creating account…" : "Create account"}
          </Submit>
        </FieldGroup>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </>
  )
}

// ---------------------------------------------------------------- Forgot password

const forgotSchema = z.object({ email: emailField })
const RESEND_AFTER = 60

export function ForgotPasswordForm() {
  const form = useForm<z.infer<typeof forgotSchema>>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  })
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (!cooldown) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function send(values: z.infer<typeof forgotSchema>) {
    try {
      await api("/auth/forgot-password", { method: "POST", body: values })
      setSentTo(values.email)
      setCooldown(RESEND_AFTER)
      toast.success("Reset link sent", {
        description: `If ${values.email} has an account, the email is on its way.`,
      })
    } catch (e) {
      showFormError(form, e)
    }
  }

  if (sentTo)
    return (
      <div className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand/15 text-tier-a">
          <IconMailCheck className="size-7" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">
          Check your inbox
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          If an account exists for{" "}
          <span className="font-medium text-foreground">{sentTo}</span>, we’ve
          sent a link to reset your password. It expires in 30 minutes.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Can’t find it? Check your spam or promotions folder.
        </p>
        <div className="mt-7 grid gap-2">
          <Button
            variant="outline"
            size="lg"
            disabled={cooldown > 0 || form.formState.isSubmitting}
            onClick={() => send({ email: sentTo })}
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend link"}
          </Button>
          <Button variant="ghost" onClick={() => setSentTo(null)}>
            Use a different email
          </Button>
        </div>
        <BackToSignIn />
      </div>
    )

  return (
    <>
      <AuthHeader
        title="Forgot your password?"
        description="Enter the email you sign in with and we’ll send you a link to choose a new one."
      />
      <form method="post" noValidate onSubmit={form.handleSubmit(send)}>
        <FieldGroup>
          <FormField
            control={form.control}
            name="email"
            label="Work email"
            render={(field) => (
              <Input
                {...field}
                type="email"
                autoComplete="email"
                placeholder="you@providusbank.com"
                autoFocus
              />
            )}
          />
          <Submit pending={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Sending link…" : "Send reset link"}
          </Submit>
        </FieldGroup>
      </form>
      <BackToSignIn />
    </>
  )
}

function BackToSignIn() {
  return (
    <p className="mt-6 text-center text-sm">
      <Link
        href="/login"
        className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
      >
        <IconArrowLeft className="size-4" /> Back to sign in
      </Link>
    </p>
  )
}

// ---------------------------------------------------------------- Reset password

const resetSchema = withConfirm({ password: newPasswordField }, "password")

export function ResetPasswordForm({ token }: { token: string | null }) {
  const form = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirmPassword: "" },
  })
  const [entering, enter] = useEnterApp()
  const password = useWatch({ control: form.control, name: "password" })

  if (!token)
    return (
      <>
        <AuthHeader
          title="This link isn’t complete"
          description="Open the link from your email again, or request a new one."
        />
        <Button
          size="lg"
          className="w-full"
          nativeButton={false}
          render={<Link href="/forgot-password" />}
        >
          Request a new link
        </Button>
        <BackToSignIn />
      </>
    )

  async function onSubmit(values: z.infer<typeof resetSchema>) {
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: { token, password: values.password },
      })
      toast.success("Password updated", {
        description: "You’re signed in with your new password.",
      })
      enter()
    } catch (e) {
      showFormError(form, e)
    }
  }

  const pending = form.formState.isSubmitting || entering

  return (
    <>
      <AuthHeader
        title="Choose a new password"
        description="Use something you don’t use anywhere else. You’ll be signed in afterwards."
      />
      <form method="post" noValidate onSubmit={form.handleSubmit(onSubmit)}>
        <FieldGroup>
          <FormField
            control={form.control}
            name="password"
            label="New password"
            render={(field) => (
              <PasswordInput
                {...field}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                autoFocus
              />
            )}
          />
          <PasswordStrength password={password} />
          <FormField
            control={form.control}
            name="confirmPassword"
            label="Confirm new password"
            render={(field) => (
              <PasswordInput
                {...field}
                autoComplete="new-password"
                placeholder="Type it again"
              />
            )}
          />
          <Submit pending={pending}>
            {pending ? "Saving…" : "Save and sign in"}
          </Submit>
        </FieldGroup>
      </form>
      <BackToSignIn />
    </>
  )
}
