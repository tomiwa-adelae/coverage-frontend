"use client"

import Link from "next/link"
import { useState, useSyncExternalStore } from "react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { BrandLockup } from "@/components/brand"

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  // Until hydration the submit handler is not attached; keep the button disabled so the
  // browser never falls back to a native submit (which would put the password in a URL).
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
  const isSignup = mode === "signup"

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const body = Object.fromEntries(new FormData(e.currentTarget))
    setPending(true)
    setError(null)
    try {
      await api(isSignup ? "/auth/register" : "/auth/login", {
        method: "POST",
        body,
      })
      // Full navigation so the proxy sees the new cookies.
      window.location.href = "/"
    } catch (err) {
      setError((err as Error).message)
      setPending(false)
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <BrandLockup />
        <h1 className="mt-8 text-2xl font-semibold tracking-tight">
          {isSignup ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isSignup
            ? "Create your account to start tracking prospects."
            : "Sign in to see who to reach out to today."}
        </p>

        <form method="post" onSubmit={onSubmit} className="mt-8">
          <FieldGroup>
            {isSignup && (
              <Field>
                <FieldLabel htmlFor="name">Full name</FieldLabel>
                <Input id="name" name="name" autoComplete="name" required />
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                minLength={isSignup ? 8 : undefined}
                required
              />
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" size="lg" disabled={pending || !hydrated}>
              {pending
                ? "Please wait…"
                : isSignup
                  ? "Create account"
                  : "Sign in"}
            </Button>
          </FieldGroup>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {isSignup ? "Already have an account? " : "New here? "}
          <Link
            href={isSignup ? "/login" : "/signup"}
            className="font-medium text-foreground underline underline-offset-4"
          >
            {isSignup ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </div>
    </main>
  )
}
